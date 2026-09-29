import React from 'react';
import { useReducedMotion } from 'framer-motion';
import { getTypographyProps } from '../utils/typography';
import RollingDigits from './react-bits/RollingDigits';
import StaggeredText from './react-bits/StaggeredText';
import './DrawDisplay.css';

const MODE_LABELS = { standard: 'Raffle draw', 'team-divider': 'Team divider', 'role-selector': 'Role selector' };

export default function DrawDisplay({ value = 'Ready', drawing = false, charging = false, chargeProgress = 0, mode = 'standard', drawMode = 'numbers', maxDigits = 2, lockedDigits = '', result, revealed = false, finale = false, context = '', fontFamily, fontSize = 92, lineHeight = 1.2, letterSpacing = 0, minHeight = 180 }) {
  const reducedMotion = useReducedMotion();
  const assignment = mode !== 'standard';
  const matchingResult = result?.mode === mode ? result : null;
  const groups = !drawing && !charging && matchingResult
    ? mode === 'team-divider'
      ? matchingResult.teams.map((team) => ({ label: team.teamName, members: team.members }))
      : matchingResult.assignments.map((role) => ({ label: role.role, members: role.participants }))
    : [];
  const phase = drawing ? 'live' : charging ? 'charging' : groups.length || revealed ? 'result' : 'ready';
  const text = drawing && reducedMotion ? 'Selecting...' : String(value ?? 'Ready');
  const numeric = !assignment && drawMode === 'numbers' && /^\d+$/.test(text);
  const digits = numeric ? text.padStart(maxDigits, '0').split('') : [];
  const typography = getTypographyProps(text, fontFamily, letterSpacing);
  const status = drawing ? (assignment ? 'Assigning participants' : 'Selection in motion') : charging ? 'Preparing selection' : phase === 'result' ? (assignment ? 'Assignment complete' : 'Winner confirmed') : 'Ready when you are';

  return (
    <section className="draw-console" data-phase={phase} aria-label={MODE_LABELS[mode]} style={{ '--stage-size': `${Math.max(28, fontSize)}px`, '--stage-height': `${Math.max(160, Math.min(minHeight, 360))}px` }}>
      <header className="draw-console__header">
        <span className="draw-console__mode">{MODE_LABELS[mode]}</span>
        <span className="draw-console__signal"><i />{charging ? 'Charging' : finale ? 'Final round' : drawing ? 'On air' : phase === 'result' ? 'Recorded' : 'Standby'}</span>
      </header>
      {context && <p className="draw-console__context">{context}</p>}
      {groups.length ? (
        <div className="draw-console__groups" tabIndex={0} role="region" aria-label="Assignment results">
          {groups.map((group, index) => (
            <section className="draw-console__group" key={`${group.label}-${index}`}>
              <h3><span className="draw-console__index">{String(index + 1).padStart(2, '0')}</span><span {...getTypographyProps(group.label, fontFamily, 0)}>{group.label}</span><small>{group.members.length}</small></h3>
              <ul>{group.members.map((member, memberIndex) => <li key={`${member}-${memberIndex}`} {...getTypographyProps(String(member), fontFamily, 0)}>{member}</li>)}</ul>
            </section>
          ))}
        </div>
      ) : (
        <div className="draw-console__viewport" aria-hidden="true">
          {numeric ? (
            <div className="draw-console__digits" lang={typography.lang} style={{ ...typography.style, '--digit-count': digits.length, lineHeight: Math.max(1.15, lineHeight) }}>
              <RollingDigits digits={digits} reducedMotion={reducedMotion} lockedDigits={lockedDigits} />
            </div>
          ) : <div className="draw-console__name" lang={typography.lang} style={{ ...typography.style, lineHeight: Math.max(1.4, lineHeight) }}>{text}</div>}
          <div className="draw-console__scan" />
        </div>
      )}
      <footer className="draw-console__footer">
        <div className="draw-console__meter" aria-hidden="true">{Array.from({ length: 16 }, (_, index) => <i key={index} className={charging && index < Math.ceil(chargeProgress * 16 / 100) ? 'is-filled' : ''} style={{ '--bar': index }} />)}</div>
        <div className="draw-console__caption"><StaggeredText key={status} text={status} />{charging && <span aria-hidden="true"> · {chargeProgress}%</span>}</div>
      </footer>
      <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">{drawing || charging ? status : groups.length ? `${status}. ${groups.length} groups.` : phase === 'result' ? `Winner: ${value}` : status}</p>
    </section>
  );
}
