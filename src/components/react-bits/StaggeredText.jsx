import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';

// Adapted from licensed React Bits Pro staggered-text-tw.
// https://pro.reactbits.dev/docs/components/staggered-text
// Uses the existing Motion runtime and mount triggers. Whole-word segmentation
// preserves Myanmar shaping; no character splitting.
export default function StaggeredText({ text, className = '', delay = 35, duration = 0.32 }) {
  const reducedMotion = useReducedMotion();
  const segments = String(text).split(/(\s+)/);
  return (
    <span className={`staggered-text ${className}`} aria-label={text}>
      {segments.map((segment, index) => /^\s+$/.test(segment) ? segment : (
        <motion.span key={index} aria-hidden="true" style={{ display: 'inline-block' }} initial={reducedMotion ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: reducedMotion ? 0 : duration, delay: reducedMotion ? 0 : Math.min(index * delay / 1000, 0.25), ease: 'easeOut' }}>{segment}</motion.span>
      ))}
    </span>
  );
}
