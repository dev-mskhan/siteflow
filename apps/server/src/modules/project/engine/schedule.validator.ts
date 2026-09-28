// apps/server/src/modules/project/engine/schedule.validator.ts
import type { ScheduleGraph, ScheduleValidationResult } from './schedule.engine.types.js';

export class ScheduleValidator {
  /**
   * Pre-flight schedule graph validation.
   * Checks for invalid dates, duration violations, missing constraint dates,
   * and circular dependencies.
   */
  static validate(graph: ScheduleGraph): ScheduleValidationResult {
    const errors: ScheduleValidationResult['errors'] = [];

    // 1. Node level validations
    for (const [id, node] of graph.nodes.entries()) {
      // MILESTONE must have 0 duration
      if (node.taskType === 'MILESTONE' && node.durationDays !== 0) {
        errors.push({
          code: 'INVALID_MILESTONE_DURATION',
          message: `Milestone task '${node.taskCode}' (${id}) must have a duration of 0 days.`,
          taskId: id,
        });
      }

      // TASK must have duration >= 0
      if (node.taskType === 'TASK' && node.durationDays < 0) {
        errors.push({
          code: 'INVALID_TASK_DURATION',
          message: `Task '${node.taskCode}' (${id}) cannot have a negative duration.`,
          taskId: id,
        });
      }

      // Constraint validations
      if (
        (node.constraintType === 'START_NO_EARLIER_THAN' ||
          node.constraintType === 'FINISH_NO_LATER_THAN') &&
        !node.constraintDate
      ) {
        errors.push({
          code: 'MISSING_CONSTRAINT_DATE',
          message: `Task '${node.taskCode}' (${id}) has constraint ${node.constraintType} but missing constraintDate.`,
          taskId: id,
        });
      }
    }

    // 2. Dependency edge validations
    for (const edge of graph.edges) {
      if (!graph.nodes.has(edge.taskId)) {
        errors.push({
          code: 'MISSING_SUCCESSOR_TASK',
          message: `Dependency edge references missing successor task '${edge.taskId}'.`,
          taskId: edge.taskId,
        });
      }
      if (!graph.nodes.has(edge.predecessorId)) {
        errors.push({
          code: 'MISSING_PREDECESSOR_TASK',
          message: `Dependency edge references missing predecessor task '${edge.predecessorId}'.`,
          taskId: edge.predecessorId,
        });
      }
    }

    // 3. Circular Dependency (Cycle) Check using Kahn's algorithm
    const inDegree = new Map<string, number>();
    for (const id of graph.nodes.keys()) {
      inDegree.set(id, 0);
    }

    // Count predecessors per node
    for (const edge of graph.edges) {
      if (graph.nodes.has(edge.taskId) && graph.nodes.has(edge.predecessorId)) {
        inDegree.set(edge.taskId, (inDegree.get(edge.taskId) ?? 0) + 1);
      }
    }

    const queue: string[] = [];
    for (const [id, count] of inDegree.entries()) {
      if (count === 0) queue.push(id);
    }

    let visitedCount = 0;
    const adj = new Map<string, string[]>();
    for (const edge of graph.edges) {
      if (!adj.has(edge.predecessorId)) adj.set(edge.predecessorId, []);
      adj.get(edge.predecessorId)!.push(edge.taskId);
    }

    while (queue.length > 0) {
      const u = queue.shift()!;
      visitedCount++;
      const successors = adj.get(u) ?? [];
      for (const v of successors) {
        const newDeg = (inDegree.get(v) ?? 1) - 1;
        inDegree.set(v, newDeg);
        if (newDeg === 0) {
          queue.push(v);
        }
      }
    }

    if (visitedCount < graph.nodes.size) {
      errors.push({
        code: 'CIRCULAR_DEPENDENCY_DETECTED',
        message: 'The schedule graph contains circular dependencies (cycles).',
      });
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}
