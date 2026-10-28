import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, AlertTriangle, Info, X } from 'lucide-react';
import { cn } from '../../lib/cn';
import { slideDown } from '../../lib/motion';

export type ToastType = 'success' | 'error' | 'info';

export interface ToastMessage {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
}

interface InlineFieldError {
  id: string;
  root: HTMLElement;
  control: HTMLElement;
  mount: HTMLDivElement;
  message: string;
  previousInvalid: string | null;
  previousDescription: string | null;
}

function normalized(value: string): string {
  return value.toLocaleLowerCase().replace(/[^a-z0-9]/g, '');
}

function findInlineErrors(
  root: HTMLElement,
  title: string,
  message: string | undefined,
): InlineFieldError[] {
  const controls = Array.from(
    root.querySelectorAll<HTMLElement>(
      'input:not([type="hidden"]), select, textarea, [role="combobox"]',
    ),
  ).filter(
    (control) =>
      (!('disabled' in control) || !control.disabled) &&
      (!('readOnly' in control) || !control.readOnly),
  );
  const text = `${title} ${message ?? ''}`;
  const searchableText = normalized(text);
  const isRequired = /\b(required|missing|too_small)\b/i.test(text);
  const allFields = /\ball fields\b/i.test(text);
  const invalidFormat = /\b(invalid|must be|valid json|format)\b/i.test(text);
  const getLabel = (control: HTMLElement) =>
    (control instanceof HTMLInputElement ||
    control instanceof HTMLSelectElement ||
    control instanceof HTMLTextAreaElement
      ? control.labels?.[0]?.textContent?.trim()
      : undefined) ||
    control.closest<HTMLElement>('[data-form-field]')?.querySelector('label')?.textContent?.trim() ||
    control.parentElement?.querySelector('label')?.textContent?.trim() ||
    control.getAttribute('aria-label') ||
    control.getAttribute('placeholder') ||
    ('name' in control && typeof control.name === 'string' ? control.name : '');
  const isEmpty = (control: HTMLElement) => {
    if (control instanceof HTMLInputElement && control.type === 'checkbox') return !control.checked;
    if (control instanceof HTMLInputElement && control.type === 'file') return !control.files?.length;
    if (control instanceof HTMLInputElement || control instanceof HTMLSelectElement || control instanceof HTMLTextAreaElement) {
      return !control.value.trim();
    }
    return /^select(?:\s|…|$)/i.test(control.textContent?.trim() ?? '');
  };
  const targeted = controls.filter((control) => {
    const label = getLabel(control);
    const labelKey = normalized(label);
    const labelWords = label.split(/\s+/).map(normalized).filter((word) => word.length > 2);
    const relevant =
      allFields ||
      (!!labelKey && searchableText.includes(labelKey)) ||
      labelWords.some((word) => searchableText.includes(word));
    const requiredAndEmpty =
      isRequired && 'required' in control && Boolean(control.required) && isEmpty(control);
    return (relevant && (isEmpty(control) || invalidFormat)) || requiredAndEmpty;
  });
  const targets =
    targeted.length > 0
      ? targeted
      : isRequired
        ? controls.filter((control) => {
            return (
              'required' in control &&
              Boolean(control.required) &&
              isEmpty(control)
            );
          })
        : [];

  return targets.flatMap((control) => {
    const field = control.closest<HTMLElement>('[data-form-field]') ?? control.parentElement;
    if (!field) return [];
    const label = getLabel(control) || 'This field';
    const id = `field-error-${Math.random().toString(36).slice(2, 10)}`;
    const mount = document.createElement('div');
    field.appendChild(mount);
    const previousDescription = control.getAttribute('aria-describedby');
    const previousInvalid = control.getAttribute('aria-invalid');
    control.setAttribute('aria-invalid', 'true');
    control.setAttribute(
      'aria-describedby',
      [previousDescription, id].filter(Boolean).join(' '),
    );
    return [
      {
        id,
        root,
        control,
        mount,
        previousInvalid,
        previousDescription,
        message: isRequired ? `${label.replace(/\*/g, '').trim()} is required.` : message ?? title,
      },
    ];
  });
}

function findValidationRoot(
  activeElement: HTMLElement | null,
  title: string,
  message: string | undefined,
): HTMLElement | null {
  if (!activeElement) return null;
  const rawText = `${title} ${message ?? ''}`;
  if (!/\b(required|missing|invalid|validation|must be|select a|too_small|valid json)\b/i.test(rawText)) {
    return null;
  }
  const text = normalized(rawText);

  for (let element: HTMLElement | null = activeElement; element; element = element.parentElement) {
    const controls = Array.from(
      element.querySelectorAll<HTMLElement>(
        'input:not([type="hidden"]), select, textarea, [role="combobox"]',
      ),
    );
    if (!controls.length) continue;
    const hasLabeledField = controls.some((control) => {
      const label =
        (control instanceof HTMLInputElement ||
        control instanceof HTMLSelectElement ||
        control instanceof HTMLTextAreaElement
          ? control.labels?.[0]?.textContent
          : undefined) ||
        control.closest<HTMLElement>('[data-form-field]')?.querySelector('label')?.textContent ||
        control.parentElement?.querySelector('label')?.textContent ||
        control.getAttribute('aria-label') ||
        control.getAttribute('placeholder') ||
        ('name' in control && typeof control.name === 'string' ? control.name : '');
      const key = normalized(label);
      return key.length > 2 && text.includes(key);
    });
    const hasRequiredField = controls.some(
      (control) => 'required' in control && Boolean(control.required),
    );
    if (
      hasLabeledField ||
      hasRequiredField ||
      /\ball fields\b/i.test(rawText)
    ) {
      return element;
    }
  }
  return null;
}

interface ToastContextValue {
  showToast: (toast: Omit<ToastMessage, 'id'>) => void;
  success: (title: string, message?: string) => void;
  error: (title: string, message?: string) => void;
  info: (title: string, message?: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [formValidation, setFormValidation] = useState<InlineFieldError[]>([]);

  useEffect(() => {
    const clearOnEdit = (event: Event) => {
      if (!formValidation.some(({ root }) => root.contains(event.target as Node))) {
        return;
      }
      formValidation.forEach(({ control, mount, previousInvalid, previousDescription }) => {
        if (previousInvalid === null) control.removeAttribute('aria-invalid');
        else control.setAttribute('aria-invalid', previousInvalid);
        if (previousDescription === null) control.removeAttribute('aria-describedby');
        else control.setAttribute('aria-describedby', previousDescription);
        mount.remove();
      });
      setFormValidation([]);
    };
    document.addEventListener('input', clearOnEdit, true);
    document.addEventListener('change', clearOnEdit, true);
    return () => {
      document.removeEventListener('input', clearOnEdit, true);
      document.removeEventListener('change', clearOnEdit, true);
      formValidation.forEach(({ mount }) => mount.remove());
    };
  }, [formValidation]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (toast: Omit<ToastMessage, 'id'>) => {
      const looksLikeValidation =
        toast.type === 'error' &&
        /\b(required|missing|invalid|validation|must be|select a|too_small|too_big|invalid_type|invalid_value|valid json)\b/i.test(
          `${toast.title} ${toast.message ?? ''}`,
        );
      const activeElement =
        typeof document !== 'undefined' && document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;

      const validationRoot = looksLikeValidation
        ? findValidationRoot(activeElement, toast.title, toast.message)
        : null;
      if (validationRoot) {
        const errors = findInlineErrors(validationRoot, toast.title, toast.message);
        if (errors.length > 0) {
          formValidation.forEach(({ mount }) => mount.remove());
          setFormValidation(errors);
          return;
        }
      }

      const id = Math.random().toString(36).substring(2, 9);
      const newToast: ToastMessage = { ...toast, id };
      setToasts((prev) => [...prev, newToast]);

      const duration = toast.duration ?? 4000;
      setTimeout(() => {
        removeToast(id);
      }, duration);
    },
    [removeToast]
  );

  const success = useCallback(
    (title: string, message?: string) => showToast({ type: 'success', title, message }),
    [showToast]
  );
  const error = useCallback(
    (title: string, message?: string) => showToast({ type: 'error', title, message }),
    [showToast]
  );
  const info = useCallback(
    (title: string, message?: string) => showToast({ type: 'info', title, message }),
    [showToast]
  );

  return (
    <ToastContext.Provider value={{ showToast, success, error, info }}>
      {children}
      {formValidation.map(({ id, mount, message }) =>
        mount.isConnected
          ? createPortal(
              <p
                id={id}
                role="alert"
                aria-live="polite"
                className="mt-1 font-mono text-[10px] leading-relaxed text-[var(--color-status-delayed)]"
              >
                {message}
              </p>,
              mount,
              id,
            )
          : null,
      )}
      <div
        aria-live="polite"
        className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none"
      >
        <AnimatePresence>
          {toasts.map((toast) => {
            const icons = {
              success: <CheckCircle2 className="w-4 h-4 text-status-ontrack" />,
              error: <AlertTriangle className="w-4 h-4 text-status-delayed" />,
              info: <Info className="w-4 h-4 text-accent" />,
            };

            const borderColors = {
              success: 'border-status-ontrack-border',
              error: 'border-status-delayed-border',
              info: 'border-accent-border',
            };

            return (
              <motion.div
                key={toast.id}
                variants={slideDown}
                initial="hidden"
                animate="visible"
                exit="hidden"
                className={cn(
                  'pointer-events-auto p-3.5 rounded-md border bg-surface text-text shadow-elevated flex items-start justify-between gap-3',
                  borderColors[toast.type]
                )}
              >
                <div className="flex items-start gap-2.5">
                  <span className="shrink-0 mt-0.5">{icons[toast.type]}</span>
                  <div>
                    <h4 className="font-heading text-xs font-bold text-text">
                      {toast.title}
                    </h4>
                    {toast.message && (
                      <p className="text-[11px] text-text-muted mt-0.5 leading-snug">
                        {toast.message}
                      </p>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => removeToast(toast.id)}
                  className="text-text-subtle hover:text-text p-0.5 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
};

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}
