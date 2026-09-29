import React, { useMemo } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { getTypographyProps } from '../utils/typography';
import { buildWinnerSlides } from '../utils/winnerCarousel';
import './WinnerCarousel.css';

function PrizePreview({ slide, position, titleFont, displayFont }) {
  if (!slide) return <div className="winner-gallery__empty" />;
  const prizeType = getTypographyProps(slide.prize, titleFont, 0);
  const winnerType = getTypographyProps(slide.winner, displayFont, 0);
  return (
    <div className={`winner-preview winner-preview--${position}`} aria-hidden="true">
      <span className="winner-preview__rule" />
      <p lang={prizeType.lang} style={prizeType.style} className="winner-preview__prize">{slide.prize}</p>
      <p lang={winnerType.lang} style={winnerType.style} className="winner-preview__number">{slide.winner}</p>
      <span className="winner-preview__rule" />
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
  activeIndex = 0,
  playing = true,
  onPrevious,
  onNext,
  onTogglePlayback,
  onClose,
}) {
  const slides = useMemo(() => buildWinnerSlides(winnersHistory), [winnersHistory]);
  const reduceMotion = useReducedMotion();
  if (!slides.length) return null;

  const index = ((activeIndex % slides.length) + slides.length) % slides.length;
  const activeSlide = slides[index];
  const previousSlide = slides.length > 1 ? slides[(index - 1 + slides.length) % slides.length] : null;
  const nextSlide = slides.length > 1 ? slides[(index + 1) % slides.length] : null;
  const winnerType = getTypographyProps(activeSlide.winner, displayFont, 0);
  const prizeType = getTypographyProps(activeSlide.prize, titleFont, 0);
  const titleType = getTypographyProps(title, titleFont, 0);

  return (
    <motion.section
      role={onClose ? 'dialog' : 'region'}
      aria-label="Winner celebration"
      aria-modal={onClose ? 'true' : undefined}
      className="winner-gallery"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: reduceMotion ? 0.15 : 0.35 }}
    >
      {backgroundImage && <div className="winner-gallery__event-image" style={{ backgroundImage: `url(${backgroundImage})` }} />}
      <div className="winner-gallery__stage-light" aria-hidden="true" />

      <header className="winner-gallery__header">
        <div className="winner-gallery__identity">
          {logo && <img src={logo} alt="Event logo" className="winner-gallery__logo" />}
          <h1 lang={titleType.lang} style={titleType.style}>{title}</h1>
        </div>
        <p>Winners on stage <span>{String(index + 1).padStart(2, '0')} / {String(slides.length).padStart(2, '0')}</span></p>
      </header>

      <div className="winner-gallery__composition">
        <PrizePreview slide={previousSlide} position="previous" titleFont={titleFont} displayFont={displayFont} />
        <div className="winner-gallery__center">
          <motion.article
              key={activeSlide.id}
              className="winner-plate"
              aria-live="polite"
              initial={reduceMotion ? false : { opacity: .8, x: 42, clipPath: 'inset(0 0 0 5%)' }}
              animate={{ opacity: 1, x: 0, clipPath: 'inset(0 0 0 0)' }}
              transition={{ duration: reduceMotion ? 0.15 : 0.42, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="winner-plate__topline"><span>Presented to</span><span>{String(index + 1).padStart(2, '0')} / {String(slides.length).padStart(2, '0')}</span></div>
              <div className="winner-plate__content">
                <p lang={prizeType.lang} style={prizeType.style} className="winner-plate__prize">{activeSlide.prize}</p>
                <p lang={winnerType.lang} style={winnerType.style} className="winner-plate__winner">{activeSlide.winner}</p>
              </div>
              <div className="winner-plate__bottomline"><span>Congratulations</span><span>Lucky draw</span></div>
          </motion.article>
        </div>
        <PrizePreview slide={nextSlide} position="next" titleFont={titleFont} displayFont={displayFont} />
      </div>

      <footer className="winner-gallery__footer">
        <div className="winner-gallery__ticks" aria-hidden="true">
          {slides.map((slide, slideIndex) => <span key={slide.id} className={slideIndex === index ? 'is-active' : ''} />)}
        </div>
        {onClose ? (
          <div className="winner-gallery__controls">
            <button type="button" onClick={onPrevious} disabled={slides.length < 2} aria-label="Previous winner">← <span>Previous</span></button>
            <button type="button" onClick={onTogglePlayback} disabled={slides.length < 2}>{playing ? 'Pause on this winner' : 'Play carousel'}</button>
            <button type="button" onClick={onNext} disabled={slides.length < 2} aria-label="Next winner"><span>Next</span> →</button>
            <button type="button" onClick={onClose} className="winner-gallery__close">Close celebration</button>
          </div>
        ) : <p className="winner-gallery__audience-status">{playing ? 'Celebrating every winner' : 'Presented by the host'}</p>}
      </footer>
    </motion.section>
  );
}
