import React, { forwardRef } from 'react';
import { cn } from '../../lib/cn';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'muted' | 'interactive';
}

/*
 * DESIGN.md rules:
 *  - radius = 0px (no rounded-md)
 *  - depth via border hairline, not shadow
 *  - NO overflow-hidden in default — absolute-positioned badges (e.g. pricing)
 *    must not be clipped. Add overflow-hidden via className where genuinely needed.
 */
export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant = 'default', children, ...props }, ref) => {
    const variantStyles = {
      default: 'bg-white border border-[rgba(10,10,10,0.08)]',
      muted: 'bg-[#f3f3f3] border border-[rgba(10,10,10,0.08)]',
      interactive:
        'bg-white border border-[rgba(10,10,10,0.08)] ' +
        'hover:border-[rgba(10,10,10,0.20)] transition-colors duration-[120ms] cursor-pointer',
    };

    return (
      <div ref={ref} className={cn('text-[#0a0a0a]', variantStyles[variant], className)} {...props}>
        {children}
      </div>
    );
  },
);
Card.displayName = 'Card';

export const CardHeader = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'p-4 sm:p-5 flex flex-col gap-1 border-b border-[rgba(10,10,10,0.08)]',
        className,
      )}
      {...props}
    />
  ),
);
CardHeader.displayName = 'CardHeader';

export const CardTitle = forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, children, ...props }, ref) => (
    <h3
      ref={ref}
      className={cn(
        'font-heading text-base font-semibold tracking-tight text-[#0a0a0a]',
        className,
      )}
      {...props}
    >
      {children}
    </h3>
  ),
);
CardTitle.displayName = 'CardTitle';

export const CardDescription = forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p ref={ref} className={cn('text-xs text-[#6b6b6b] leading-relaxed', className)} {...props} />
));
CardDescription.displayName = 'CardDescription';

export const CardContent = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('p-4 sm:p-5', className)} {...props} />
  ),
);
CardContent.displayName = 'CardContent';

export const CardFooter = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'p-4 sm:p-5 border-t border-[rgba(10,10,10,0.08)] bg-[#f3f3f3] flex items-center justify-between gap-3',
        className,
      )}
      {...props}
    />
  ),
);
CardFooter.displayName = 'CardFooter';
