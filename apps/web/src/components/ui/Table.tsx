import { type TableHTMLAttributes, type HTMLAttributes, type ThHTMLAttributes, type TdHTMLAttributes } from 'react';
import { cn } from '../../lib/utils/index';

export function Table({ className, ...props }: TableHTMLAttributes<HTMLTableElement>) {
  return (
    <div className="relative w-full overflow-auto rounded-xl border border-border" style={{ borderColor: 'var(--border)' }}>
      <table className={cn('w-full caption-bottom text-sm text-left border-collapse', className)} {...props} />
    </div>
  );
}

export function TableHeader({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={cn('border-b border-border bg-surface-2/60 text-xs uppercase tracking-wider text-text-muted', className)} {...props} />;
}

export function TableBody({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={cn('divide-y divide-border/60', className)} {...props} />;
}

export function TableRow({ className, ...props }: HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      className={cn('transition-colors hover:bg-surface-2/50 data-[state=selected]:bg-surface-2', className)}
      {...props}
    />
  );
}

export function TableHead({ className, ...props }: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={cn('h-11 px-4 text-left align-middle font-semibold text-text-muted select-none', className)}
      style={{ color: 'var(--text-muted)' }}
      {...props}
    />
  );
}

export function TableCell({ className, isNumeric = false, ...props }: TdHTMLAttributes<HTMLTableCellElement> & { isNumeric?: boolean }) {
  return (
    <td
      className={cn('p-4 align-middle text-text', isNumeric && 'font-mono text-right', className)}
      style={{ color: 'var(--text)' }}
      {...props}
    />
  );
}
