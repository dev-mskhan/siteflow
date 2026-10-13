/**
 * CustomSelect — Vault design system
 *
 * Replaces native <select>. Fully keyboard-navigable (↑ ↓ Enter Space Escape Home End).
 * Framer-motion list entrance. No rounded corners, no shadows, no color accents.
 * Controlled via value + onChange so it works with react-hook-form's Controller.
 */

import React, {
  createContext,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  useCallback,
} from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, ChevronDown } from 'lucide-react';
import { cn } from '../../lib/cn';

/* ─── Types ──────────────────────────────────────────────────────────────── */

export interface SelectOption {
  value: string;
  label: string;
  /** Optional mono eyebrow label shown above the main label in the dropdown */
  meta?: string;
}

interface CustomSelectProps {
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  error?: boolean;
  disabled?: boolean;
  id?: string;
  'aria-label'?: string;
}

/* ─── Motion variants ────────────────────────────────────────────────────── */

const listVariants = {
  hidden: { opacity: 0, y: -4, scaleY: 0.97 },
  visible: {
    opacity: 1,
    y: 0,
    scaleY: 1,
    transition: { duration: 0.14, ease: [0.16, 1, 0.3, 1] as const },
  },
  exit: {
    opacity: 0,
    y: -3,
    scaleY: 0.98,
    transition: { duration: 0.1, ease: [0.4, 0, 1, 1] as const },
  },
};

const itemVariants = {
  hidden: { opacity: 0, x: -4 },
  visible: (i: number) => ({
    opacity: 1,
    x: 0,
    transition: { delay: i * 0.018, duration: 0.12, ease: [0.16, 1, 0.3, 1] as const },
  }),
};

/* ─── Component ──────────────────────────────────────────────────────────── */

export const CustomSelect: React.FC<CustomSelectProps> = ({
  options,
  value,
  onChange,
  placeholder = 'Select…',
  error = false,
  disabled = false,
  id,
  'aria-label': ariaLabel,
}) => {
  const uid = useId();
  const triggerId = id ?? `cs-trigger-${uid}`;
  const listboxId = `cs-list-${uid}`;

  const [open, setOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState<number>(-1);

  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const selectedOption = options.find((o) => o.value === value);

  /* ── Close on outside click ─────────────────────────────────────────── */
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  /* ── Scroll focused item into view ─────────────────────────────────── */
  useEffect(() => {
    if (!open || focusedIndex < 0) return;
    const item = listRef.current?.children[focusedIndex] as HTMLElement | undefined;
    item?.scrollIntoView({ block: 'nearest' });
  }, [focusedIndex, open]);

  /* ── Set initial focus index when opening ─────────────────────────── */
  const handleOpen = useCallback(() => {
    if (disabled) return;
    const idx = options.findIndex((o) => o.value === value);
    setFocusedIndex(idx >= 0 ? idx : 0);
    setOpen(true);
  }, [disabled, options, value]);

  /* ── Keyboard handler on trigger ────────────────────────────────────── */
  const handleTriggerKey = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return;
    switch (e.key) {
      case 'Enter':
      case ' ':
        e.preventDefault();
        open ? setOpen(false) : handleOpen();
        break;
      case 'Escape':
        e.preventDefault();
        setOpen(false);
        break;
      case 'ArrowDown':
        e.preventDefault();
        if (!open) {
          handleOpen();
        } else {
          setFocusedIndex((i) => Math.min(i + 1, options.length - 1));
        }
        break;
      case 'ArrowUp':
        e.preventDefault();
        if (!open) {
          handleOpen();
        } else {
          setFocusedIndex((i) => Math.max(i - 1, 0));
        }
        break;
      case 'Home':
        e.preventDefault();
        setFocusedIndex(0);
        break;
      case 'End':
        e.preventDefault();
        setFocusedIndex(options.length - 1);
        break;
    }
  };

  /* ── Select an option ───────────────────────────────────────────────── */
  const select = (optValue: string) => {
    onChange(optValue);
    setOpen(false);
    triggerRef.current?.focus();
  };

  /* ── Keyboard handler on list items ─────────────────────────────────── */
  const handleListKey = (e: React.KeyboardEvent<HTMLUListElement>) => {
    switch (e.key) {
      case 'Enter':
      case ' ':
        e.preventDefault();
        if (focusedIndex >= 0) select(options[focusedIndex].value);
        break;
      case 'Escape':
        e.preventDefault();
        setOpen(false);
        triggerRef.current?.focus();
        break;
      case 'ArrowDown':
        e.preventDefault();
        setFocusedIndex((i) => Math.min(i + 1, options.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setFocusedIndex((i) => Math.max(i - 1, 0));
        break;
      case 'Home':
        e.preventDefault();
        setFocusedIndex(0);
        break;
      case 'End':
        e.preventDefault();
        setFocusedIndex(options.length - 1);
        break;
    }
  };

  return (
    <div ref={containerRef} className="relative w-full">
      {/* ── Trigger ───────────────────────────────────────────────────── */}
      <button
        ref={triggerRef}
        type="button"
        id={triggerId}
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-label={ariaLabel}
        aria-activedescendant={
          open && focusedIndex >= 0 ? `${listboxId}-opt-${focusedIndex}` : undefined
        }
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : handleOpen())}
        onKeyDown={handleTriggerKey}
        className={cn(
          'w-full flex items-center justify-between gap-2',
          'border bg-[var(--paper)] px-3 py-2.5 text-sm text-left',
          'focus:outline focus:outline-2 focus:outline-offset-[-1px] focus:outline-[var(--ink)]',
          'transition-colors duration-[120ms]',
          'disabled:cursor-not-allowed disabled:opacity-50',
          error
            ? 'border-[#fecaca] focus:outline-[#991b1b]'
            : open
            ? 'border-[var(--ink)]'
            : 'border-[var(--hairline-2)]',
        )}
      >
        <span
          className={cn(
            'truncate leading-snug',
            selectedOption ? 'text-[var(--ink)]' : 'text-[var(--muted)]',
          )}
        >
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown
          className={cn(
            'h-4 w-4 shrink-0 text-[var(--muted)] transition-transform duration-[140ms]',
            open && 'rotate-180',
          )}
          strokeWidth={1.8}
        />
      </button>

      {/* ── Dropdown list ─────────────────────────────────────────────── */}
      <AnimatePresence>
        {open && (
          <motion.ul
            ref={listRef}
            key="select-list"
            id={listboxId}
            role="listbox"
            aria-label={ariaLabel}
            tabIndex={-1}
            variants={listVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            onKeyDown={handleListKey}
            style={{ originY: 0 }}
            className={cn(
              'absolute left-0 right-0 z-[100] mt-0.5',
              'max-h-56 overflow-y-auto',
              'border border-[var(--ink)] bg-[var(--paper)]',
              'shadow-none outline-none',
            )}
          >
            {options.map((opt, i) => {
              const isSelected = opt.value === value;
              const isFocused = focusedIndex === i;
              return (
                <motion.li
                  key={opt.value}
                  id={`${listboxId}-opt-${i}`}
                  role="option"
                  aria-selected={isSelected}
                  custom={i}
                  variants={itemVariants}
                  initial="hidden"
                  animate="visible"
                  onClick={() => select(opt.value)}
                  onMouseEnter={() => setFocusedIndex(i)}
                  className={cn(
                    'flex items-start justify-between gap-4 px-3 py-2.5 cursor-pointer',
                    'transition-colors duration-[80ms] select-none',
                    isFocused
                      ? 'bg-[var(--ink)] text-white'
                      : isSelected
                      ? 'bg-[var(--surface-2)] text-[var(--ink)]'
                      : 'text-[var(--ink)] hover:bg-[var(--surface-2)]',
                  )}
                >
                  <div className="min-w-0">
                    {opt.meta && (
                      <p
                        className={cn(
                          'font-mono text-[9px] uppercase tracking-[0.16em] mb-0.5',
                          isFocused ? 'text-white/55' : 'text-[var(--muted)]',
                        )}
                      >
                        {opt.meta}
                      </p>
                    )}
                    <span className="text-sm leading-snug">{opt.label}</span>
                  </div>
                  {isSelected && (
                    <Check
                      className={cn(
                        'h-3.5 w-3.5 shrink-0 mt-0.5',
                        isFocused ? 'text-white' : 'text-[var(--ink)]',
                      )}
                      strokeWidth={2.5}
                    />
                  )}
                </motion.li>
              );
            })}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
};
