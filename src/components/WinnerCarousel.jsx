import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { getTypographyProps } from '../utils/typography';
import { buildWinnerSlides } from '../utils/winnerCarousel';

const SLIDE_DURATION_MS = 3200;

export default function WinnerCarousel({
  winnersHistory,
  title = 'Lucky Draw',
  titleFont = 'sans-serif',
  displayFont = 'sans-serif',
  onClose,
}) {
  const slides = useMemo(() => buildWinnerSlides(winnersHistory), [winnersHistory]);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    setActiveIndex(0);
  }, [slides.length]);

  useEffect(() => {
    if (slides.length < 2) return undefined;
    const timer = setInterval(() => {
      setActiveIndex((current) => (current + 1) % slides.length);
    }, SLIDE_DURATION_MS);
    return () => clearInterval(timer);
  }, [slides.length]);

  if (!slides.length) return null;

  const activeSlide = slides[activeIndex % slides.length];
  const winnerTypography = getTypographyProps(activeSlide.winner, displayFont, 0);
  const prizeTypography = getTypographyProps(activeSlide.prize, titleFont, 0);

  return (
    <motion.section
      role={onClose ? 'dialog' : 'region'}
      aria-label="All winners celebration"
      aria-modal={onClose ? 'true' : undefined}
      className="fixed inset-0 z-[45] flex items-center justify-center overflow-hidden bg-slate-950/95 p-4 text-white sm:p-8"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.7 }}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_42%,rgba(250,204,21,.2),transparent_34%),radial-gradient(circle_at_18%_82%,rgba(6,182,212,.16),transparent_38%),radial-gradient(circle_at_85%_20%,rgba(168,85,247,.15),transparent_34%)]" />
      <motion.div className="pointer-events-none absolute h-[80vmin] w-[80vmin] rounded-full border border-yellow-300/15" animate={{ rotate: 360, scale: [0.9, 1.08, 0.9] }} transition={{ rotate: { duration: 28, repeat: Infinity, ease: 'linear' }, scale: { duration: 6, repeat: Infinity, ease: 'easeInOut' } }} />

      {onClose && (
        <button type="button" onClick={onClose} className="absolute right-4 top-4 z-20 rounded-full border border-white/15 bg-black/35 px-4 py-2 text-xs font-black uppercase tracking-wider text-white transition hover:bg-white/15 sm:right-7 sm:top-7">
          Finish celebration
        </button>
      )}

      <div className="relative z-10 w-full max-w-5xl text-center">
        <motion.p initial={{ opacity: 0, y: -14 }} animate={{ opacity: 1, y: 0 }} className="text-xs font-black uppercase tracking-[.36em] text-yellow-300 sm:text-sm">Celebrating every winner</motion.p>
        <h1 className="mt-3 truncate text-2xl font-black text-white/90 sm:text-4xl" style={{ fontFamily: titleFont }}>{title}</h1>

        <div className="relative mt-7 min-h-[min(54vh,30rem)] sm:mt-10">
          <AnimatePresence mode="wait" initial={false}>
            <motion.article
              key={activeSlide.id}
              aria-live="polite"
              initial={{ opacity: 0, x: 140, rotateY: -12, scale: 0.88 }}
              animate={{ opacity: 1, x: 0, rotateY: 0, scale: 1 }}
              exit={{ opacity: 0, x: -140, rotateY: 12, scale: 0.88 }}
              transition={{ duration: 0.72, ease: [0.22, 1, 0.36, 1] }}
              className="absolute inset-0 flex flex-col items-center justify-center overflow-hidden rounded-[2.5rem] border border-yellow-200/35 bg-gradient-to-br from-white/14 via-white/[.07] to-yellow-300/10 px-5 py-10 shadow-[0_30px_120px_rgba(250,204,21,.22)] sm:px-12"
            >
              <motion.div className="absolute inset-x-[-35%] top-[-20%] h-[45%] rotate-[-8deg] bg-gradient-to-r from-transparent via-white/15 to-transparent" animate={{ x: ['-35%', '35%'] }} transition={{ duration: 2.4, repeat: Infinity, repeatDelay: 0.8, ease: 'easeInOut' }} />
              <p className="relative text-[10px] font-black uppercase tracking-[.3em] text-white/55 sm:text-xs">Winner {activeIndex + 1} of {slides.length}</p>
              <p lang={prizeTypography.lang} className="relative mt-4 rounded-full border border-yellow-300/35 bg-yellow-300/10 px-5 py-2 text-sm font-black uppercase tracking-[.16em] text-yellow-200 sm:text-lg" style={prizeTypography.style}>{activeSlide.prize}</p>
              <motion.div lang={winnerTypography.lang} style={{ ...winnerTypography.style, textShadow: '0 0 24px rgba(250,204,21,.42)' }} className="relative mt-8 max-w-full break-words text-center text-[clamp(2.6rem,9vw,7.5rem)] font-black leading-[1.02] text-white" initial={{ scale: 0.75 }} animate={{ scale: [0.75, 1.06, 1] }} transition={{ duration: 0.9, ease: 'easeOut' }}>{activeSlide.winner}</motion.div>
              <p className="relative mt-7 text-xs font-bold uppercase tracking-[.24em] text-cyan-200/80">Congratulations</p>
            </motion.article>
          </AnimatePresence>
        </div>

        <div className="mx-auto mt-6 flex max-w-2xl items-center gap-3">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
            <motion.div key={activeSlide.id} className="h-full origin-left rounded-full bg-gradient-to-r from-cyan-400 via-yellow-300 to-orange-400" initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: SLIDE_DURATION_MS / 1000, ease: 'linear' }} />
          </div>
          <span className="min-w-16 text-right text-xs font-black tabular-nums text-white/60">{activeIndex + 1} / {slides.length}</span>
        </div>
      </div>
    </motion.section>
  );
}
