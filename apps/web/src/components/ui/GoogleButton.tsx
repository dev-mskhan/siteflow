/**
 * GoogleButton — "Continue with Google" CTA.
 *
 * Industry-standard OAuth 2.0 flow:
 *   1. Button click → fetch GET /auth/google   (returns JSON { data: { url } })
 *   2. Read url from response
 *   3. window.location.href = url              (full-page redirect to Google consent)
 *   4. Google → server callback → server sets cookies → server redirects → /auth/complete
 *
 * Why not just href to /auth/google directly?
 *   The server returns JSON from that endpoint, not an HTTP redirect.
 *   We must read the URL from the JSON body first.
 */

import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '../../lib/cn';

interface GoogleButtonProps {
  label?: string;
  className?: string;
}

export const GoogleButton: React.FC<GoogleButtonProps> = ({
  label = 'Continue with Google',
  className,
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClick = async () => {
    setLoading(true);
    setError(null);

    try {
      const apiBase =
        (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:3000/api/v1';

      const res = await fetch(`${apiBase}/auth/google`, {
        credentials: 'include', // send existing cookies in case of re-auth
      });

      if (!res.ok) {
        throw new Error(`Server returned ${res.status}`);
      }

      const body = (await res.json()) as {
        success: boolean;
        data?: { url?: string };
        error?: { message: string };
      };

      if (!body.success || !body.data?.url) {
        throw new Error(body.error?.message ?? 'Could not get Google sign-in URL.');
      }

      // Hand off to Google — full-page redirect
      window.location.href = body.data.url;
    } catch (err) {
      setLoading(false);
      setError(
        err instanceof Error
          ? err.message
          : 'Could not connect to Google sign-in. Please try again.',
      );
    }
    // Don't reset loading on success — page is navigating away
  };

  return (
    <div className="space-y-2">
      <button
        type="button"
        disabled={loading}
        onClick={handleClick}
        className={cn(
          'w-full inline-flex items-center justify-center gap-2.5',
          'border border-[var(--hairline-2)] bg-[var(--paper)] px-4 py-2.5',
          'text-sm font-medium text-[var(--ink)]',
          'hover:border-[var(--ink)] hover:bg-[var(--surface-2)]',
          'transition-colors duration-[120ms]',
          'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ink)]',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          className,
        )}
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin text-[var(--muted)]" strokeWidth={2} />
        ) : (
          /* Google "G" logo — standard brand colours */
          <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden>
            <path
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              fill="#4285F4"
            />
            <path
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              fill="#34A853"
            />
            <path
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
              fill="#FBBC05"
            />
            <path
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              fill="#EA4335"
            />
          </svg>
        )}
        {loading ? 'Connecting to Google…' : label}
      </button>

      {error && <p className="font-mono text-[10px] text-[#991b1b]">⚠ {error}</p>}
    </div>
  );
};
