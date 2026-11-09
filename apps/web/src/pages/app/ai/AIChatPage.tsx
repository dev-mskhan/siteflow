import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import {
  Sparkles,
  Send,
  TrendingDown,
  Truck,
  ShieldCheck,
  Calculator,
  FileCheck2,
  Loader2,
} from 'lucide-react';
import {
  useListConversationsQuery,
  useCreateConversationMutation,
  useListMessagesQuery,
  useSendMessageMutation,
} from '../../../features/ai/aiApi';
import { useOrgContext } from '../../../features/org/useOrgContext';

const AGENTS = [
  { id: 'cost-financial', name: 'Cost & Finance', icon: TrendingDown, desc: 'Budget, cost, billing, cash flow' },
  { id: 'procurement', name: 'Procurement', icon: Truck, desc: 'Purchase orders, quotes, deliveries' },
  { id: 'compliance', name: 'Safety & Compliance', icon: ShieldCheck, desc: 'Inspections, incidents, permits' },
  { id: 'estimating-boq', name: 'Estimating & BOQ', icon: Calculator, desc: 'Quantities, takeoffs, cost codes' },
  { id: 'reports', name: 'Reports', icon: FileCheck2, desc: 'Executive summaries and exports' },
];

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

export const AIChatPage: React.FC = () => {
  const { orgId } = useParams<{ orgId: string }>();
  const { org } = useOrgContext();
  const [selectedAgent, setSelectedAgent] = useState('cost-financial');
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: conversations } = useListConversationsQuery({ orgId: orgId! }, { skip: !orgId });
  const [createConversation] = useCreateConversationMutation();
  const { data: messages, refetch: refetchMessages } = useListMessagesQuery(
    { orgId: orgId!, conversationId: activeConversationId! },
    { skip: !activeConversationId, pollingInterval: 3000 },
  );
  const [sendMessage] = useSendMessageMutation();

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Poll for updates when waiting for AI response
  useEffect(() => {
    if (sending && activeConversationId) {
      const interval = setInterval(() => refetchMessages(), 2000);
      const timeout = setTimeout(() => {
        clearInterval(interval);
        setSending(false);
      }, 60000);
      return () => {
        clearInterval(interval);
        clearTimeout(timeout);
      };
    }
  }, [sending, activeConversationId, refetchMessages]);

  const handleSend = async () => {
    if (!input.trim() || !orgId) return;

    let convId = activeConversationId;

    // Create conversation if none active
    if (!convId) {
      try {
        const conv = await createConversation({
          orgId,
          agent: selectedAgent,
          title: input.slice(0, 50),
        }).unwrap();
        convId = conv.id;
        setActiveConversationId(convId);
      } catch {
        return;
      }
    }

    setSending(true);
    setInput('');

    try {
      await sendMessage({ orgId, conversationId: convId!, content: input.trim() }).unwrap();
    } catch {
      setSending(false);
    }
  };

  const activeAgent = AGENTS.find((a) => a.id === selectedAgent);

  return (
    <div className="flex h-full">
      {/* ── Left: conversation list ─────────────────────────────────────────── */}
      <div className="hidden w-64 shrink-0 flex-col border-r border-[var(--hairline-2)] bg-[var(--surface)] md:flex">
        <div className="border-b border-[var(--hairline-2)] px-4 py-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">
            Conversations
          </p>
        </div>
        <div className="flex-1 overflow-y-auto">
          {conversations && conversations.length > 0 ? (
            conversations.map((conv) => (
              <button
                key={conv.id}
                onClick={() => setActiveConversationId(conv.id)}
                className={`w-full border-b border-[var(--hairline)] px-4 py-3 text-left transition-colors hover:bg-[var(--surface-2)] ${
                  activeConversationId === conv.id ? 'bg-[var(--surface-2)]' : ''
                }`}
              >
                <p className="truncate text-sm font-medium text-[var(--ink)]">{conv.title}</p>
                <div className="mt-1 flex items-center gap-2">
                  <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)]">
                    {conv.agent}
                  </span>
                  <span className="font-mono text-[9px] text-[var(--muted)]">
                    {formatTime(conv.updatedAt)}
                  </span>
                </div>
              </button>
            ))
          ) : (
            <div className="px-4 py-8 text-center">
              <p className="text-xs text-[var(--muted)]">No conversations yet</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Right: chat area ─────────────────────────────────────────────────── */}
      <div className="flex flex-1 flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--hairline-2)] px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center bg-[var(--ink)]">
              {activeAgent && (
                <activeAgent.icon className="h-4 w-4 text-white" strokeWidth={1.6} />
              )}
            </div>
            <div>
              <p className="text-sm font-medium text-[var(--ink)]">
                {activeAgent?.name ?? 'AI Assistant'}
              </p>
              <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)]">
                {activeAgent?.desc}
              </p>
            </div>
          </div>

          {/* Agent selector */}
          <select
            value={selectedAgent}
            onChange={(e) => {
              setSelectedAgent(e.target.value);
              setActiveConversationId(null);
            }}
            className="border border-[var(--hairline-2)] bg-[var(--paper)] px-3 py-1.5 text-sm text-[var(--ink)] focus:border-[var(--ink)] focus:outline-none"
          >
            {AGENTS.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>

        {/* Messages */}
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
                          AI
                        </span>
                      </div>
                    )}
                    <p className="whitespace-pre-wrap text-sm leading-6 text-[var(--ink)]">
                      {msg.content}
                    </p>
                    <p className="mt-2 font-mono text-[9px] text-[var(--muted)]">
                      {formatTime(msg.createdAt)}
                    </p>
                  </div>
                </div>
              ))}
              {sending && (
                <div className="flex items-center gap-2 text-[var(--muted)]">
                  <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.8} />
                  <span className="text-sm">AI is thinking...</span>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          ) : (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <div className="flex h-12 w-12 items-center justify-center border border-[var(--hairline-2)] bg-[var(--surface-2)]">
                <Sparkles className="h-5 w-5 text-[var(--muted)]" strokeWidth={1.6} />
              </div>
              <h3 className="mt-6 text-lg font-medium text-[var(--ink)]">
                Ask {activeAgent?.name}
              </h3>
              <p className="mt-2 max-w-sm text-sm leading-6 text-[var(--muted)]">
                Type a question about your project and the AI will answer using your live data.
              </p>
              <div className="mt-8 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {[
                  'What is the budget variance on concrete?',
                  'When is the steel delivery expected?',
                  'Show open safety incidents',
                  'How many BOQ items are pending?',
                ].map((q) => (
                  <button
                    key={q}
                    onClick={() => setInput(q)}
                    className="border border-[var(--hairline-2)] bg-[var(--paper)] px-4 py-2.5 text-left text-sm text-[var(--muted)] transition-colors hover:border-[var(--ink)] hover:text-[var(--ink)]"
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
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
              placeholder={`Ask ${activeAgent?.name ?? 'AI'}...`}
              className="flex-1 border border-[var(--hairline-2)] bg-[var(--surface)] px-4 py-2.5 text-sm text-[var(--ink)] placeholder:text-[var(--muted)] focus:border-[var(--ink)] focus:outline-none"
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || sending}
              className="flex h-10 w-10 items-center justify-center bg-[var(--ink)] text-white transition-colors hover:bg-[var(--ink-2)] disabled:opacity-40"
            >
              <Send className="h-4 w-4" strokeWidth={1.8} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
