import { forwardRef, useId } from 'react';

export const Textarea = forwardRef(function Textarea(
  { label, id, error, hint, required = false, rows = 3, className = '', wrapperClassName = '', ...props },
  ref
) {
  const autoId = useId();
  const textareaId = id || autoId;
  const errorId = `${textareaId}-error`;
  const hintId = `${textareaId}-hint`;
  const describedBy = [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(' ') || undefined;

  return (
    <div className={`space-y-1.5 ${wrapperClassName}`}>
      {label && (
        <label htmlFor={textareaId} className="block text-sm font-medium text-[#1C1917]">
          {label}
          {required && (
            <span className="text-[#991B1B] ml-1" aria-hidden="true">
              *
            </span>
          )}
        </label>
      )}
      <textarea
        ref={ref}
        id={textareaId}
        rows={rows}
        required={required}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={describedBy}
        className={`w-full px-3 py-2.5 rounded-md border bg-white text-sm text-[#1C1917] placeholder:text-[#78716C] transition-colors focus:outline-none focus:ring-2 focus:ring-[#1B4332] focus:border-[#1B4332] disabled:bg-[#F3EFE6] disabled:text-[#57534E] ${
          error ? 'border-[#991B1B] focus:ring-[#991B1B] focus:border-[#991B1B]' : 'border-[#D6CFC2]'
        } ${className}`}
        {...props}
      />
      {hint && !error && (
        <p id={hintId} className="text-xs text-[#57534E]">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} role="alert" className="text-xs font-medium text-[#991B1B]">
          {error}
        </p>
      )}
    </div>
  );
});
