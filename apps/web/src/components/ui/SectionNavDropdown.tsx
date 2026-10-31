import React, { useEffect, useId, useRef, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, ChevronDown } from 'lucide-react';
import { cn } from '../../lib/cn';
import { PermissionGate } from '../guards/PermissionGate';
import type { PermissionKey } from '../../lib/permissions';

export interface SectionNavItem {
  to: string;
  label: string;
  end?: boolean;
  permission?: PermissionKey;
}

export interface SectionNavGroup {
  label: string;
  items: SectionNavItem[];
}

interface SectionNavDropdownProps {
  groups: SectionNavGroup[];
  fallbackTo: string;
  fallbackLabel: string;
  fallbackPermission?: PermissionKey;
}

export const SectionNavDropdown: React.FC<SectionNavDropdownProps> = ({
  groups,
  fallbackTo,
  fallbackLabel,
  fallbackPermission,
}) => {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const optionsId = `section-navigation-${useId()}`;
  const location = useLocation();
  const items = groups.flatMap((group) => group.items);
  const activeItem =
    items.find(({ to, end }) =>
      end ? location.pathname === to : location.pathname === to || location.pathname.startsWith(`${to}/`),
    ) ?? items.find(({ to }) => location.pathname.startsWith(to));
  const activeGroup = groups.find((group) =>
    group.items.some(
      ({ to, end }) =>
        (end && location.pathname === to) ||
        (!end && (location.pathname === to || location.pathname.startsWith(`${to}/`))),
    ),
  )?.label;
  const [expandedGroup, setExpandedGroup] = useState<string | null>(activeGroup ?? null);
  const currentLabel = activeItem?.label ?? fallbackLabel;

  useEffect(() => {
    if (!open) return;
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        rootRef.current?.querySelector('button')?.focus();
      }
    };
    document.addEventListener('pointerdown', closeOnOutsideClick, true);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick, true);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative z-20 border-b border-[var(--hairline-2)] bg-[var(--paper)] px-4 sm:px-8 py-3">
      <div className="flex items-center gap-3">
        <span className="hidden sm:block font-mono text-[9px] uppercase tracking-[0.16em] text-[var(--muted)]">
          Section
        </span>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={optionsId}
          onClick={() => {
            setExpandedGroup(activeGroup ?? groups[0]?.label ?? null);
            setOpen((value) => !value);
          }}
          className={cn(
            'inline-flex min-w-48 max-w-full items-center justify-between gap-6 border border-[var(--hairline-2)] bg-[var(--paper)] px-3 py-2 text-sm text-[var(--ink)]',
            'transition-colors hover:border-[var(--ink)] hover:bg-[var(--surface-2)]',
            'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ink)]',
          )}
        >
          <span className="truncate font-medium">{currentLabel}</span>
          <ChevronDown
            aria-hidden="true"
            className={cn('h-4 w-4 shrink-0 text-[var(--muted)] transition-transform', open && 'rotate-180')}
            strokeWidth={1.8}
          />
        </button>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            id={optionsId}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12 }}
            className="absolute left-4 right-4 sm:left-8 sm:right-auto top-[calc(100%-1px)] z-50 w-auto sm:w-[min(48rem,calc(100vw-4rem))] max-h-[75dvh] overflow-y-auto border border-[var(--ink)] bg-[var(--paper)]"
          >
            <nav aria-label="Page sections">
              <div className="border-b border-[var(--hairline-2)] p-2">
                {fallbackPermission ? (
                  <PermissionGate require={fallbackPermission}>
                    <NavLink
                      to={fallbackTo}
                      end
                      onClick={() => setOpen(false)}
                      className={({ isActive }) =>
                        cn(
                          'flex items-center justify-between gap-3 px-3 py-2 text-sm transition-colors',
                          isActive
                            ? 'bg-[var(--ink)] text-white'
                            : 'text-[var(--ink)] hover:bg-[var(--surface-2)]',
                        )
                      }
                    >
                      {({ isActive }) => (
                        <>
                          <span>{fallbackLabel}</span>
                          {isActive && <Check className="h-3.5 w-3.5" aria-hidden="true" />}
                        </>
                      )}
                    </NavLink>
                  </PermissionGate>
                ) : (
                  <NavLink
                    to={fallbackTo}
                    end
                    onClick={() => setOpen(false)}
                    className={({ isActive }) =>
                      cn(
                        'flex items-center justify-between gap-3 px-3 py-2 text-sm transition-colors',
                        isActive
                          ? 'bg-[var(--ink)] text-white'
                          : 'text-[var(--ink)] hover:bg-[var(--surface-2)]',
                      )
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <span>{fallbackLabel}</span>
                        {isActive && <Check className="h-3.5 w-3.5" aria-hidden="true" />}
                      </>
                    )}
                  </NavLink>
                )}
              </div>
              <div className="divide-y divide-[var(--hairline-2)]">
              {groups.map((group) => (
                <section key={group.label} aria-label={group.label}>
                  <button
                    type="button"
                    aria-expanded={expandedGroup === group.label}
                    onClick={() =>
                      setExpandedGroup((current) =>
                        current === group.label ? null : group.label,
                      )
                    }
                    className="flex w-full items-center justify-between gap-4 px-3 py-2.5 text-left hover:bg-[var(--surface-2)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-[var(--ink)]"
                  >
                    <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--muted)]">
                      {group.label}
                    </span>
                    <span className="text-xs tabular-nums text-[var(--muted)]">
                      {group.items.length}
                    </span>
                  </button>
                  {expandedGroup === group.label && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-0.5 px-2 pb-2">
                      {group.items.map((item) => {
                        const link = (
                          <NavLink
                            key={item.to}
                            to={item.to}
                            end={item.end}
                            onClick={() => setOpen(false)}
                            className={({ isActive }) =>
                              cn(
                                'flex items-center justify-between gap-3 px-3 py-2 text-sm transition-colors',
                                isActive
                                  ? 'bg-[var(--ink)] text-white'
                                  : 'text-[var(--ink)] hover:bg-[var(--surface-2)]',
                              )
                            }
                          >
                            {({ isActive }) => (
                              <>
                                <span className="truncate">{item.label}</span>
                                {isActive && (
                                  <Check className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                                )}
                              </>
                            )}
                          </NavLink>
                        );
                        return item.permission ? (
                          <PermissionGate key={item.to} require={item.permission}>
                            {link}
                          </PermissionGate>
                        ) : (
                          link
                        );
                      })}
                    </div>
                  )}
                </section>
              ))}
              </div>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
