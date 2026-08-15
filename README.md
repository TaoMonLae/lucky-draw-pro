# Lucky Draw Pro

Lucky Draw Pro is a customizable React application for running live raffles, prize draws, random name selections, balanced team assignments, and role selections. It includes animated draw effects, layered prize audio, session persistence, audit history, export tools, and a synchronized live audience view.

## Features

- Number-ticket and participant-name draws
- Multiple prizes and multiple winners per prize
- Winner removal, reusable eligibility, and no-repeat controls
- Balanced team divider and configurable role selector
- Undo support and timestamped audit history
- Text and CSV participant import with duplicate cleanup
- JSON session save/load and automatic browser-session restoration
- Winners, assignments, and audit-log exports in CSV, JSON, and PNG formats
- Cross-device live audience view using Supabase Realtime, with a same-browser fallback
- Tiered regular-prize fanfares and an expanded grand-prize finale with bundled Magnific effects
- Event themes, typography controls, logos, and custom background images
- Private Burmese display-font support with Unicode-safe Mon fallback and OpenType shaping
- Animated LetterGlitch background for the default Event Night theme
- Responsive layouts for desktop, tablets, phones, and public displays

## Requirements

- Node.js 18 or newer
- npm
- A modern browser with Canvas and local-storage support
- A Supabase project for optional cross-device synchronization

## Getting Started

Install the locked dependencies:

```bash
npm ci
```

Start the development server:

```bash
npm start
```

Open [http://localhost:3000](http://localhost:3000) in a browser.

## Using the App

1. Open **Settings**.
2. Select **Numbers** or **Names** and enter or import the participants.
3. Configure the operation mode, prizes, winner count, and fairness options.
4. Close Settings and hold **Hold to Draw**, or use the Space shortcut.
5. Open **History & Audit** to undo results or export the session data.

### Operation Modes

- **Standard Draw** selects winners for each configured prize.
- **Team Divider** shuffles participants into balanced teams.
- **Role Selector** assigns participants to roles using `Role:Count` rules.

### Keyboard Shortcuts

- `Space` — run the next draw
- `S` — open Settings
- `F` — toggle fullscreen
- `Escape` — close Settings

### Live Public View

For another tab in the same browser profile, open **Settings → Public View** and use the fallback public link. It includes this query parameter:

```text
?view=public
```

For phones, tablets, projectors, and other computers, configure Supabase and select **Start Cross-Device Room**. Share the generated room link; the current draw animation, prize name, event styling, progress, winner history, grand-prize finale, and team or role results will update live. **Stop Sharing** closes the room and removes its public state.

### Secure MC Remote

After starting a cross-device room, open **Settings → Audience → MC Remote Control** and select **Enable Secure MC Remote**. Copy the private remote link to the event host or MC's phone or tablet. The remote can request the next draw while the host computer performs the actual eligibility checks, winner selection, animation, and audio.

The remote link contains a bearer credential in its URL fragment. Do not share it with the audience. Use **Rotate Link** immediately if it is exposed; the previous link will stop working. **Disable** revokes remote access without closing the audience display.

## Supabase Cross-Device Setup

1. Create a Supabase project.
2. Open the project’s SQL Editor and run [`supabase/schema.sql`](supabase/schema.sql). Rerun the complete file after app upgrades so the latest remote-control functions are installed.
3. Copy `.env.example` to `.env.local` and fill in the project URL and publishable key:

```bash
REACT_APP_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
REACT_APP_SUPABASE_PUBLISHABLE_KEY=sb_publishable_YOUR_KEY
```

4. Restart `npm start` after changing local environment variables.
5. For Vercel, add both variables in **Project Settings → Environment Variables**, then redeploy the app.
6. Open **Settings → Public View**, start a room, and share its generated link.

Use a Supabase publishable key in the browser. Never put a secret key or `service_role` key in a `REACT_APP_*` variable.

## Private Burmese Fonts

Licensed font binaries live in `public/private-fonts/` and are versioned so Git-based Vercel deployments can serve them. Generated copies in `build/private-fonts/` remain ignored to avoid storing each binary twice.

The application enables OpenType kerning, common/contextual ligatures, glyph composition, localized forms, and mark positioning. Letter spacing is automatically reset to zero for Unicode Myanmar text because tracking can damage complex-script clusters.

Most of the supplied private faces cover core Burmese but do not include the dedicated Mon characters U+105A–U+1060. When those characters are detected, the complete text run automatically switches to Noto Sans Myanmar and receives `lang="mnw"`, preventing a Mon syllable from being split across incompatible fonts.

Important: these web-font files are publicly downloadable from the repository and deployed application. Keep them versioned only while the font license permits public web embedding and redistribution.

## Available Scripts

### `npm start`

Runs the application in development mode at `http://localhost:3000`.

### `npm test`

Runs the Jest test suite in watch mode. For a single CI-style run:

```bash
CI=true npm test -- --watchAll=false
```

### `npm run build`

Creates an optimized production build in the `build/` directory.

## Project Structure

```text
src/
├── components/    Host, public display, shared UI, and visual effects
├── hooks/         Audio, persistence, shortcuts, and realtime synchronization
├── lib/           Supabase client configuration
├── utils/         Parsing, validation, draw modes, templates, and exports
├── App.js         Host/public view routing
└── index.js       React entry point
supabase/
└── schema.sql     Room tables, security policies, RPCs, and Realtime publication
```

## Data and Privacy

Session autosaves, full participant lists, audit logs, and exports stay in the host browser. When cross-device sharing is enabled, Supabase receives only public event styling, a size-limited logo and background, transient draw-display values and progress counts, public winner history, public team/role results, and short-lived remote draw requests. Participant lists and audit logs are never published. Room write credentials remain in the host browser; MC remote credentials are stored only as hashes in Supabase, requests are rate-limited, and rooms expire automatically after seven days.

## Audio Sources

The bundled reveal and audience effects come from Magnific's stock sound-effects catalog: [Reversed Cymbal Swell Into Impact](https://www.magnific.com/audio/sound-effects/reversed-cymbal-swell-into-impact/5341) and [Crowd cheering and applauding](https://www.magnific.com/audio/sound-effects/crowd-cheering-and-applauding/197). Crowd audio is filtered and volume-controlled to soften shrill whistles; non-melodic synthesized impact and applause remain as loading fallbacks.

## Developer

Developed by **Tao Mon Lae**.
