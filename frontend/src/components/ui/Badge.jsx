import { CheckCircle2, Clock, AlertCircle, XCircle, Info } from 'lucide-react';
import { STATUS_VARIANTS } from '../../lib/constants';

const TONES = {
  success: 'bg-[#ECFDF5] text-[#14532D] border-[#BBF7D0]',
  warning: 'bg-[#FFFBEB] text-[#78350F] border-[#FDE68A]',
  danger: 'bg-[#FEF2F2] text-[#7F1D1D] border-[#FECACA]',
  info: 'bg-[#F3EFE6] text-[#1C1917] border-[#D6CFC2]',
  neutral: 'bg-[#F5F5F4] text-[#44403C] border-[#E7E5E4]',
};

const ICONS = {
  success: CheckCircle2,
  warning: Clock,
  danger: XCircle,
  info: Info,
  neutral: AlertCircle,
};

export function Badge({ status, tone, children, className = '' }) {
  const mapped = status ? STATUS_VARIANTS[String(status).toUpperCase()] : null;
  const resolvedTone = tone || mapped?.tone || 'neutral';
  const label = children || mapped?.label || status || 'Unknown';
  const Icon = ICONS[resolvedTone] || Info;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-sm text-xs font-medium border ${TONES[resolvedTone] || TONES.neutral} ${className}`}
    >
      <Icon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
      <span>{label}</span>
    </span>
  );
}
