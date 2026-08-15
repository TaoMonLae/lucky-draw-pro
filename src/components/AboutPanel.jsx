import React from 'react';

const ABOUT_FEATURES = [
  {
    icon: '◎',
    title: 'Flexible draws',
    description: 'Draw numbers or names, divide balanced teams, and assign configurable roles.',
  },
  {
    icon: '↗',
    title: 'Live audience view',
    description: 'Mirror the show to a projector, another browser, or remote devices with Supabase.',
  },
  {
    icon: '⌁',
    title: 'Secure MC remote',
    description: 'Let an MC request the next draw from a private phone or tablet link.',
  },
  {
    icon: '✦',
    title: 'Show-ready finale',
    description: 'Cinematic grand-prize motion, layered audio, and an all-winners celebration carousel.',
  },
  {
    icon: '✓',
    title: 'Fair and auditable',
    description: 'Eligibility controls, no-repeat options, undo support, history, and exportable audit logs.',
  },
  {
    icon: 'Aa',
    title: 'Event branding',
    description: 'Themes, custom fonts, Unicode-safe Myanmar text, logos, and background images.',
  },
];

export default function AboutPanel() {
  return (
    <section aria-labelledby="about-lucky-draw-pro" className="space-y-4 text-[var(--text-muted)]">
      <div className="relative overflow-hidden rounded-[1.75rem] border border-yellow-300/25 bg-[linear-gradient(135deg,rgba(15,23,42,.98),rgba(8,47,73,.9)_55%,rgba(49,24,72,.9))] p-5 text-white shadow-xl sm:p-6">
        <div className="pointer-events-none absolute -right-12 -top-16 h-44 w-44 rounded-full bg-yellow-300/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 left-12 h-40 w-40 rounded-full bg-cyan-400/15 blur-3xl" />
        <div className="relative flex items-start gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-yellow-200/40 bg-gradient-to-br from-yellow-200 via-amber-400 to-orange-500 text-2xl font-black text-slate-950 shadow-[0_0_28px_rgba(250,204,21,.25)]">✦</div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[.24em] text-yellow-300">Live Event Edition</p>
                <h3 id="about-lucky-draw-pro" className="mt-1 text-2xl font-black tracking-tight text-white">Lucky Draw Pro</h3>
              </div>
              <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-black text-white">v2.1.0</span>
            </div>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-200">A complete live-event toolkit for fair winner selection, confident stage control, and memorable audience celebrations.</p>
          </div>
        </div>
      </div>

      <div>
        <p className="mb-3 text-xs font-black uppercase tracking-[.18em] text-[var(--text-color)]">Everything needed on show day</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {ABOUT_FEATURES.map((feature) => (
            <article key={feature.title} className="rounded-2xl border border-[var(--panel-border)] bg-[var(--input-bg)]/35 p-4 transition-colors hover:border-yellow-300/35">
              <div className="flex items-start gap-3">
                <span aria-hidden="true" className="flex h-9 min-w-9 items-center justify-center rounded-xl border border-[var(--panel-border)] bg-black/15 text-sm font-black text-yellow-300">{feature.icon}</span>
                <div>
                  <h4 className="text-sm font-bold text-[var(--text-color)]">{feature.title}</h4>
                  <p className="mt-1 text-xs leading-relaxed">{feature.description}</p>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-[1.35fr_.65fr]">
        <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/[.06] p-4">
          <p className="text-xs font-black uppercase tracking-[.16em] text-emerald-300">Privacy and control</p>
          <p className="mt-2 text-xs leading-relaxed">Winner selection and eligibility checks stay on the host computer. Audience screens receive display-safe event state, while the MC remote can only request a draw—it cannot choose winners or access the participant list.</p>
        </div>
        <div className="flex flex-col justify-center rounded-2xl border border-[var(--panel-border)] bg-[var(--input-bg)]/35 p-4">
          <p className="text-[10px] font-black uppercase tracking-[.16em]">Created by</p>
          <p className="mt-1 text-base font-black text-[var(--text-color)]">Tao Mon Lae</p>
          <p className="mt-1 text-[11px]">Built for exciting, reliable live events.</p>
          <a
            href="https://github.com/TaoMonLae"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex w-fit items-center gap-2 rounded-full border border-[var(--panel-border)] bg-black/10 px-3 py-1.5 text-xs font-bold text-[var(--text-color)] transition hover:border-yellow-300/50 hover:text-yellow-300"
          >
            <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4 fill-current">
              <path d="M12 2C6.48 2 2 6.58 2 12.23c0 4.52 2.87 8.35 6.84 9.71.5.1.68-.22.68-.49 0-.24-.01-1.05-.01-1.9-2.78.62-3.37-1.21-3.37-1.21-.46-1.18-1.11-1.5-1.11-1.5-.91-.64.07-.62.07-.62 1 .07 1.53 1.06 1.53 1.06.9 1.56 2.35 1.11 2.92.85.09-.66.35-1.11.64-1.37-2.22-.26-4.56-1.14-4.56-5.06 0-1.12.39-2.03 1.03-2.75-.1-.26-.45-1.3.1-2.71 0 0 .84-.28 2.75 1.05A9.3 9.3 0 0 1 12 6.95a9.3 9.3 0 0 1 2.5.35c1.91-1.33 2.75-1.05 2.75-1.05.55 1.41.2 2.45.1 2.71.64.72 1.03 1.63 1.03 2.75 0 3.93-2.34 4.79-4.57 5.05.36.32.68.94.68 1.9 0 1.37-.01 2.47-.01 2.8 0 .27.18.59.69.49A10.25 10.25 0 0 0 22 12.23C22 6.58 17.52 2 12 2Z" />
            </svg>
            GitHub profile
            <span aria-hidden="true">↗</span>
          </a>
        </div>
      </div>
    </section>
  );
}
