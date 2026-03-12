import React from 'react';
import { motion } from 'framer-motion';

export const Button = ({ children, className, ...props }) => (
  <button className={`text-white font-bold py-2 px-4 rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity shadow-lg transform active:scale-95 ${className}`} {...props}>
    {children}
  </button>
);

export const Input = (props) => (
  <input className="border rounded-lg px-3 py-2 w-full focus:ring-2 focus:ring-[var(--button-primary-bg)] focus:outline-none shadow-sm" {...props} />
);

export const ConfettiParticle = ({ colors, ...props }) => (
  <motion.div
    className="absolute rounded-full z-50"
    animate={{ y: '100vh', opacity: [1, 1, 0] }}
    transition={{ duration: Math.random() * 2 + 3, ease: 'easeIn' }}
    style={{ left: `${Math.random() * 100}vw`, top: `-${Math.random() * 20}vh`, width: `${Math.random() * 10 + 5}px`, height: `${Math.random() * 10 + 5}px`, backgroundColor: colors[Math.floor(Math.random() * colors.length)] }}
    {...props}
  />
);
