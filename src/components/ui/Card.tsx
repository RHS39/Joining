import type { ReactNode } from 'react';
import { cx } from '@/lib/cx';

export interface CardProps {
  children: ReactNode;
  className?: string;
}

export function Card({ children, className }: CardProps) {
  return <section className={cx('card-surface', className)}>{children}</section>;
}

export function CardHeader({
  title,
  description,
  actions,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cx('flex flex-wrap items-start justify-between gap-3 border-b border-ink-200 px-5 py-4', className)}>
      <div className="min-w-0">
        <h2 className="text-base font-semibold text-ink-900">{title}</h2>
        {description ? <p className="mt-1 text-sm text-ink-500">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}

export function CardBody({ children, className }: CardProps) {
  return <div className={cx('px-5 py-4', className)}>{children}</div>;
}

export function CardFooter({ children, className }: CardProps) {
  return <div className={cx('flex flex-wrap items-center gap-2 border-t border-ink-200 bg-ink-50 px-5 py-3', className)}>{children}</div>;
}
