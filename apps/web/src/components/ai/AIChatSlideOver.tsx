/**
 * AIChatSlideOver — right-side slide-over panel with a mini AI chat.
 *
 * Opens with a dark backdrop + right-side panel that slides in from the right.
 * Pre-scoped to a specific agent and optional pre-filled question.
 *
 * Theme: matches existing design (hairline borders, mono labels, zero radius,
 * surface/paper/ink tokens, framer-motion slide animation like mobile sidebar).
 */
import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Send, Sparkles, Loader2 } from 'lucide-react';
import {
  useCreateConversationMutation,
  useListMessagesQuery,
  useSendMessageMutation,
} from '../../features/ai/aiApi';
import { useToast } from '../ui/Toast';

interface AIChatSlideOverProps {
  open: boolean;
  onClose: () => void;
  orgId: string;
  agent: string;
  agentLabel: string;
  prefillQuestion?: string;
  projectId?: string;
}

export const AIChatSlideOver: React.FC<AIChatSlideOverProps> = ({
  open,
  onClose,
  orgId,
  agent,
  agentLabel,
  prefillQuestion,
  projectId,
}) => {
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [hasInitiated, setHasInitiated] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { error: toastError } = useToast();

  const [createConversation] = useCreateConversationMutation();
  const { data: messages, refetch } = useListMessagesQuery(
    { orgId, conversationId: conversationId! },
    { skip: !conversationId, pollingInterval: 2000 },
  );
  const [sendMessage] = useSendMessageMutation();

  // Pre-fill input when opened
  useEffect(() => {
    if (open && prefillQuestion && !hasInitiated) {
      setInput(prefillQuestion);
      setHasInitiated(true);
    }
    if (!open) {
      setHasInitiated(false);
      setConversationId(null);
      setSending(false);
    }
  }, [open, prefillQuestion, hasInitiated]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Poll while sending
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

  // Lock scroll
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  const handleSend = async () => {
    if (!input.trim() || sending) return;

    let convId = conversationId;
    if (!convId) {
      try {
        const conv = await createConversation({
          orgId,
          agent,
          projectId,
          title: input.slice(0, 50),
        }).unwrap();
        convId = conv.id;
        setConversationId(convId);
      } catch {
        toastError?.('Failed to start conversation');
        return;
      }
    }

    setSending(true);
    const content = input.trim();
    setInput('');

    try {
      await sendMessage({ orgId, conversationId: convId!, content }).unwrap();
    } catch {
      toastError?.('Failed to send message');
      setSending(false);
    }
  };

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            key="ai-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-black/30"
          />

          {/* Panel */}
          <motion.aside
            key="ai-slideover"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'tween', duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="fixed right-0 top-0 z-50 flex h-dvh w-full max-w-[440px] flex-col border-l border-[var(--hairline-2)] bg-[var(--paper)]"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[var(--hairline-2)] px-4 py-3">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center bg-[var(--ink)]">
                  <Sparkles className="h-3.5 w-3.5 text-white" strokeWidth={1.8} />
                </div>
                <div>
                  <p className="text-sm font-medium text-[var(--ink)]">{agentLabel}</p>
                  <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)]">
                    AI Assistant
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-1 text-[var(--muted)] transition-colors hover:text-[var(--ink)]"
              >
                <X className="h-4 w-4" strokeWidth={1.8} />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-4">
              {messages && messages.length > 0 ? (
                <div className="space-y-3">
                  {messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[85%] px-3 py-2.5 text-sm leading-6 ${
                          msg.role === 'user'
                            ? 'border border-[var(--hairline-2)] bg-[var(--surface-2)] text-[var(--ink)]'
                            : 'border border-[var(--hairline-2)] bg-[var(--paper)] text-[var(--ink)]'
                        }`}
                      >
                        {msg.role === 'assistant' && (
                          <div className="mb-1.5 flex items-center gap-1">
                            <Sparkles className="h-3 w-3 text-[var(--muted)]" strokeWidth={1.8} />
                            <span className="font-mono text-[8px] uppercase tracking-[0.14em] text-[var(--muted)]">
                              AI
                            </span>
                          </div>
                        )}
                        <p className="whitespace-pre-wrap">{msg.content}</p>
                      </div>
                    </div>
                  ))}
                  {sending && (
                    <div className="flex items-center gap-1.5 text-[var(--muted)]">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.8} />
                      <span className="text-xs">AI is thinking...</span>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>
              ) : (
                <div className="flex h-full flex-col items-center justify-center text-center">
                  <div className="flex h-10 w-10 items-center justify-center border border-[var(--hairline-2)] bg-[var(--surface-2)]">
                    <Sparkles className="h-4 w-4 text-[var(--muted)]" strokeWidth={1.6} />
                  </div>
                  <p className="mt-4 text-sm text-[var(--muted)]">
                    Ask {agentLabel} anything about this page.
                  </p>
                </div>
              )}
            </div>

            {/* Input */}
            <div className="border-t border-[var(--hairline-2)] px-4 py-3">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
                  placeholder={`Ask ${agentLabel}...`}
                  className="flex-1 border border-[var(--hairline-2)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--ink)] placeholder:text-[var(--muted)] focus:border-[var(--ink)] focus:outline-none"
                />
                <button
                  onClick={handleSend}
                  disabled={!input.trim() || sending}
                  className="flex h-9 w-9 items-center justify-center bg-[var(--ink)] text-white transition-colors hover:bg-[var(--ink-2)] disabled:opacity-40"
                >
                  <Send className="h-3.5 w-3.5" strokeWidth={1.8} />
                </button>
              </div>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
};
