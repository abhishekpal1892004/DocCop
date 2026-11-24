import { createContext, useCallback, useContext, useState } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback(
    ({ title, description, variant = 'info', duration = 4500 }) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      setToasts((prev) => [...prev, { id, title, description, variant }]);
      if (duration > 0) {
        setTimeout(() => removeToast(id), duration);
      }
      return id;
    },
    [removeToast]
  );

  return (
    <ToastContext.Provider value={{ addToast, removeToast }}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="true"
        className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-[calc(100vw-2rem)] pointer-events-none"
      >
        {toasts.map((toast) => {
          const Icon =
            toast.variant === 'success'
              ? CheckCircle2
              : toast.variant === 'error'
                ? AlertCircle
                : Info;
          const borderTone =
            toast.variant === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-950'
              : toast.variant === 'error'
                ? 'border-red-200 bg-red-50 text-red-950'
                : 'border-slate-200 bg-white text-slate-900';

          return (
            <div
              key={toast.id}
              role="status"
              className={`pointer-events-auto rounded-xl border shadow-lg p-3.5 flex items-start gap-3 ${borderTone}`}
            >
              <Icon className="w-5 h-5 shrink-0 mt-0.5" aria-hidden="true" />
              <div className="flex-1 min-w-0 text-sm">
                {toast.title && <p className="font-semibold">{toast.title}</p>}
                {toast.description && <p className="text-xs opacity-90 mt-0.5">{toast.description}</p>}
              </div>
              <button
                type="button"
                onClick={() => removeToast(toast.id)}
                aria-label="Dismiss notification"
                className="p-1 rounded-md hover:bg-black/5"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return ctx;
}
