import { useEffect, type ReactNode } from 'react';

export interface DialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
}

export function Dialog({ isOpen, onClose, title, description, children, footer }: DialogProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.body.style.overflow = 'unset';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/75 backdrop-blur-sm transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Dialog Box */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
        className="relative z-10 w-full max-w-lg rounded-2xl border p-6 text-text shadow-2xl transition-all"
        style={{
          backgroundColor: 'var(--surface)',
          borderColor: 'var(--border)',
        }}
      >
        <div className="flex items-start justify-between pb-3">
          <div>
            <h2 id="dialog-title" className="text-lg font-bold text-text">
              {title}
            </h2>
            {description && <p className="text-sm text-text-muted mt-1">{description}</p>}
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-text-muted hover:text-text hover:bg-surface-2 transition-colors"
            aria-label="Close dialog"
          >
            ✕
          </button>
        </div>

        <div className="py-3">{children}</div>

        {footer && <div className="mt-4 flex items-center justify-end gap-3 pt-3 border-t border-border">{footer}</div>}
      </div>
    </div>
  );
}
