export function Avatar({ name = 'User', src, size = 'md', className = '' }) {
  const initials = String(name || 'U')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() || '')
    .join('');

  const sizeMap = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-14 h-14 text-base',
    xl: 'w-20 h-20 text-xl',
  };

  if (src) {
    return (
      <img
        src={src}
        alt={name}
        className={`rounded-md object-cover border border-[#D6CFC2] shrink-0 ${sizeMap[size] || sizeMap.md} ${className}`}
      />
    );
  }

  return (
    <div
      aria-hidden="true"
      className={`rounded-md bg-[#F3EFE6] text-[#1B4332] border border-[#D6CFC2] font-editorial font-semibold flex items-center justify-center shrink-0 ${sizeMap[size] || sizeMap.md} ${className}`}
    >
      {initials || 'U'}
    </div>
  );
}
