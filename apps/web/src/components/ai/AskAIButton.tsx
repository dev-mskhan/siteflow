/**
 * AskAIButton — reusable button that opens the AI chat slide-over.
 *
 * Drop this on any page to give users an in-context AI assistant.
 * The slide-over opens pre-scoped to the specified agent with an
 * optional pre-filled question.
 *
 * Usage:
 *   <AskAIButton agent="cost-financial" agentLabel="Cost & Finance" />
 *   <AskAIButton agent="cost-financial" agentLabel="Cost & Finance" prefillQuestion="What is the budget variance?" />
 */
import React, { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { AIChatSlideOver } from './AIChatSlideOver';
import { useOrgContext } from '../../features/org/useOrgContext';
import { useParams } from 'react-router-dom';

interface AskAIButtonProps {
  agent: string;
  agentLabel: string;
  prefillQuestion?: string;
  projectId?: string;
  variant?: 'button' | 'icon' | 'link';
  label?: string;
}

export const AskAIButton: React.FC<AskAIButtonProps> = ({
  agent,
  agentLabel,
  prefillQuestion,
  projectId,
  variant = 'button',
  label = 'Ask AI',
}) => {
  const [open, setOpen] = useState(false);
  const { org } = useOrgContext();
  const params = useParams<{ orgId: string; projectId: string }>();
  const orgId = org?.id ?? params.orgId ?? '';
  const activeProjectId = projectId ?? params.projectId;

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setOpen(true);
  };

  if (variant === 'icon') {
    return (
      <>
        <button
          onClick={handleClick}
          className="flex h-8 w-8 items-center justify-center border border-[var(--hairline-2)] bg-[var(--paper)] transition-colors hover:border-[var(--ink)] hover:bg-[var(--ink)] hover:text-white"
          title={`Ask ${agentLabel}`}
        >
          <Sparkles className="h-4 w-4" strokeWidth={1.6} />
        </button>
        <AIChatSlideOver
          open={open}
          onClose={() => setOpen(false)}
          orgId={orgId}
          agent={agent}
          agentLabel={agentLabel}
          prefillQuestion={prefillQuestion}
          projectId={activeProjectId}
        />
      </>
    );
  }

  if (variant === 'link') {
    return (
      <>
        <button
          onClick={handleClick}
          className="group inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--muted)] transition-colors hover:text-[var(--ink)]"
        >
          <Sparkles className="h-3.5 w-3.5" strokeWidth={1.8} />
          {label}
        </button>
        <AIChatSlideOver
          open={open}
          onClose={() => setOpen(false)}
          orgId={orgId}
          agent={agent}
          agentLabel={agentLabel}
          prefillQuestion={prefillQuestion}
          projectId={activeProjectId}
        />
      </>
    );
  }

  // Default: button variant
  return (
    <>
      <button
        onClick={handleClick}
        className="inline-flex items-center gap-1.5 border border-[var(--hairline-2)] bg-[var(--paper)] px-3 py-1.5 text-sm text-[var(--muted)] transition-colors hover:border-[var(--ink)] hover:bg-[var(--ink)] hover:text-white"
      >
        <Sparkles className="h-3.5 w-3.5" strokeWidth={1.8} />
        {label}
      </button>
      <AIChatSlideOver
        open={open}
        onClose={() => setOpen(false)}
        orgId={orgId}
        agent={agent}
        agentLabel={agentLabel}
        prefillQuestion={prefillQuestion}
        projectId={activeProjectId}
      />
    </>
  );
};
