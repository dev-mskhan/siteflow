import React, { forwardRef } from 'react';
import { cn } from '../../lib/cn';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      children,
      className,
      variant = 'secondary',
      size = 'md',
      isLoading = false,
      disabled,
      leftIcon,
      rightIcon,
      type = 'button',
      ...props
    },
    ref,
  ) => {
    /*
     * DESIGN.md hover rule (§1.1):
     *   "Hover resolves via opacity of the ink, not by hue."
     *
     *   primary   — solid ink fill. Hover = opacity 0.80 on the whole button.
     *               The ink dims uniformly; white text stays white. No hue shift.
     *   secondary — paper surface, hairline border, ink text.
     *               Hover = background steps surface → surface-2 (#f3f3f3).
     *               Border strengthens from hairline to hairline-2.
     *   outline   — transparent background, hairline border, ink text.
     *               Hover = same surface-2 fill as secondary.
     *   ghost     — no background, no border, muted ink text.
     *               Hover = surface-2 fill + text promoted to full ink.
     *   danger    — semantic red, not a Vault color. Opacity hover same as primary.
     *
     * Radius = 0px everywhere (DESIGN.md §4 "engineered edges").
     * No shadows — depth via borders only.
     * Transition duration-[120ms] = --duration-snappy.
     */

    const base =
      'inline-flex items-center justify-center font-heading font-semibold tracking-tight ' +
      'transition-[opacity,background-color,border-color,color] duration-[120ms] ' +
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] ' +
      'focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-40 ' +
      'select-none whitespace-nowrap';

    const variants: Record<string, string> = {
      /*
       * PRIMARY — ink block.
       * Hover: whole button at 80% opacity (ink opacity rule).
       * Active: slight scale-down.
       */
      primary:
        'bg-[#0a0a0a] text-white border border-[#0a0a0a] ' + 'hover:opacity-80 active:scale-[0.97]',

      /*
       * SECONDARY — paper surface with hairline border.
       * Hover: background steps to surface-2 (#f3f3f3), border strengthens.
       * Text stays full ink — no color change.
       */
      secondary:
        'bg-white text-[#0a0a0a] border border-[rgba(10,10,10,0.16)] ' +
        'hover:bg-[#f3f3f3] hover:border-[rgba(10,10,10,0.28)] active:scale-[0.97]',

      /*
       * OUTLINE — transparent, hairline border.
       * Hover: same surface-2 fill as secondary.
       */
      outline:
        'bg-transparent text-[#0a0a0a] border border-[rgba(10,10,10,0.16)] ' +
        'hover:bg-[#f3f3f3] hover:border-[rgba(10,10,10,0.28)] active:scale-[0.97]',

      /*
       * GHOST — invisible at rest; surface-2 fill on hover.
       * Text promoted from muted (#6b6b6b) to full ink on hover.
       */
      ghost:
        'bg-transparent text-[#6b6b6b] border border-transparent ' +
        'hover:bg-[#f3f3f3] hover:text-[#0a0a0a] active:scale-[0.97]',

      /*
       * DANGER — semantic red. Opacity hover same as primary.
       */
      danger:
        'bg-[#991b1b] text-white border border-[#991b1b] ' + 'hover:opacity-80 active:scale-[0.97]',
    };

    const sizes: Record<string, string> = {
      sm: 'px-3   py-1.5 text-xs  gap-1.5 min-h-[32px]',
      md: 'px-4   py-2   text-sm  gap-2   min-h-[40px]',
      lg: 'px-5   py-2.5 text-sm  gap-2   min-h-[44px]',
    };

    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled || isLoading}
        className={cn(base, variants[variant], sizes[size], className)}
        {...props}
      >
        {isLoading ? (
          <span className="inline-flex items-center gap-2">
            <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent animate-spin" />
            <span>Processing...</span>
          </span>
        ) : (
          <>
            {leftIcon && <span className="shrink-0">{leftIcon}</span>}
            <span className="truncate max-w-full">{children}</span>
            {rightIcon && <span className="shrink-0">{rightIcon}</span>}
          </>
        )}
      </button>
    );
  },
);

Button.displayName = 'Button';
