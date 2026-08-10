# Lucky Draw Pro

Lucky Draw Pro is a customizable React application for running live raffles, prize draws, random name selections, balanced team assignments, and role selections. It includes animated draw effects, sound controls, session persistence, audit history, export tools, and a synchronized public winners view.

## Features

- Number-ticket and participant-name draws
- Multiple prizes and multiple winners per prize
- Winner removal, reusable eligibility, and no-repeat controls
- Balanced team divider and configurable role selector
- Undo support and timestamped audit history
- Text and CSV participant import with duplicate cleanup
- JSON session save/load and automatic browser-session restoration
- Winners, assignments, and audit-log exports in CSV, JSON, and PNG formats
- Synchronized public winners view using `BroadcastChannel` with a storage fallback
- Event themes, typography controls, logos, and custom background images
- Animated LetterGlitch background for the default Event Night theme
- Responsive layouts for desktop, tablets, phones, and public displays

## Requirements

- Node.js 18 or newer
- npm
- A modern browser with Canvas and local-storage support

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

### Public Winners View

Open the app in a second tab and append this query parameter to the same page URL:

```text
?view=public
```

Keep the host and public pages in the same browser profile and on the same origin so results can synchronize automatically. A separate phone or computer will need a shared backend before it can receive live results.

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
├── hooks/         Audio, persistence, shortcuts, and public synchronization
├── utils/         Parsing, validation, draw modes, templates, and exports
├── App.js         Host/public view routing
└── index.js       React entry point
```

## Data and Privacy

Lucky Draw Pro runs locally in the browser. Session autosaves, participant data, logos, and custom backgrounds are stored in browser local storage. Exported files are created on the user’s device; the app does not require a backend service.

## Developer

Developed by **Tao Mon Lae**.
