import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { cn } from '../../lib/utils/index';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastMessage {
  id: string;
  title: string;
  description?: string;
  type: ToastType;
}

interface ToastContextType {
  toast: (options: { title: string; description?: string; type?: ToastType }) => void;
  success: (title: string, description?: string) => void;
  error: (title: string, description?: string) => void;
  warning: (title: string, description?: string) => void;
  info: (title: string, description?: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    ({ title, description, type = 'info' }: { title: string; description?: string; type?: ToastType }) => {
      const id = Math.random().toString(36).substring(2, 9);
      const newToast: ToastMessage = { id, title, description, type };
      setToasts((prev) => [...prev, newToast]);

      setTimeout(() => {
        removeToast(id);
      }, 4500);
    },
    [removeToast]
  );

  const success = useCallback((title: string, description?: string) => toast({ title, description, type: 'success' }), [toast]);
  const error = useCallback((title: string, description?: string) => toast({ title, description, type: 'error' }), [toast]);
  const warning = useCallback((title: string, description?: string) => toast({ title, description, type: 'warning' }), [toast]);
  const info = useCallback((title: string, description?: string) => toast({ title, description, type: 'info' }), [toast]);

  return (
    <ToastContext.Provider value={{ toast, success, error, warning, info }}>
      {children}
      {/* Toast Viewport */}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cn(
              'pointer-events-auto flex items-start gap-3 p-4 rounded-xl shadow-lg border card-glass text-text animate-slide-in',
              t.type === 'error' && 'border-red-500/40 bg-red-950/20',
              t.type === 'success' && 'border-emerald-500/40 bg-emerald-950/20',
              t.type === 'warning' && 'border-amber-500/40 bg-amber-950/20',
              t.type === 'info' && 'border-blue-500/40 bg-blue-950/20'
            )}
            style={{
              backgroundColor: 'var(--surface)',
              borderColor: t.type === 'error' ? 'var(--danger)' : t.type === 'success' ? 'var(--success)' : 'var(--border)',
            }}
          >
            <div className="flex-1">
              <h4 className="text-sm font-semibold">{t.title}</h4>
              {t.description && <p className="text-xs text-text-muted mt-0.5">{t.description}</p>}
            </div>
            <button
              onClick={() => removeToast(t.id)}
              className="text-text-muted hover:text-text p-1 text-xs"
              aria-label="Close notification"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextType {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}
