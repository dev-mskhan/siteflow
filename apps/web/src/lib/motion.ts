import type { Variants, Transition } from 'framer-motion';

/**
 * Shared motion transitions respecting snappiness and user preferences.
 * Only opacity and transform are animated.
 */

export const transitions = {
  snappy: {
    duration: 0.18,
    ease: [0.16, 1, 0.3, 1],
  } as Transition,
  standard: {
    duration: 0.24,
    ease: [0.2, 0, 0, 1],
  } as Transition,
  entrance: {
    duration: 0.45,
    ease: [0.16, 1, 0.3, 1],
  } as Transition,
};

// Fade preset
export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: transitions.standard,
  },
};

// Slide up entrance (for cards, modal bodies, headers)
export const slideUp: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: transitions.entrance,
  },
};

// Slide down (for dropdowns, alerts)
export const slideDown: Variants = {
  hidden: { opacity: 0, y: -8 },
  visible: {
    opacity: 1,
    y: 0,
    transition: transitions.snappy,
  },
};

// Stagger container for lists and grids
export const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.05,
    },
  },
};

// Scale popup for modals and toasts
export const modalScale: Variants = {
  hidden: { opacity: 0, scale: 0.96, y: 8 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: transitions.snappy,
  },
  exit: {
    opacity: 0,
    scale: 0.96,
    y: 8,
    transition: { duration: 0.15 },
  },
};

// Interactive hover and press feedback
export const buttonPress = {
  tap: { scale: 0.98 },
  hover: { scale: 1.01 },
};
