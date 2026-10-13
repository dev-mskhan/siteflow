/**
 * DemoModal — Vault design system
 *
 * Three colors only (--ink / --surface / --hairline-2).
 * No rounded corners, no shadows, no color accents.
 * Framer-motion scale+fade entrance; backdrop locks scroll.
 * Accepts an optional videoId (YouTube).  When omitted, renders
 * a placeholder frame with a "coming soon" message so the modal
 * is usable before the video is ready.
 */

import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { X, Play } from 'lucide-react';

interface DemoModalProps {
  open: boolean;
  onClose: () => void;
  /** YouTube video ID, e.g. "dQw4w9WgXcQ". Omit to show placeholder. */
  videoId?: string;
}

export const DemoModal: React.FC<DemoModalProps> = ({ open, onClose, videoId }) => {
  const reduce = useReducedMotion();

  /* Lock body scroll while open */
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  /* Close on Escape */
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  const backdropVariants = {
    hidden:  { opacity: 0 },
    visible: { opacity: 1, transition: { duration: reduce ? 0 : 0.18 } },
    exit:    { opacity: 0, transition: { duration: reduce ? 0 : 0.14 } },
  };

  const panelVariants = {
    hidden:  { opacity: 0, scale: reduce ? 1 : 0.97, y: reduce ? 0 : 8 },
    visible: { opacity: 1, scale: 1, y: 0,
               transition: { duration: reduce ? 0 : 0.26, ease: [0.16, 1, 0.3, 1] as const } },
    exit:    { opacity: 0, scale: reduce ? 1 : 0.98, y: reduce ? 0 : 6,
               transition: { duration: reduce ? 0 : 0.16, ease: [0.4, 0, 1, 1] as const } },
  };

  return createPortal(
    <AnimatePresence>
      {open && (
        /* ── Backdrop ─────────────────────────────────────────────── */
        <motion.div
          key="demo-modal-backdrop"
          variants={backdropVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          onClick={onClose}
          className="fixed inset-0 z-[200] flex items-center justify-center bg-[var(--ink)]/80 px-4 sm:px-6"
          aria-modal="true"
          role="dialog"
          aria-label="Product demonstration video"
        >
          {/* ── Panel ─────────────────────────────────────────────── */}
          <motion.div
            key="demo-modal-panel"
            variants={panelVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-4xl border border-[var(--hairline-2)] bg-[var(--ink)]"
          >
            {/* Top bar */}
            <div className="flex items-center justify-between border-b border-[var(--hairline-2)] px-5 py-3">
              <div className="flex items-center gap-3">
                <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/55">
                  Product demo
                </span>
                <span className="h-px w-6 bg-white/20" />
                <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/30">
                  SiteFlow construction operations
                </span>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close demo video"
                className="flex h-7 w-7 items-center justify-center border border-white/20 text-white/60 transition-colors hover:border-white/50 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                <X className="h-3.5 w-3.5" strokeWidth={2} />
              </button>
            </div>

            {/* Video area — 16/9 */}
            <div className="relative aspect-video w-full bg-[var(--ink)]">
              {videoId ? (
                <iframe
                  src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1&color=white`}
                  title="SiteFlow product demo"
                  allow="autoplay; fullscreen; picture-in-picture"
                  allowFullScreen
                  className="absolute inset-0 h-full w-full border-0"
                />
              ) : (
                /* Placeholder — video not yet published */
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-6">
                  {/* Play circle */}
                  <div className="flex h-16 w-16 items-center justify-center border border-white/20">
                    <Play className="h-6 w-6 text-white/40 translate-x-0.5" strokeWidth={1.4} />
                  </div>
                  <div className="text-center">
                    <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/40">
                      Demo video coming soon
                    </p>
                    <p className="mt-2 text-sm text-white/25">
                      In the meantime, book a live 20-minute walkthrough.
                    </p>
                  </div>
                  <a
                    href="/contact?intent=trial"
                    onClick={onClose}
                    className="inline-flex items-center gap-2 border border-white/25 px-4 py-2.5 text-sm font-medium text-white/70 transition-colors hover:border-white/55 hover:text-white"
                  >
                    Start free trial instead
                  </a>
                </div>
              )}
            </div>

            {/* Bottom bar */}
            <div className="flex items-center justify-between border-t border-[var(--hairline-2)] px-5 py-3">
              <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/30">
                14-day trial · No card required
              </span>
              <a
                href="/contact?intent=trial"
                onClick={onClose}
                className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/55 transition-colors hover:text-white"
              >
                Start free trial →
              </a>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
};
