import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { getTypographyProps } from '../utils/typography';
import { buildWinnerSlides } from '../utils/winnerCarousel';

const SLIDE_DURATION_MS = 3200;
const STAGE_SPARKS = [
  { left: '8%', top: '19%', delay: 0.1, size: 4 },
  { left: '16%', top: '71%', delay: 1.2, size: 3 },
  { left: '27%', top: '12%', delay: 0.7, size: 5 },
  { left: '72%', top: '16%', delay: 1.5, size: 3 },
  { left: '84%', top: '67%', delay: 0.4, size: 5 },
  { left: '93%', top: '31%', delay: 1.9, size: 4 },
];

function CelebrationCrest() {
  return (
    <div className="flex h-full w-full items-center justify-center rounded-full bg-gradient-to-br from-yellow-200 via-amber-400 to-orange-500 text-slate-950 shadow-[inset_0_2px_8px_rgba(255,255,255,.55)]">
      <svg aria-hidden="true" viewBox="0 0 64 64" className="h-8 w-8 sm:h-10 sm:w-10" fill="none">
        <path d="M14 43h36l-3 9H17l-3-9Z" fill="currentColor" opacity=".9" />
        <path d="m12 19 12 11 8-18 8 18 12-11-5 21H17l-5-21Z" fill="currentColor" />
        <circle cx="12" cy="18" r="4" fill="currentColor" />
        <circle cx="32" cy="10" r="4" fill="currentColor" />
        <circle cx="52" cy="18" r="4" fill="currentColor" />
      </svg>
    </div>
  );
}

export default function WinnerCarousel({
  winnersHistory,
  title = 'Lucky Draw',
  titleFont = 'sans-serif',
  displayFont = 'sans-serif',
  logo = null,
  backgroundImage = '',
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
  const titleTypography = getTypographyProps(title, titleFont, 0);

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
      {backgroundImage && (
        <motion.div
          className="pointer-events-none absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${backgroundImage})` }}
          initial={{ scale: 1.04 }}
          animate={{ scale: 1.1 }}
          transition={{ duration: 18, ease: 'linear' }}
        />
      )}
      <div className={`pointer-events-none absolute inset-0 ${backgroundImage ? 'bg-slate-950/75' : 'bg-[linear-gradient(125deg,#020617_0%,#071b2b_42%,#160d2c_100%)]'}`} />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_44%,rgba(250,204,21,.25),transparent_30%),radial-gradient(circle_at_12%_88%,rgba(6,182,212,.2),transparent_37%),radial-gradient(circle_at_88%_12%,rgba(168,85,247,.2),transparent_34%),linear-gradient(to_bottom,rgba(2,6,23,.08),rgba(2,6,23,.7))]" />
      <div className="pointer-events-none absolute inset-0 opacity-20 [background-image:linear-gradient(rgba(255,255,255,.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.035)_1px,transparent_1px)] [background-size:54px_54px] [mask-image:radial-gradient(circle_at_center,black,transparent_78%)]" />
      <motion.div className="pointer-events-none absolute -left-[8vw] top-[-15vh] h-[95vh] w-[28vw] origin-top rotate-[18deg] bg-gradient-to-b from-cyan-200/16 via-cyan-300/5 to-transparent blur-2xl" animate={{ rotate: [15, 22, 15], opacity: [.35, .8, .35] }} transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut' }} />
      <motion.div className="pointer-events-none absolute -right-[8vw] top-[-15vh] h-[95vh] w-[28vw] origin-top -rotate-[18deg] bg-gradient-to-b from-yellow-200/18 via-yellow-300/5 to-transparent blur-2xl" animate={{ rotate: [-15, -22, -15], opacity: [.75, .35, .75] }} transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut' }} />
      <motion.div className="pointer-events-none absolute h-[88vmin] w-[88vmin] rounded-full border border-yellow-300/15" animate={{ rotate: 360, scale: [0.92, 1.04, 0.92] }} transition={{ rotate: { duration: 32, repeat: Infinity, ease: 'linear' }, scale: { duration: 7, repeat: Infinity, ease: 'easeInOut' } }} />

      {STAGE_SPARKS.map((spark, index) => (
        <motion.span
          key={`${spark.left}-${spark.top}`}
          className="pointer-events-none absolute z-10 rounded-full bg-yellow-100 shadow-[0_0_14px_4px_rgba(250,204,21,.65)]"
          style={{ left: spark.left, top: spark.top, width: spark.size, height: spark.size }}
          animate={{ opacity: [0.15, 1, 0.15], scale: [0.65, 1.8, 0.65] }}
          transition={{ duration: 2.4, delay: spark.delay, repeat: Infinity, ease: 'easeInOut' }}
        />
      ))}

      {onClose && (
        <button type="button" onClick={onClose} className="absolute right-4 top-4 z-30 rounded-full border border-yellow-200/25 bg-slate-950/70 px-4 py-2 text-xs font-black uppercase tracking-wider text-white shadow-xl backdrop-blur-md transition hover:border-yellow-200/60 hover:bg-white/15 sm:right-7 sm:top-7">
          Finish celebration
        </button>
      )}

      <div className="relative z-20 w-full max-w-6xl text-center">
        <header className="mx-auto flex max-w-4xl flex-col items-center px-16 sm:px-24">
          <motion.div
            initial={{ opacity: 0, scale: .6, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 180, damping: 16 }}
            className={logo
              ? 'relative flex h-16 max-w-52 shrink-0 items-center justify-center rounded-2xl border border-yellow-100/60 bg-slate-950/75 px-4 py-2 shadow-[0_0_35px_rgba(250,204,21,.32)] backdrop-blur-md sm:h-20 sm:max-w-64'
              : 'relative h-16 w-16 shrink-0 rounded-full border-2 border-yellow-100/70 bg-slate-950/75 p-1.5 shadow-[0_0_35px_rgba(250,204,21,.4)] sm:h-20 sm:w-20'}
          >
            <motion.div className={`absolute -inset-2 border border-dashed border-yellow-300/50 ${logo ? 'rounded-[1.35rem]' : 'rounded-full'}`} animate={{ rotate: logo ? 0 : 360, opacity: [.45, .9, .45] }} transition={{ rotate: { duration: 14, repeat: Infinity, ease: 'linear' }, opacity: { duration: 2.4, repeat: Infinity, ease: 'easeInOut' } }} />
            {logo ? <img src={logo} alt="Event logo" className="max-h-full max-w-full object-contain" /> : <CelebrationCrest />}
          </motion.div>
          <motion.p initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mt-3 text-[10px] font-black uppercase tracking-[.3em] text-yellow-300 sm:text-xs">Celebrating every winner</motion.p>
          <h1 lang={titleTypography.lang} className="mt-2 max-w-full break-words text-[clamp(1.15rem,2.6vw,2.6rem)] font-black leading-[1.25] text-white/95 [overflow-wrap:anywhere]" style={titleTypography.style}>{title}</h1>
        </header>

        <div className="relative mt-5 min-h-[min(52vh,31rem)] sm:mt-7">
          <AnimatePresence mode="wait" initial={false}>
            <motion.article
              key={activeSlide.id}
              aria-live="polite"
              initial={{ opacity: 0, x: 140, rotateY: -12, scale: 0.88 }}
              animate={{ opacity: 1, x: 0, rotateY: 0, scale: 1 }}
              exit={{ opacity: 0, x: -140, rotateY: 12, scale: 0.88 }}
              transition={{ duration: 0.72, ease: [0.22, 1, 0.36, 1] }}
              className="absolute inset-0 overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-yellow-100 via-amber-400 to-cyan-300 p-[2px] shadow-[0_30px_120px_rgba(250,204,21,.26)]"
            >
              <div className="absolute inset-[2px] rounded-[calc(2.5rem-2px)] bg-[linear-gradient(145deg,rgba(15,23,42,.97),rgba(8,24,40,.96)_52%,rgba(31,18,48,.96))]" />
              <motion.div className="absolute inset-x-[-35%] top-[-18%] h-[46%] rotate-[-8deg] bg-gradient-to-r from-transparent via-white/18 to-transparent" animate={{ x: ['-35%', '35%'] }} transition={{ duration: 2.4, repeat: Infinity, repeatDelay: 0.8, ease: 'easeInOut' }} />
              <div className="absolute left-5 top-5 h-12 w-12 rounded-tl-2xl border-l-2 border-t-2 border-yellow-200/80 sm:h-16 sm:w-16" />
              <div className="absolute right-5 top-5 h-12 w-12 rounded-tr-2xl border-r-2 border-t-2 border-cyan-200/70 sm:h-16 sm:w-16" />
              <div className="absolute bottom-5 left-5 h-12 w-12 rounded-bl-2xl border-b-2 border-l-2 border-cyan-200/70 sm:h-16 sm:w-16" />
              <div className="absolute bottom-5 right-5 h-12 w-12 rounded-br-2xl border-b-2 border-r-2 border-yellow-200/80 sm:h-16 sm:w-16" />
              <div className="relative flex h-full flex-col items-center justify-center px-7 py-9 sm:px-14">
                <p className="text-[10px] font-black uppercase tracking-[.3em] text-white/55 sm:text-xs">Winner {activeIndex + 1} of {slides.length}</p>
                <p lang={prizeTypography.lang} className="mt-4 max-w-full break-words rounded-full border border-yellow-300/45 bg-yellow-300/10 px-5 py-2 text-sm font-black uppercase tracking-[.12em] text-yellow-200 shadow-[0_0_28px_rgba(250,204,21,.12)] sm:text-lg" style={prizeTypography.style}>{activeSlide.prize}</p>
                <motion.div lang={winnerTypography.lang} style={{ ...winnerTypography.style, textShadow: '0 0 26px rgba(250,204,21,.42)' }} className="mt-6 max-w-full break-words text-center text-[clamp(2.6rem,9vw,7.5rem)] font-black leading-[1.08] text-white [overflow-wrap:anywhere]" initial={{ scale: 0.75 }} animate={{ scale: [0.75, 1.06, 1] }} transition={{ duration: 0.9, ease: 'easeOut' }}>{activeSlide.winner}</motion.div>
                <div className="mt-6 flex items-center gap-3 text-cyan-100/85">
                  <span className="h-px w-8 bg-gradient-to-r from-transparent to-current sm:w-16" />
                  <p className="text-[10px] font-bold uppercase tracking-[.24em] sm:text-xs">Congratulations</p>
                  <span className="h-px w-8 bg-gradient-to-l from-transparent to-current sm:w-16" />
                </div>
              </div>
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
