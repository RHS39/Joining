import { AlertCircle, CheckCircle2, Info, TriangleAlert } from 'lucide-react';
import { cx } from '@/lib/cx';

export type AlertTone = 'info' | 'success' | 'warning' | 'error';

const TONES: Record<AlertTone, { wrapper: string; icon: React.ReactNode }> = {
  info: {
    wrapper: 'border-brand-200 bg-brand-50 text-brand-900',
    icon: <Info className="h-5 w-5 text-brand-600" aria-hidden="true" />,
  },
  success: {
    wrapper: 'border-emerald-200 bg-emerald-50 text-emerald-900',
    icon: <CheckCircle2 className="h-5 w-5 text-emerald-600" aria-hidden="true" />,
  },
  warning: {
    wrapper: 'border-amber-200 bg-amber-50 text-amber-900',
    icon: <TriangleAlert className="h-5 w-5 text-amber-600" aria-hidden="true" />,
  },
  error: {
    wrapper: 'border-red-200 bg-red-50 text-red-900',
    icon: <AlertCircle className="h-5 w-5 text-red-600" aria-hidden="true" />,
  },
};

export function Alert({
  tone = 'info',
  title,
  children,
  className,
}: {
  tone?: AlertTone;
  title?: string;
  children?: React.ReactNode;
  className?: string;
}) {
  const config = TONES[tone];
  return (
    <div className={cx('flex gap-3 rounded-lg border px-4 py-3 text-sm', config.wrapper, className)} role={tone === 'error' ? 'alert' : undefined}>
      <span className="mt-0.5 shrink-0">{config.icon}</span>
      <div className="min-w-0 space-y-1">
        {title ? <p className="font-semibold">{title}</p> : null}
        {children ? <div className="leading-relaxed [&_p]:leading-relaxed">{children}</div> : null}
      </div>
    </div>
  );
}
