import { forwardRef } from 'react';
import { Loader2 } from 'lucide-react';

const VARIANTS = {
  primary: 'bg-[#1B4332] text-[#FAF7F2] hover:bg-[#143326] focus-visible:ring-[#1B4332]',
  secondary: 'bg-[#1C1917] text-[#FAF7F2] hover:bg-[#292524] focus-visible:ring-[#1C1917]',
  outline: 'border border-[#D6CFC2] bg-white text-[#1C1917] hover:bg-[#F3EFE6] focus-visible:ring-[#1B4332]',
  ghost: 'bg-transparent text-[#44403C] hover:bg-[#F3EFE6] focus-visible:ring-[#1B4332]',
  danger: 'bg-[#991B1B] text-white hover:bg-[#7F1D1D] focus-visible:ring-[#991B1B]',
};

const SIZES = {
  sm: 'h-9 px-3.5 text-xs rounded-md gap-1.5',
  md: 'h-10 px-5 text-sm rounded-md gap-2',
  lg: 'h-12 px-6 text-sm tracking-wide rounded-md gap-2.5',
};

export const Button = forwardRef(function Button(
  {
    variant = 'primary',
    size = 'md',
    loading = false,
    disabled = false,
    type = 'button',
    className = '',
    children,
    ...props
  },
  ref
) {
  const isDisabled = disabled || loading;
  return (
    <button
      ref={ref}
      type={type}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      className={`inline-flex items-center justify-center font-medium transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[#FAF7F2] disabled:opacity-55 disabled:cursor-not-allowed cursor-pointer ${VARIANTS[variant] || VARIANTS.primary} ${SIZES[size] || SIZES.md} ${className}`}
      {...props}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin shrink-0" aria-hidden="true" />}
      {children}
    </button>
  );
});
