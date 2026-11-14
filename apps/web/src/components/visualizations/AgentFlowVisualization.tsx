import React, { useCallback } from 'react';
import {
  ReactFlow,
  Node,
  Edge,
  Controls,
  Background,
  BackgroundVariant,
  useNodesState,
  useEdgesState,
  MiniMap,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { TrendingDown, Truck, ShieldCheck, Calculator, FileCheck2, MessageSquare } from 'lucide-react';

const iconMap = {
  cost: TrendingDown,
  procurement: Truck,
  safety: ShieldCheck,
  estimating: Calculator,
  reports: FileCheck2,
  user: MessageSquare,
};

// Custom Node Component
const AgentNode = ({ data }: { data: any }) => {
  const Icon = iconMap[data.icon as keyof typeof iconMap] || MessageSquare;
  
  return (
    <div
      className={`px-5 py-4 shadow-lg rounded-md border-2 ${
        data.type === 'user'
          ? 'bg-[var(--action)] border-[var(--action-hover)] text-white'
          : 'bg-[var(--paper)] border-[var(--hairline-2)] text-[var(--ink)]'
      } min-w-[180px]`}
    >
      <div className="flex items-center gap-3">
        <div
          className={`flex h-10 w-10 items-center justify-center rounded border ${
            data.type === 'user'
              ? 'border-white/30 bg-white/10'
              : 'border-[var(--hairline-2)] bg-[var(--surface-2)]'
          }`}
        >
          <Icon className="h-5 w-5" strokeWidth={1.6} />
        </div>
        <div className="flex-1">
          <div className={`text-xs font-mono uppercase tracking-wider ${
            data.type === 'user' ? 'text-white/70' : 'text-[var(--muted)]'
          }`}>
            {data.role}
          </div>
          <div className="font-medium text-sm mt-1">{data.label}</div>
        </div>
      </div>
      {data.description && (
        <div className={`mt-3 text-xs leading-5 ${
          data.type === 'user' ? 'text-white/80' : 'text-[var(--muted)]'
        }`}>
          {data.description}
        </div>
      )}
    </div>
  );
};

const nodeTypes = {
  agentNode: AgentNode,
};

const initialNodes: Node[] = [
  {
    id: '1',
    type: 'agentNode',
    position: { x: 250, y: 0 },
    data: {
      label: 'User Question',
      role: 'Input',
      type: 'user',
      icon: 'user',
      description: 'Natural language query',
    },
  },
  {
    id: '2',
    type: 'agentNode',
    position: { x: 50, y: 150 },
    data: {
      label: 'Cost & Finance',
      role: 'Agent',
      icon: 'cost',
      description: 'Budget, billing, cash flow',
    },
  },
  {
    id: '3',
    type: 'agentNode',
    position: { x: 250, y: 150 },
    data: {
      label: 'Procurement',
      role: 'Agent',
      icon: 'procurement',
      description: 'Orders, quotes, deliveries',
    },
  },
  {
    id: '4',
    type: 'agentNode',
    position: { x: 450, y: 150 },
    data: {
      label: 'Safety',
      role: 'Agent',
      icon: 'safety',
      description: 'Inspections, incidents',
    },
  },
  {
    id: '5',
    type: 'agentNode',
    position: { x: 150, y: 300 },
    data: {
      label: 'Estimating',
      role: 'Agent',
      icon: 'estimating',
      description: 'BOQ, quantities',
    },
  },
  {
    id: '6',
    type: 'agentNode',
    position: { x: 350, y: 300 },
    data: {
      label: 'Reports',
      role: 'Agent',
      icon: 'reports',
      description: 'Summaries, exports',
    },
  },
  {
    id: '7',
    type: 'agentNode',
    position: { x: 250, y: 450 },
    data: {
      label: 'Response',
      role: 'Output',
      type: 'user',
      icon: 'user',
      description: 'Cited answer with data',
    },
  },
];

const initialEdges: Edge[] = [
  { id: 'e1-2', source: '1', target: '2', animated: true, style: { stroke: 'var(--action)' } },
  { id: 'e1-3', source: '1', target: '3', animated: true, style: { stroke: 'var(--action)' } },
  { id: 'e1-4', source: '1', target: '4', animated: true, style: { stroke: 'var(--action)' } },
  { id: 'e2-5', source: '2', target: '5', animated: true },
  { id: 'e3-5', source: '3', target: '5', animated: true },
  { id: 'e4-6', source: '4', target: '6', animated: true },
  { id: 'e5-7', source: '5', target: '7', animated: true, style: { stroke: 'var(--action)' } },
  { id: 'e6-7', source: '6', target: '7', animated: true, style: { stroke: 'var(--action)' } },
];

export const AgentFlowVisualization: React.FC = () => {
  const [nodes, , onNodesChange] = useNodesState(initialNodes);
  const [edges, , onEdgesChange] = useEdgesState(initialEdges);

  return (
    <div className="h-[600px] w-full border border-[var(--hairline-2)] bg-[var(--surface-2)] rounded-lg overflow-hidden">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        fitView
        attributionPosition="bottom-left"
      >
        <Background variant={BackgroundVariant.Dots} gap={16} size={1} color="var(--hairline)" />
        <Controls className="bg-[var(--paper)] border-[var(--hairline-2)]" />
        <MiniMap
          className="bg-[var(--surface)] border-[var(--hairline-2)]"
          nodeColor={() => 'var(--action)'}
        />
      </ReactFlow>
    </div>
  );
};
