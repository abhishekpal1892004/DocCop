import { AlertCircle, CheckCircle2, Info, AlertTriangle } from 'lucide-react';

const STYLES = {
  info: 'bg-sky-50 border-sky-200 text-sky-900',
  success: 'bg-emerald-50 border-emerald-200 text-emerald-900',
  warning: 'bg-amber-50 border-amber-200 text-amber-900',
  error: 'bg-red-50 border-red-200 text-red-900',
};

const ICONS = {
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  error: AlertCircle,
};

export function Alert({ variant = 'info', title, children, action, className = '' }) {
  const Icon = ICONS[variant] || Info;
  return (
    <div
      role={variant === 'error' || variant === 'warning' ? 'alert' : 'status'}
      className={`rounded-xl border p-4 flex items-start gap-3 ${STYLES[variant] || STYLES.info} ${className}`}
    >
      <Icon className="w-5 h-5 shrink-0 mt-0.5" aria-hidden="true" />
      <div className="flex-1 min-w-0 text-sm">
        {title && <p className="font-semibold mb-0.5">{title}</p>}
        <div className="leading-relaxed">{children}</div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
