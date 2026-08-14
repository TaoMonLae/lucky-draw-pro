import React, { useMemo } from 'react';
import { motion } from 'framer-motion';

export const Button = ({ children, className, ...props }) => (
  <button type="button" className={`text-white font-bold py-2 px-4 rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity shadow-lg transform active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-transparent ${className || ''}`} {...props}>
    {children}
  </button>
);

export const Input = (props) => (
  <input className="border rounded-lg px-3 py-2 w-full focus:ring-2 focus:ring-[var(--button-primary-bg)] focus:outline-none shadow-sm" {...props} />
);

export const ConfettiParticle = ({ colors, grand = false, ...props }) => {
  // Keep each particle's trajectory stable when the clock or draw state re-renders.
  const particle = useMemo(() => ({
    color: colors[Math.floor(Math.random() * colors.length)],
    delay: Math.random() * (grand ? 1.2 : 0.35),
    duration: Math.random() * 2 + (grand ? 3.8 : 3),
    height: Math.random() * (grand ? 18 : 10) + 5,
    left: Math.random() * 100,
    rotation: (Math.random() > 0.5 ? 1 : -1) * (360 + Math.random() * 720),
    sway: (Math.random() - 0.5) * (grand ? 260 : 120),
    top: Math.random() * 20,
    width: Math.random() * (grand ? 9 : 10) + 5,
  }), [colors, grand]);

  return (
    <motion.div
      className={`absolute z-50 ${grand ? 'rounded-sm' : 'rounded-full'}`}
      initial={{ opacity: 1, rotate: 0, x: 0, y: 0 }}
      animate={{ y: '110vh', x: particle.sway, rotate: particle.rotation, opacity: [1, 1, 0] }}
      transition={{ duration: particle.duration, delay: particle.delay, ease: 'easeIn' }}
      style={{ left: `${particle.left}vw`, top: `-${particle.top}vh`, width: `${particle.width}px`, height: `${particle.height}px`, backgroundColor: particle.color }}
      {...props}
    />
  );
};
