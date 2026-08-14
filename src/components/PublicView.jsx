import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { usePublicSync } from '../hooks/usePublicSync';
import { getTypographyProps } from '../utils/typography';
import { themes } from '../utils/themeConfig';
import { getPaddedDigits } from '../hooks/useDrawEngine';
import { ConfettiParticle } from './ui';
import LetterGlitch from './LetterGlitch';
import GrandFinale from './GrandFinale';

const SYNC_LABELS = {
  connecting: 'Connecting',
  live: 'Live',
  local: 'Same-device live',
  unconfigured: 'Sync unavailable',
  error: 'Connection lost',
  closed: 'Sharing stopped',
};

const LETTER_GLITCH_COLORS = ['#123044', '#06b6d4', '#facc15'];

function ShapedText({ as: Tag = 'span', children, fontFamily, className, style }) {
  const typography = getTypographyProps(React.Children.toArray(children).join(''), fontFamily, 0);
  return <Tag lang={typography.lang} className={className} style={{ ...typography.style, ...style }}>{children}</Tag>;
}

function WaitingStage({ errorMessage, roomId, syncStatus }) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-950 p-6 text-center text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,rgba(6,182,212,0.2),transparent_38%),radial-gradient(circle_at_50%_100%,rgba(250,204,21,0.12),transparent_45%)]" />
      <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} className="relative max-w-xl rounded-[2rem] border border-white/10 bg-white/5 px-8 py-12 shadow-2xl backdrop-blur-xl">
        <motion.div animate={{ scale: [1, 1.08, 1], opacity: [0.55, 1, 0.55] }} transition={{ duration: 2, repeat: Infinity }} className="mx-auto mb-6 h-4 w-4 rounded-full bg-cyan-400 shadow-[0_0_30px_8px_rgba(34,211,238,0.55)]" />
        <p className="text-xs font-black uppercase tracking-[0.32em] text-cyan-300">Audience display</p>
        <h1 className="mt-4 text-3xl font-black sm:text-5xl">Waiting for the draw</h1>
        <p className="mt-4 text-base text-slate-300">This screen will update automatically when the host starts.</p>
        <div className="mt-7 inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/30 px-4 py-2 text-sm font-semibold">
          <span className={`h-2 w-2 rounded-full ${syncStatus === 'error' || syncStatus === 'closed' || syncStatus === 'unconfigured' ? 'bg-red-400' : 'bg-amber-300'}`} />
          {SYNC_LABELS[syncStatus]}
        </div>
        {roomId && <p className="mt-3 font-mono text-xs text-slate-500">Room {roomId.slice(0, 8)}</p>}
        {errorMessage && <p role="alert" className="mt-5 rounded-xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">{errorMessage}</p>}
        {!roomId && <p className="mt-5 text-xs text-amber-200/70">Same-device links require the host tab to remain open in this browser.</p>}
      </motion.div>
    </div>
  );
}

function AssignmentBoard({ assignmentResult, displayFont, titleFont }) {
  const groups = assignmentResult.mode === 'team-divider'
    ? assignmentResult.teams.map((team) => ({ label: team.teamName, members: team.members }))
    : assignmentResult.assignments.map((assignment) => ({ label: assignment.role, members: assignment.participants }));

  return (
    <div className="grid max-h-[58vh] grid-cols-1 gap-4 overflow-y-auto pr-1 sm:grid-cols-2">
      {groups.map((group, index) => (
        <motion.section key={`${group.label}-${index}`} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.06 }} className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel-bg)]/80 p-5 shadow-xl backdrop-blur-md">
          <ShapedText as="h3" fontFamily={titleFont} className="border-b border-[var(--panel-border)] pb-3 text-xl font-black break-words" style={{ color: 'var(--title-color)' }}>{group.label}</ShapedText>
          <ul className="mt-3 space-y-2">
            {group.members.map((member, memberIndex) => (
              <ShapedText as="li" fontFamily={displayFont} key={`${member}-${memberIndex}`} className="rounded-xl bg-black/10 px-3 py-2 text-lg font-semibold break-words">{member}</ShapedText>
            ))}
          </ul>
        </motion.section>
      ))}
    </div>
  );
}

export default function PublicView({ roomId = '' }) {
  const { drawState, syncStatus, errorMessage } = usePublicSync({ roomId });

  if (!drawState) return <WaitingStage errorMessage={errorMessage} roomId={roomId} syncStatus={syncStatus} />;

  const {
    title = 'Lucky Draw',
    subtitle = '',
    titleFont = "'Lobster', 'Noto Sans Myanmar', sans-serif",
    subtitleFont = "'Noto Sans Myanmar', 'Myanmar Text', sans-serif",
    displayFont = "'Noto Sans Myanmar', 'Myanmar Text', sans-serif",
    titleColor = '',
    subtitleColor = '',
    titleFontSize = 48,
    subtitleFontSize = 16,
    displayFontSize = 92,
    displayLineHeight = 1.02,
    displayLetterSpacing = 0.1,
    drawMode = 'numbers',
    maxDigits = 2,
    logo,
    winnersHistory = [],
    operationMode = 'standard',
    lastAssignmentResult,
    theme = 'Event Night',
    backgroundImage = '',
  } = drawState;

  const currentTheme = themes[theme] || themes['Event Night'];
  const latestGroup = winnersHistory[winnersHistory.length - 1];
  const legacyDisplayValue = latestGroup?.tickets?.[latestGroup.tickets.length - 1] || (drawMode === 'numbers' ? '0' : 'Ready');
  const legacyPrizes = Array.isArray(drawState.prizes) ? drawState.prizes : [];
  const legacyEntries = Array.isArray(drawState.initialEntries) ? drawState.initialEntries : [];
  const legacyRemainingEntries = Array.isArray(drawState.remainingEntries) ? drawState.remainingEntries : [];
  const live = drawState.live || {
    drawing: false,
    currentPrize: legacyPrizes[winnersHistory.length]?.name || latestGroup?.prize || '',
    displayValue: legacyDisplayValue,
    grandFinalePhase: 'idle',
    showConfetti: false,
    completedPrizeCount: winnersHistory.length,
    prizeCount: legacyPrizes.length || winnersHistory.length,
    totalEntries: legacyEntries.length,
    remainingEntriesCount: legacyRemainingEntries.length,
  };
  const displayValue = live.displayValue || legacyDisplayValue;
  const displayTypography = getTypographyProps(String(displayValue), displayFont, displayLetterSpacing);
  const assignmentResult = lastAssignmentResult?.mode === operationMode ? lastAssignmentResult : null;
  const isAssignmentView = assignmentResult?.mode === 'team-divider' || assignmentResult?.mode === 'role-selector';
  const isGrandFinaleActive = live.grandFinalePhase !== 'idle';
  const isGrandFinaleReveal = live.grandFinalePhase === 'reveal';
  const drawComplete = live.prizeCount > 0 && live.completedPrizeCount >= live.prizeCount;
  const progress = live.prizeCount > 0 ? Math.min(100, (live.completedPrizeCount / live.prizeCount) * 100) : 0;
  const showLetterGlitch = theme === 'Event Night' && !backgroundImage;
  const statusClass = syncStatus === 'live' || syncStatus === 'local'
    ? 'bg-emerald-500/15 text-emerald-200 border-emerald-400/30'
    : syncStatus === 'error' || syncStatus === 'closed' || syncStatus === 'unconfigured'
      ? 'bg-red-500/15 text-red-200 border-red-400/30'
      : 'bg-amber-500/15 text-amber-100 border-amber-400/30';
  const mainStyle = {
    ...currentTheme,
    backgroundImage: backgroundImage ? `linear-gradient(rgba(0,0,0,.48), rgba(0,0,0,.62)), url(${backgroundImage})` : 'none',
    backgroundPosition: 'center',
    backgroundSize: 'cover',
  };

  return (
    <main style={mainStyle} className="relative min-h-screen overflow-hidden bg-[var(--bg-color)] p-4 text-[var(--text-color)] sm:p-6 lg:p-8">
      {showLetterGlitch && (
        <div className="pointer-events-none absolute inset-0 z-0">
          <LetterGlitch glitchColors={LETTER_GLITCH_COLORS} glitchSpeed={70} centerVignette outerVignette={false} smooth />
          <div className="absolute inset-0 bg-black/65" />
        </div>
      )}
      {!showLetterGlitch && !backgroundImage && <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_15%,rgba(255,255,255,0.13),transparent_35%),radial-gradient(circle_at_20%_85%,rgba(6,182,212,0.12),transparent_40%)]" />}
      <AnimatePresence>{isGrandFinaleActive && <GrandFinale phase={live.grandFinalePhase} />}</AnimatePresence>
      {live.showConfetti && Array.from({ length: isGrandFinaleReveal ? 160 : 80 }).map((_, index) => (
        <ConfettiParticle key={`${live.completedPrizeCount}-${live.grandFinalePhase}-${index}`} colors={currentTheme['--confetti-colors']} grand={isGrandFinaleReveal} />
      ))}

      <div className="relative z-20 mx-auto flex min-h-[calc(100vh-2rem)] max-w-[1500px] flex-col">
        <header className="flex items-start justify-between gap-4 rounded-2xl border border-[var(--panel-border)] bg-[var(--panel-bg)]/80 p-4 shadow-2xl backdrop-blur-xl sm:items-center sm:px-6">
          <div className="flex min-w-0 items-center gap-3 sm:gap-5">
            {logo && <img src={logo} alt="Event Logo" className="h-12 w-auto max-w-24 object-contain sm:h-16 sm:max-w-40" />}
            <div className="min-w-0">
              <ShapedText as="h1" fontFamily={titleFont} className="truncate font-black" style={{ color: titleColor || 'var(--title-color)', fontSize: `clamp(1.4rem, ${Math.min(titleFontSize, 72)}px, 5vw)` }}>{title}</ShapedText>
              {subtitle && <ShapedText as="p" fontFamily={subtitleFont} className="mt-0.5 truncate" style={{ color: subtitleColor || 'var(--text-muted)', fontSize: `clamp(.75rem, ${Math.min(subtitleFontSize, 24)}px, 2.4vw)` }}>{subtitle}</ShapedText>}
            </div>
          </div>
          <div title={errorMessage || undefined} className={`flex shrink-0 items-center gap-2 rounded-full border px-3 py-2 text-xs font-bold uppercase tracking-wider ${statusClass}`}>
            <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-60" /><span className="relative inline-flex h-2 w-2 rounded-full bg-current" /></span>
            <span className="hidden sm:inline">{SYNC_LABELS[syncStatus]}</span>
          </div>
        </header>

        {errorMessage && <p role="alert" className="mt-3 rounded-xl border border-red-400/20 bg-red-500/15 px-4 py-2 text-center text-sm text-red-100 backdrop-blur-md">{errorMessage}</p>}

        <div className="grid flex-1 grid-cols-1 gap-4 py-4 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-6 lg:py-6">
          <section className="relative flex min-h-[58vh] flex-col justify-center overflow-hidden rounded-[2rem] border border-[var(--panel-border)] bg-[var(--panel-bg)]/70 p-5 shadow-2xl backdrop-blur-xl sm:p-8 lg:min-h-0">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_45%,rgba(255,255,255,0.1),transparent_48%)]" />
            <div className="relative z-10">
              {isAssignmentView && !live.drawing ? (
                <AssignmentBoard assignmentResult={assignmentResult} displayFont={displayFont} titleFont={titleFont} />
              ) : (
                <div className="flex flex-col items-center text-center">
                  <AnimatePresence mode="wait">
                    <motion.div key={`${live.drawing}-${isGrandFinaleReveal}-${drawComplete}`} initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 12 }} className={`mb-5 rounded-full border px-5 py-2 text-xs font-black uppercase tracking-[0.22em] sm:text-sm ${isGrandFinaleActive ? 'border-yellow-300/70 bg-yellow-300 text-slate-950 shadow-[0_0_30px_rgba(250,204,21,.45)]' : 'border-[var(--panel-border)] bg-black/15'}`}>
                      {isGrandFinaleReveal ? 'Grand prize winner' : live.drawing ? `Now drawing · ${live.currentPrize}` : drawComplete ? 'Draw complete' : latestGroup ? `${latestGroup.prize} winner` : 'Ready for the draw'}
                    </motion.div>
                  </AnimatePresence>

                  <motion.div
                    animate={isGrandFinaleReveal
                      ? { scale: [1, 1.045, 1], boxShadow: ['0 0 25px rgba(250,204,21,.35)', '0 0 95px rgba(250,204,21,.9)', '0 0 40px rgba(250,204,21,.5)'] }
                      : live.drawing ? { scale: [1, 1.012, 1], boxShadow: ['0 0 16px rgba(255,255,255,.12)', '0 0 44px rgba(255,255,255,.28)', '0 0 16px rgba(255,255,255,.12)'] } : {}}
                    transition={{ duration: isGrandFinaleReveal ? 1.2 : 1.7, repeat: live.drawing ? Infinity : 0 }}
                    className="relative flex min-h-44 w-full max-w-4xl items-center justify-center overflow-hidden rounded-[1.75rem] border-4 bg-[var(--display-bg)] px-5 py-8 shadow-inner sm:min-h-64"
                    style={{ borderColor: isGrandFinaleActive ? '#fde047' : 'var(--display-border)' }}
                  >
                    <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(115deg,transparent_20%,rgba(255,255,255,.08)_48%,transparent_72%)]" />
                    {drawMode === 'numbers' ? (
                      <div lang={displayTypography.lang} className="relative flex max-w-full items-center justify-center font-black" style={{ ...displayTypography.style, color: 'var(--display-text)', fontSize: `clamp(3rem, ${Math.min(displayFontSize, 150)}px, ${Math.max(8, 70 / Math.max(maxDigits, 1))}vw)`, lineHeight: displayLineHeight, textShadow: `0 0 28px ${currentTheme['--display-shadow']}`, fontVariantNumeric: 'tabular-nums lining-nums' }}>
                        {getPaddedDigits(displayValue, maxDigits).map((digit, index) => (
                          <span key={index} className="inline-block w-[1ch] text-center"><AnimatePresence mode="popLayout"><motion.span key={`${digit}-${index}`} initial={{ opacity: 0.45, y: -35, filter: 'blur(4px)' }} animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }} exit={{ opacity: 0.25, y: 35, filter: 'blur(4px)' }} transition={{ duration: 0.2 }}>{digit}</motion.span></AnimatePresence></span>
                        ))}
                      </div>
                    ) : (
                      <AnimatePresence mode="wait">
                        <motion.div key={displayValue} initial={{ opacity: 0, scale: 0.92, y: -24 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.92, y: 24 }} className="relative max-w-full break-words px-3 text-center font-black" lang={displayTypography.lang} style={{ ...displayTypography.style, color: 'var(--display-text)', fontSize: `clamp(2.2rem, ${Math.min(displayFontSize, 120)}px, 9vw)`, lineHeight: displayLineHeight, textShadow: `0 0 28px ${currentTheme['--display-shadow']}` }}>{displayValue}</motion.div>
                      </AnimatePresence>
                    )}
                  </motion.div>

                  <div className="mt-6 grid w-full max-w-3xl grid-cols-3 gap-2 text-left sm:gap-4">
                    <div className="rounded-xl border border-[var(--panel-border)] bg-black/10 p-3 sm:p-4"><p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] sm:text-xs">{!live.drawing && latestGroup && !live.showConfetti && !drawComplete ? 'Next prize' : 'Prize'}</p><p className="mt-1 truncate text-sm font-black sm:text-lg">{live.currentPrize || latestGroup?.prize || 'Waiting'}</p></div>
                    <div className="rounded-xl border border-[var(--panel-border)] bg-black/10 p-3 sm:p-4"><p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] sm:text-xs">Progress</p><p className="mt-1 text-sm font-black tabular-nums sm:text-lg">{live.completedPrizeCount} / {live.prizeCount || '—'}</p></div>
                    <div className="rounded-xl border border-[var(--panel-border)] bg-black/10 p-3 sm:p-4"><p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] sm:text-xs">Eligible</p><p className="mt-1 text-sm font-black tabular-nums sm:text-lg">{Number.isFinite(live.remainingEntriesCount) ? live.remainingEntriesCount : '—'}</p></div>
                  </div>
                </div>
              )}
            </div>
          </section>

          <aside className="flex min-h-0 flex-col rounded-[2rem] border border-[var(--panel-border)] bg-[var(--panel-bg)]/78 p-5 shadow-2xl backdrop-blur-xl lg:max-h-[calc(100vh-10.5rem)]">
            <div className="flex items-center justify-between gap-3">
              <div><p className="text-[10px] font-black uppercase tracking-[0.24em] text-[var(--text-muted)]">Results</p><h2 className="mt-1 text-xl font-black">Winner board</h2></div>
              <span className="rounded-full border border-[var(--panel-border)] bg-black/10 px-3 py-1 text-xs font-bold tabular-nums">{winnersHistory.reduce((total, group) => total + group.tickets.length, 0)}</span>
            </div>
            <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-black/15"><motion.div className="h-full rounded-full bg-[var(--button-action-bg)]" animate={{ width: `${progress}%` }} transition={{ duration: 0.7, ease: 'easeOut' }} /></div>

            <div className="mt-4 flex-1 space-y-3 overflow-y-auto pr-1">
              <AnimatePresence initial={false}>
                {winnersHistory.length ? [...winnersHistory].reverse().map((group, reverseIndex) => (
                  <motion.article key={`${group.prize}-${winnersHistory.length - reverseIndex}`} initial={{ opacity: 0, x: 25, scale: 0.96 }} animate={{ opacity: 1, x: 0, scale: 1 }} className={`rounded-2xl border p-4 ${reverseIndex === 0 ? 'border-[var(--button-action-bg)] bg-[var(--button-action-bg)]/10 shadow-lg' : 'border-[var(--panel-border)] bg-black/5'}`}>
                    <ShapedText as="h3" fontFamily={titleFont} className="text-sm font-black break-words" style={{ color: reverseIndex === 0 ? 'var(--title-color)' : 'var(--text-muted)' }}>{group.prize}</ShapedText>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {group.tickets.map((ticket, ticketIndex) => <ShapedText key={`${ticket}-${ticketIndex}`} fontFamily={displayFont} className="rounded-lg bg-[var(--display-bg)] px-3 py-1.5 text-lg font-black break-all" style={{ color: 'var(--display-text)' }}>{ticket}</ShapedText>)}
                    </div>
                  </motion.article>
                )) : (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex h-full min-h-44 items-center justify-center rounded-2xl border border-dashed border-[var(--panel-border)] p-6 text-center text-sm text-[var(--text-muted)]">Winners will appear here live.</motion.div>
                )}
              </AnimatePresence>
            </div>
            {drawState.updatedAt && !Number.isNaN(Date.parse(drawState.updatedAt)) && <p className="mt-4 text-center text-[10px] uppercase tracking-[0.2em] text-[var(--text-muted)]">Updated {new Date(drawState.updatedAt).toLocaleTimeString()}</p>}
          </aside>
        </div>
      </div>
    </main>
  );
}
