export function Card({ className = '', children, ...props }) {
  return (
    <div
      className={`bg-white rounded-sm border border-[#D9D5CA] ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({ title, description, action, className = '' }) {
  return (
    <div className={`px-5 py-4 border-b border-[#EFEAE0] flex flex-wrap items-start justify-between gap-3 ${className}`}>
      <div className="min-w-0">
        {title && <h2 className="text-base font-semibold text-[#1C1917]">{title}</h2>}
        {description && <p className="text-sm text-[#57534E] mt-0.5">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function CardBody({ className = '', children }) {
  return <div className={`p-5 ${className}`}>{children}</div>;
}
