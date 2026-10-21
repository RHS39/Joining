import { Loader2 } from 'lucide-react';
import { cx } from '@/lib/cx';

export function Spinner({ className, label = 'Loading…' }: { className?: string; label?: string }) {
  return (
    <div className={cx('flex items-center justify-center gap-2 py-10 text-sm text-ink-500', className)} role="status">
      <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}

export function InlineSpinner({ className }: { className?: string }) {
  return <Loader2 className={cx('h-4 w-4 animate-spin', className)} aria-hidden="true" />;
}
