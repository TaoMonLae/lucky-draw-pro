import React from 'react';
import { motion } from 'framer-motion';

const SPARKS = [
  [8, 24, 0.15], [16, 68, 0.8], [24, 38, 1.3], [34, 78, 0.4],
  [45, 20, 1.05], [55, 72, 0.25], [66, 30, 1.55], [76, 76, 0.65],
  [84, 42, 1.15], [92, 64, 0.5],
];

export default function GrandFinale({ phase }) {
  const isReveal = phase === 'reveal';

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-10 overflow-hidden">
      <motion.div
        className="absolute inset-0"
        initial={{ opacity: 0 }}
        animate={{ opacity: isReveal ? 0.9 : 0.62 }}
        style={{ background: 'radial-gradient(circle at 50% 52%, rgba(250,204,21,0.18) 0%, rgba(109,40,217,0.2) 36%, rgba(2,6,23,0.82) 100%)' }}
      />

      <motion.div
        className="grand-finale-rays absolute left-1/2 top-1/2 h-[150vmax] w-[150vmax] -translate-x-1/2 -translate-y-1/2 rounded-full"
        animate={{ rotate: 360, scale: isReveal ? 1.08 : 0.86, opacity: isReveal ? 0.75 : 0.38 }}
        transition={{ rotate: { duration: 28, repeat: Infinity, ease: 'linear' }, scale: { duration: 1.2 }, opacity: { duration: 0.8 } }}
      />

      <motion.div
        className="grand-finale-spotlight absolute -left-[18vw] -top-[12vh] h-[120vh] w-[62vw] origin-top -rotate-[22deg]"
        animate={{ rotate: isReveal ? [-22, -8, -22] : [-28, -15, -28], opacity: isReveal ? 0.82 : 0.42 }}
        transition={{ rotate: { duration: 4.5, repeat: Infinity, ease: 'easeInOut' }, opacity: { duration: 0.8 } }}
      />
      <motion.div
        className="grand-finale-spotlight absolute -right-[18vw] -top-[12vh] h-[120vh] w-[62vw] origin-top rotate-[22deg]"
        animate={{ rotate: isReveal ? [22, 8, 22] : [28, 15, 28], opacity: isReveal ? 0.82 : 0.42 }}
        transition={{ rotate: { duration: 4.5, repeat: Infinity, ease: 'easeInOut' }, opacity: { duration: 0.8 } }}
      />

      {isReveal && [0, 1, 2].map((ring) => (
        <motion.div
          key={ring}
          className="absolute left-1/2 top-1/2 aspect-square w-[30vmin] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-yellow-300"
          initial={{ scale: 0.55, opacity: 0.9 }}
          animate={{ scale: 3.2, opacity: 0 }}
          transition={{ duration: 2.5, delay: ring * 0.7, repeat: Infinity, ease: 'easeOut' }}
        />
      ))}

      {SPARKS.map(([left, top, delay], index) => (
        <motion.span
          key={`${left}-${top}`}
          className="grand-finale-spark absolute block h-3 w-3 text-yellow-200"
          style={{ left: `${left}%`, top: `${top}%` }}
          animate={{ scale: isReveal ? [0.5, 1.8, 0.5] : [0.4, 1, 0.4], rotate: [0, 90, 180], opacity: [0.2, 1, 0.2] }}
          transition={{ duration: isReveal ? 1.2 : 2.2, delay, repeat: Infinity, ease: 'easeInOut' }}
        />
      ))}
    </div>
  );
}
