import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';

export default function DrawDisplay({
  drawing,
  currentPrize,
  displayRef,
  displayBoxWidth,
  displayBoxHeight,
  pulse,
  setPulse,
  drawMode,
  currentTheme,
  displayFont,
  displayFontSize,
  displayLineHeight,
  displayLetterSpacing,
  getDigits,
  displayValue,
}) {
  return (
    <div className="flex flex-col items-center z-20">
      <AnimatePresence>
        {drawing && (
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} className="text-2xl font-bold mb-2" style={{ color: 'var(--title-color)' }}>
            Now Drawing: {currentPrize}
          </motion.div>
        )}
      </AnimatePresence>
      <motion.div
        ref={displayRef}
        className="rounded-2xl shadow-inner flex items-center justify-center p-4 border-4"
        style={{ backgroundColor: 'var(--display-bg)', borderColor: 'var(--display-border)', width: `min(${displayBoxWidth}px, 95vw)`, height: `${displayBoxHeight}px` }}
        animate={pulse ? { boxShadow: ['0 0 0px #fff', '0 0 40px #fff', '0 0 0px #fff'] } : {}}
        transition={pulse ? { duration: 0.8, ease: 'easeInOut' } : {}}
        onAnimationComplete={() => setPulse(false)}
      >
        {drawMode === 'numbers' ? (
          <div className="flex items-center font-bold" style={{ color: 'var(--display-text)', textShadow: `0 0 20px ${currentTheme['--display-shadow']}`, fontFamily: displayFont, fontSize: `clamp(2.25rem, ${displayFontSize / 16}rem, 8.5rem)`, lineHeight: displayLineHeight, letterSpacing: `${displayLetterSpacing}px`, fontVariantNumeric: 'tabular-nums lining-nums' }}>
            {getDigits(displayValue).map((digit, index) => (
              <div key={index} className="w-[1ch] text-center overflow-hidden">
                <AnimatePresence mode="popLayout">
                  <motion.span key={`${digit}-${index}`} initial={{ y: -50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 50, opacity: 0 }} transition={{ duration: 0.2 }}>
                    {digit === ' ' ? '\u00A0' : digit}
                  </motion.span>
                </AnimatePresence>
              </div>
            ))}
          </div>
        ) : (
          <div className="font-bold px-4 text-center" style={{ color: 'var(--display-text)', textShadow: `0 0 20px ${currentTheme['--display-shadow']}`, fontFamily: displayFont, fontSize: `clamp(2rem, ${Math.max(38, displayFontSize * 0.7) / 16}rem, 6rem)`, lineHeight: displayLineHeight, letterSpacing: `${displayLetterSpacing}px` }}>
            <AnimatePresence mode="popLayout">
              <motion.span key={displayValue} initial={{ y: -50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 50, opacity: 0 }} transition={{ duration: 0.2 }}>
                {displayValue}
              </motion.span>
            </AnimatePresence>
          </div>
        )}
      </motion.div>
    </div>
  );
}
