import { Loader2 } from 'lucide-react';

export function Spinner({ size = 'md', label = 'Loading' }) {
  const sizeClass = size === 'sm' ? 'w-4 h-4' : size === 'lg' ? 'w-8 h-8' : 'w-6 h-6';
  return (
    <span role="status" aria-live="polite" className="inline-flex items-center gap-2 text-teal-700">
      <Loader2 className={`${sizeClass} animate-spin`} aria-hidden="true" />
      <span className="sr-only">{label}</span>
    </span>
  );
}
