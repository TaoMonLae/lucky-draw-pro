import React from 'react';
import './GrandFinale.css';

export default function GrandFinale({ phase }) {
  if (phase !== 'build' && phase !== 'reveal') return null;

  return (
    <div aria-hidden="true" className={`grand-stage grand-stage--${phase}`}>
      <div className="grand-stage__wash" />
      <div className="grand-stage__beam grand-stage__beam--left" />
      <div className="grand-stage__beam grand-stage__beam--right" />
      <div className="grand-stage__focus" />
      <div className="grand-stage__floor" />
    </div>
  );
}
