import { forwardRef } from 'react';
import { Loader2 } from 'lucide-react';

const VARIANTS = {
  primary: 'bg-[#183F32] text-[#F7F5F0] hover:bg-[#123026] focus-visible:ring-[#183F32]',
  secondary: 'bg-[#171916] text-[#F7F5F0] hover:bg-[#2A2D28] focus-visible:ring-[#171916]',
  outline: 'border border-[#D9D5CA] bg-white text-[#171916] hover:bg-[#EFECE4] focus-visible:ring-[#183F32]',
  ghost: 'bg-transparent text-[#444640] hover:bg-[#EFECE4] focus-visible:ring-[#183F32]',
  danger: 'bg-[#991B1B] text-white hover:bg-[#7F1D1D] focus-visible:ring-[#991B1B]',
};

const SIZES = {
  sm: 'h-9 px-3.5 text-xs rounded-sm gap-1.5',
  md: 'h-10 px-5 text-sm rounded-sm gap-2',
  lg: 'h-12 px-6 text-sm tracking-wide rounded-sm gap-2.5',
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
