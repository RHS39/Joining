import type { ReactNode } from 'react';
import { cx } from '@/lib/cx';

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx('flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-ink-300 bg-white px-6 py-14 text-center', className)}>
      {icon ? <div className="flex h-12 w-12 items-center justify-center rounded-full bg-ink-100 text-ink-500">{icon}</div> : null}
      <h3 className="text-base font-semibold text-ink-800">{title}</h3>
      {description ? <div className="max-w-md text-sm text-ink-500">{description}</div> : null}
      {action}
    </div>
  );
}
