# Drawing stage reference lock

Scope: redesign the host and audience drawing stage within the existing event
themes, not replace event branding or user-selected Myanmar typography.

## Direction and decisions

- Primary: Cassette (https://cassettemusic.com), Refero style
  `1dcf16c3-2708-4b74-b11a-f9cd515e541d`. Adapt its music-console hierarchy,
  compact technical labels, strong light/dark contrast and disciplined accents.
  Preserve existing theme tokens rather than importing a second palette.
- Secondary: DICE (https://dice.fm), Refero style
  `052955b0-1e25-4ed9-809d-5e0095094f97`. Borrow event-first typography hierarchy
  and restrained framing, not its brand font or promotional imagery.
- Detail: Uniswap Cup (https://unicup.uniswap.org), Refero style
  `46156b44-5f16-42f5-8257-c921ba0385c5`. Borrow fixed-width scoreboard numerals
  and thin rules. Do not import its competitive fuchsia accents.
- Screen research: Deezer song quiz, Refero screen
  `f4a8960f-a6de-4a95-b22d-be656d7fd95b`. Borrow a distinct activity indicator
  and completion state rather than its purple palette.

The existing product is the build target. The signature is a framed broadcast
console with numbered result groups, bounded digit bays and a small signal meter.
Code-native graphics are appropriate here; no stock photos, fake instrument
imagery, card-wall layout, oversized glows or new background shader.

## Implementation choices

- Shared DrawDisplay prevents host/audience animation and mode-label drift.
- Digit transitions replace in place; outgoing digits cannot overlap or create
  scrollbars. Only assignment results intentionally scroll.
- React Bits Pro staggered-text-tw is adapted to JavaScript and the existing
  framer-motion runtime. Word segmentation preserves Myanmar shaping.
- New stage motion respects reduced-motion preferences and does not announce
  rapidly changing candidates to screen readers.
- Team and role playback takes a bounded 1.6 seconds rather than 2.5 seconds
  per group; the final board keeps every assigned participant accessible.
- Existing theme display colors remain authoritative; 8px stage corners and
  1px rules replace the heavy rounded frame.

## Validation status

Validated on 2026-09-30: the full test suite passed (133 tests), the production
build compiled successfully, and the winner celebration was checked in desktop
and phone browser viewports. The host replay and pause controls were exercised.
