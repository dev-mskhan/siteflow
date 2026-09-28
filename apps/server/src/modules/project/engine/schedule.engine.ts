// apps/server/src/modules/project/engine/schedule.engine.ts
import type { WorkDaysConfig } from '@siteflow/database/schema';
import { CalendarService } from '../calendar/calendar.service.js';
import type {
  ScheduleGraph,
  ScheduleNode,
  ScheduleCalculationResult,
} from './schedule.engine.types.js';

const calendarService = new CalendarService();

function addCalendarDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().split('T')[0]!;
}

export class ScheduleEngine {
  /**
   * Pure, deterministic schedule calculation algorithm.
   * Performs topological sort, forward pass (earlyStart/earlyFinish),
   * backward pass (lateStart/lateFinish), totalFloat, and critical path identification.
   */
  static calculate(
    graph: ScheduleGraph,
    workDays: WorkDaysConfig,
    exceptionsMap: Map<string, boolean> = new Map(),
  ): ScheduleCalculationResult {
    const updatedNodes = new Map<string, ScheduleNode>();
    for (const [id, node] of graph.nodes.entries()) {
      updatedNodes.set(id, { ...node });
    }

    // Build adjacency lists & in-degrees
    const inDegree = new Map<string, number>();
    const successors = new Map<string, string[]>(); // predecessorId -> successorIds
    const predecessors = new Map<string, string[]>(); // taskId -> predecessorIds

    for (const id of updatedNodes.keys()) {
      inDegree.set(id, 0);
      successors.set(id, []);
      predecessors.set(id, []);
    }

    for (const edge of graph.edges) {
      if (updatedNodes.has(edge.taskId) && updatedNodes.has(edge.predecessorId)) {
        inDegree.set(edge.taskId, (inDegree.get(edge.taskId) ?? 0) + 1);
        successors.get(edge.predecessorId)!.push(edge.taskId);
        predecessors.get(edge.taskId)!.push(edge.predecessorId);
      }
    }

    // 1. Topological Sort (Kahn's algorithm)
    const topoOrder: string[] = [];
    const queue: string[] = [];
    for (const [id, deg] of inDegree.entries()) {
      if (deg === 0) queue.push(id);
    }

    while (queue.length > 0) {
      const u = queue.shift()!;
      topoOrder.push(u);
      for (const v of successors.get(u) ?? []) {
        const deg = (inDegree.get(v) ?? 1) - 1;
        inDegree.set(v, deg);
        if (deg === 0) queue.push(v);
      }
    }

    // Map of outgoing/incoming edges for fast lookup
    const edgesFromPred = new Map<string, Map<string, typeof graph.edges[0]>>();
    for (const edge of graph.edges) {
      if (!edgesFromPred.has(edge.predecessorId)) {
        edgesFromPred.set(edge.predecessorId, new Map());
      }
      edgesFromPred.get(edge.predecessorId)!.set(edge.taskId, edge);
    }

    const edgesToSucc = new Map<string, Map<string, typeof graph.edges[0]>>();
    for (const edge of graph.edges) {
      if (!edgesToSucc.has(edge.taskId)) {
        edgesToSucc.set(edge.taskId, new Map());
      }
      edgesToSucc.get(edge.taskId)!.set(edge.predecessorId, edge);
    }

    // Ensure project start date is a working day
    const projectStartWorkingDate = calendarService.nextWorkingDate(
      graph.projectStartDate,
      workDays,
      exceptionsMap,
    );

    // ── 2. FORWARD PASS ──────────────────────────────────────────────────────
    for (const u of topoOrder) {
      const node = updatedNodes.get(u)!;
      let earlyStartCandidate = projectStartWorkingDate;

      // Evaluate all predecessors
      const predIds = predecessors.get(u) ?? [];
      for (const predId of predIds) {
        const predNode = updatedNodes.get(predId)!;
        const edge = edgesToSucc.get(u)?.get(predId);
        if (!edge || !predNode.earlyStart || !predNode.earlyFinish) continue;

        let reqStart = earlyStartCandidate;
        const type = edge.dependencyType;
        const lag = edge.lagDays;

        if (type === 'FS') {
          // Finish-to-Start: successor starts after predecessor finishes + lag
          const dayAfterFinish = addCalendarDays(predNode.earlyFinish, 1);
          const baseWorkingDate = calendarService.nextWorkingDate(dayAfterFinish, workDays, exceptionsMap);
          reqStart = lag > 0
            ? calendarService.addWorkingDays(baseWorkingDate, lag + 1, workDays, exceptionsMap)
            : lag < 0
              ? calendarService.subtractWorkingDays(baseWorkingDate, Math.abs(lag), workDays, exceptionsMap)
              : baseWorkingDate;
        } else if (type === 'SS') {
          // Start-to-Start: successor starts when predecessor starts + lag
          reqStart = lag > 0
            ? calendarService.addWorkingDays(predNode.earlyStart, lag + 1, workDays, exceptionsMap)
            : lag < 0
              ? calendarService.subtractWorkingDays(predNode.earlyStart, Math.abs(lag), workDays, exceptionsMap)
              : predNode.earlyStart;
        } else if (type === 'FF') {
          // Finish-to-Finish: successor finishes when predecessor finishes + lag
          const targetFinish = lag > 0
            ? calendarService.addWorkingDays(predNode.earlyFinish, lag + 1, workDays, exceptionsMap)
            : lag < 0
              ? calendarService.subtractWorkingDays(predNode.earlyFinish, Math.abs(lag), workDays, exceptionsMap)
              : predNode.earlyFinish;

          reqStart = node.durationDays <= 1
            ? targetFinish
            : calendarService.subtractWorkingDays(targetFinish, node.durationDays, workDays, exceptionsMap);
        } else if (type === 'SF') {
          // Start-to-Finish: successor finishes when predecessor starts + lag
          const targetFinish = lag > 0
            ? calendarService.addWorkingDays(predNode.earlyStart, lag + 1, workDays, exceptionsMap)
            : lag < 0
              ? calendarService.subtractWorkingDays(predNode.earlyStart, Math.abs(lag), workDays, exceptionsMap)
              : predNode.earlyStart;

          reqStart = node.durationDays <= 1
            ? targetFinish
            : calendarService.subtractWorkingDays(targetFinish, node.durationDays, workDays, exceptionsMap);
        }

        if (reqStart > earlyStartCandidate) {
          earlyStartCandidate = reqStart;
        }
      }

      // Apply constraint: START_NO_EARLIER_THAN (SNET)
      if (node.constraintType === 'START_NO_EARLIER_THAN' && node.constraintDate) {
        const constraintWorkingDate = calendarService.nextWorkingDate(
          node.constraintDate,
          workDays,
          exceptionsMap,
        );
        if (constraintWorkingDate > earlyStartCandidate) {
          earlyStartCandidate = constraintWorkingDate;
        }
      }

      node.earlyStart = earlyStartCandidate;

      // Calculate earlyFinish
      if (node.taskType === 'MILESTONE' || node.durationDays <= 1) {
        node.earlyFinish = earlyStartCandidate;
      } else {
        node.earlyFinish = calendarService.addWorkingDays(
          earlyStartCandidate,
          node.durationDays,
          workDays,
          exceptionsMap,
        );
      }

      // Update current dates to operational forecast
      node.currentStartDate = node.earlyStart;
      node.currentFinishDate = node.earlyFinish;
    }

    // Determine max earlyFinish across all nodes
    let maxFinishDate: string | null = null;
    for (const node of updatedNodes.values()) {
      if (node.earlyFinish && (!maxFinishDate || node.earlyFinish > maxFinishDate)) {
        maxFinishDate = node.earlyFinish;
      }
    }

    // ── 3. BACKWARD PASS ─────────────────────────────────────────────────────
    const reverseTopoOrder = [...topoOrder].reverse();

    for (const u of reverseTopoOrder) {
      const node = updatedNodes.get(u)!;
      const succIds = successors.get(u) ?? [];

      let lateFinishCandidate = maxFinishDate ?? node.earlyFinish ?? projectStartWorkingDate;

      if (succIds.length > 0) {
        let minSuccLateFinish = lateFinishCandidate;
        let isFirstSucc = true;

        for (const succId of succIds) {
          const succNode = updatedNodes.get(succId)!;
          const edge = edgesFromPred.get(u)?.get(succId);
          if (!edge || !succNode.lateStart || !succNode.lateFinish) continue;

          let targetLateFinish = minSuccLateFinish;
          const type = edge.dependencyType;
          const lag = edge.lagDays;

          if (type === 'FS') {
            // Successor lateStart minus (1 + lag) working days
            const dayBeforeSuccStart = addCalendarDays(succNode.lateStart, -1);
            const baseDate = calendarService.previousWorkingDate(dayBeforeSuccStart, workDays, exceptionsMap);
            targetLateFinish = lag > 0
              ? calendarService.subtractWorkingDays(baseDate, lag, workDays, exceptionsMap)
              : lag < 0
                ? calendarService.addWorkingDays(baseDate, Math.abs(lag), workDays, exceptionsMap)
                : baseDate;
          } else if (type === 'FF') {
            targetLateFinish = lag > 0
              ? calendarService.subtractWorkingDays(succNode.lateFinish, lag, workDays, exceptionsMap)
              : lag < 0
                ? calendarService.addWorkingDays(succNode.lateFinish, Math.abs(lag), workDays, exceptionsMap)
                : succNode.lateFinish;
          } else if (type === 'SS') {
            // u's lateStart must satisfy succNode.lateStart - lag
            const requiredLateStart = lag > 0
              ? calendarService.subtractWorkingDays(succNode.lateStart, lag, workDays, exceptionsMap)
              : lag < 0
                ? calendarService.addWorkingDays(succNode.lateStart, Math.abs(lag), workDays, exceptionsMap)
                : succNode.lateStart;

            targetLateFinish = node.durationDays <= 1
              ? requiredLateStart
              : calendarService.addWorkingDays(requiredLateStart, node.durationDays, workDays, exceptionsMap);
          } else if (type === 'SF') {
            const requiredLateStart = lag > 0
              ? calendarService.subtractWorkingDays(succNode.lateFinish, lag, workDays, exceptionsMap)
              : lag < 0
                ? calendarService.addWorkingDays(succNode.lateFinish, Math.abs(lag), workDays, exceptionsMap)
                : succNode.lateFinish;

            targetLateFinish = node.durationDays <= 1
              ? requiredLateStart
              : calendarService.addWorkingDays(requiredLateStart, node.durationDays, workDays, exceptionsMap);
          }

          if (isFirstSucc || targetLateFinish < minSuccLateFinish) {
            minSuccLateFinish = targetLateFinish;
            isFirstSucc = false;
          }
        }

        if (!isFirstSucc) {
          lateFinishCandidate = minSuccLateFinish;
        }
      }

      // Apply constraint: FINISH_NO_LATER_THAN (FNLT)
      if (node.constraintType === 'FINISH_NO_LATER_THAN' && node.constraintDate) {
        const constraintWorkingDate = calendarService.previousWorkingDate(
          node.constraintDate,
          workDays,
          exceptionsMap,
        );
        if (constraintWorkingDate < lateFinishCandidate) {
          lateFinishCandidate = constraintWorkingDate;
        }
      }

      node.lateFinish = lateFinishCandidate;

      // Calculate lateStart
      if (node.taskType === 'MILESTONE' || node.durationDays <= 1) {
        node.lateStart = lateFinishCandidate;
      } else {
        node.lateStart = calendarService.subtractWorkingDays(
          lateFinishCandidate,
          node.durationDays,
          workDays,
          exceptionsMap,
        );
      }

      // ── 4. FLOAT & CRITICAL PATH ──────────────────────────────────────────
      if (node.earlyStart && node.lateStart) {
        if (node.lateStart >= node.earlyStart) {
          const rawDuration = calendarService.calculateWorkingDuration(
            node.earlyStart,
            node.lateStart,
            workDays,
            exceptionsMap,
          );
          node.totalFloat = Math.max(0, rawDuration - 1);
        } else {
          const negDuration = calendarService.calculateWorkingDuration(
            node.lateStart,
            node.earlyStart,
            workDays,
            exceptionsMap,
          );
          node.totalFloat = -(negDuration - 1);
        }
      } else {
        node.totalFloat = 0;
      }

      node.isCritical = (node.totalFloat ?? 0) <= 0;
    }

    const criticalPathTaskIds: string[] = [];
    for (const [id, node] of updatedNodes.entries()) {
      if (node.isCritical) {
        criticalPathTaskIds.push(id);
      }
    }

    return {
      updatedNodes,
      maxFinishDate,
      criticalPathTaskIds,
    };
  }
}
