import { AlertTriangle, Inbox } from 'lucide-react';
import { Button } from './Button';
import { Skeleton } from './Skeleton';
import { Card, CardBody } from './Card';

export function EmptyState({ icon: Icon = Inbox, title, description, action, className = '' }) {
  return (
    <Card className={className}>
      <CardBody className="py-12 px-6 text-center flex flex-col items-center">
        <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center mb-3">
          <Icon className="w-6 h-6" aria-hidden="true" />
        </div>
        <h3 className="text-base font-semibold text-slate-900">{title}</h3>
        {description && <p className="text-sm text-slate-500 max-w-md mt-1">{description}</p>}
        {action && <div className="mt-4">{action}</div>}
      </CardBody>
    </Card>
  );
}

export function ErrorState({ title = 'Something went wrong', message, onRetry, className = '' }) {
  return (
    <Card className={`border-red-200 ${className}`}>
      <CardBody className="py-10 px-6 text-center flex flex-col items-center" role="alert">
        <div className="w-12 h-12 rounded-full bg-red-50 text-red-600 flex items-center justify-center mb-3">
          <AlertTriangle className="w-6 h-6" aria-hidden="true" />
        </div>
        <h3 className="text-base font-semibold text-slate-900">{title}</h3>
        {message && <p className="text-sm text-slate-600 max-w-md mt-1">{message}</p>}
        {onRetry && (
          <Button variant="outline" size="sm" onClick={onRetry} className="mt-4">
            Try again
          </Button>
        )}
      </CardBody>
    </Card>
  );
}

export function LoadingState({ rows = 4, label = 'Loading content...' }) {
  return (
    <div role="status" aria-live="polite" className="space-y-3">
      <span className="sr-only">{label}</span>
      {Array.from({ length: rows }).map((_, idx) => (
        <Card key={idx}>
          <CardBody className="space-y-2.5">
            <Skeleton className="h-5 w-1/3" />
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-4 w-1/2" />
          </CardBody>
        </Card>
      ))}
    </div>
  );
}
