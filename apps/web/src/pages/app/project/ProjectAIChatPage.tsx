/**
 * ProjectAIChatPage — /org/:orgId/projects/:projectId/ai
 *
 * In-project AI chat scoped to the active project.
 * Shows contextual quick-questions based on the project data.
 * Opens full-screen chat for the selected agent.
 */
import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import {
  Sparkles,
  TrendingDown,
  Truck,
  ShieldCheck,
  Calculator,
  FileCheck2,
  Send,
  Loader2,
} from 'lucide-react';
import {
  useCreateConversationMutation,
  useListMessagesQuery,
  useSendMessageMutation,
} from '../../../features/ai/aiApi';
import { useActiveProject } from '../../../features/project/useActiveProject';

const AGENTS = [
  {
    id: 'cost-financial',
    name: 'Cost & Finance',
    icon: TrendingDown,
    color: 'group-hover:bg-[#1e40af] group-hover:text-white',
    questions: [
      'What is the current budget variance?',
      'Show me the financial summary',
      'How much is committed vs actual spend?',
      'What is the cash flow forecast?',
    ],
  },
  {
    id: 'procurement',
    name: 'Procurement',
    icon: Truck,
    color: 'group-hover:bg-[#166534] group-hover:text-white',
    questions: [
      'Show all open purchase orders',
      'Which deliveries are pending?',
      'Compare quotes for this project',
      'What materials are overdue?',
    ],
  },
  {
    id: 'compliance',
    name: 'Safety & Compliance',
    icon: ShieldCheck,
    color: 'group-hover:bg-[#92400e] group-hover:text-white',
    questions: [
      'Show all open safety incidents',
      'Which permits are expiring soon?',
      'List recent quality inspections',
      'Are there any corrective actions outstanding?',
    ],
  },
  {
    id: 'estimating-boq',
    name: 'Estimating & BOQ',
    icon: Calculator,
    color: 'group-hover:bg-[#1e40af] group-hover:text-white',
    questions: [
      'How many BOQ items are pending approval?',
      'Show the latest takeoff revision',
      'List all cost codes with overruns',
      'What is the current estimate total?',
    ],
  },
  {
    id: 'reports',
    name: 'Reports',
    icon: FileCheck2,
    color: 'group-hover:bg-[var(--ink)] group-hover:text-white',
    questions: [
      'Generate an executive summary',
      'What is the project health status?',
      'Show me the schedule variance report',
      'Summarize procurement performance',
    ],
  },
];

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

export const ProjectAIChatPage: React.FC = () => {
  const { orgId, projectId } = useParams<{ orgId: string; projectId: string }>();
  const { activeProject } = useActiveProject();
  const [selectedAgent, setSelectedAgent] = useState(AGENTS[0]!);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [createConversation] = useCreateConversationMutation();
  const { data: messages, refetch } = useListMessagesQuery(
    { orgId: orgId!, conversationId: conversationId! },
    { skip: !conversationId, pollingInterval: 2000 },
  );
  const [sendMessage] = useSendMessageMutation();

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Poll while AI is working
  useEffect(() => {
    if (sending && conversationId) {
      const interval = setInterval(() => refetch(), 2000);
      const timeout = setTimeout(() => {
        clearInterval(interval);
        setSending(false);
      }, 60000);
      return () => {
        clearInterval(interval);
        clearTimeout(timeout);
      };
    }
  }, [sending, conversationId, refetch]);

  // Reset conversation when agent changes
  const handleAgentSelect = (agent: typeof AGENTS[0]) => {
    setSelectedAgent(agent);
    setConversationId(null);
    setSending(false);
  };

  const handleSend = async (content: string) => {
    if (!content.trim() || !orgId || !projectId) return;

    let convId = conversationId;
    if (!convId) {
      try {
        const conv = await createConversation({
          orgId,
          agent: selectedAgent.id,
          projectId,
          title: content.slice(0, 50),
        }).unwrap();
        convId = conv.id;
        setConversationId(convId);
      } catch {
        return;
      }
    }

    setSending(true);
    setInput('');

    try {
      await sendMessage({
        orgId,
        conversationId: convId!,
        content: content.trim(),
      }).unwrap();
    } catch {
      setSending(false);
    }
  };

  const AgentIcon = selectedAgent.icon;

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b border-[var(--hairline-2)] bg-[var(--paper)] px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center bg-[var(--ink)]">
              <Sparkles className="h-4 w-4 text-white" strokeWidth={1.8} />
            </div>
            <div>
              <p className="text-sm font-medium text-[var(--ink)]">AI Assistant</p>
              <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)]">
                {activeProject?.name}
              </p>
            </div>
          </div>
        </div>

        {/* Agent selector tabs */}
        <div className="mt-4 flex flex-wrap gap-1.5">
          {AGENTS.map((agent) => {
            const Icon = agent.icon;
            const isActive = selectedAgent.id === agent.id;
            return (
              <button
                key={agent.id}
                onClick={() => handleAgentSelect(agent)}
                className={`flex items-center gap-1.5 border px-3 py-1.5 transition-colors ${
                  isActive
                    ? 'border-[var(--ink)] bg-[var(--ink)] text-white'
                    : 'border-[var(--hairline-2)] bg-[var(--paper)] text-[var(--muted)] hover:border-[var(--ink)] hover:text-[var(--ink)]'
                }`}
              >
                <Icon className="h-3.5 w-3.5" strokeWidth={1.6} />
                <span className="text-xs font-medium">{agent.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Messages or quick-start */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        {messages && messages.length > 0 ? (
          <div className="mx-auto max-w-3xl space-y-4">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] px-4 py-3 ${
                    msg.role === 'user'
                      ? 'border border-[var(--hairline-2)] bg-[var(--surface-2)]'
                      : 'border border-[var(--hairline-2)] bg-[var(--paper)]'
                  }`}
                >
                  {msg.role === 'assistant' && (
                    <div className="mb-2 flex items-center gap-1.5">
                      <Sparkles className="h-3 w-3 text-[var(--muted)]" strokeWidth={1.8} />
                      <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)]">
                        {selectedAgent.name}
                      </span>
                    </div>
                  )}
                  <p className="whitespace-pre-wrap text-sm leading-6 text-[var(--ink)]">
                    {msg.content}
                  </p>
                  <p className="mt-1.5 font-mono text-[9px] text-[var(--muted)]">
                    {formatTime(msg.createdAt)}
                  </p>
                </div>
              </div>
            ))}
            {sending && (
              <div className="flex items-center gap-2 text-[var(--muted)]">
                <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.8} />
                <span className="text-sm">{selectedAgent.name} is working...</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        ) : (
          /* Quick-start state */
          <div className="mx-auto max-w-3xl">
            <div className="mb-8 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center border border-[var(--hairline-2)] bg-[var(--surface-2)]">
                <AgentIcon className="h-4 w-4 text-[var(--muted)]" strokeWidth={1.6} />
              </div>
              <div>
                <p className="text-sm font-medium text-[var(--ink)]">
                  Ask {selectedAgent.name}
                </p>
                <p className="text-sm text-[var(--muted)]">
                  Questions will use data from{' '}
                  <strong className="font-medium text-[var(--ink)]">
                    {activeProject?.name}
                  </strong>
                </p>
              </div>
            </div>

            {/* Quick questions */}
            <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">
              Quick questions
            </p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {selectedAgent.questions.map((q) => (
                <button
                  key={q}
                  onClick={() => handleSend(q)}
                  className="group border border-[var(--hairline-2)] bg-[var(--paper)] px-4 py-3 text-left text-sm text-[var(--muted)] transition-colors hover:border-[var(--ink)] hover:text-[var(--ink)]"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Input bar */}
      <div className="border-t border-[var(--hairline-2)] bg-[var(--paper)] px-6 py-4">
        <div className="mx-auto flex max-w-3xl items-center gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend(input)}
            placeholder={`Ask ${selectedAgent.name} about ${activeProject?.name ?? 'this project'}…`}
            className="flex-1 border border-[var(--hairline-2)] bg-[var(--surface)] px-4 py-2.5 text-sm text-[var(--ink)] placeholder:text-[var(--muted)] focus:border-[var(--ink)] focus:outline-none"
          />
          <button
            onClick={() => handleSend(input)}
            disabled={!input.trim() || sending}
            className="flex h-10 w-10 items-center justify-center bg-[var(--ink)] text-white transition-colors hover:bg-[var(--ink-2)] disabled:opacity-40"
          >
            <Send className="h-4 w-4" strokeWidth={1.8} />
          </button>
        </div>
      </div>
    </div>
  );
};
