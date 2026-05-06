# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # dev server at http://localhost:5173 (HMR)
npm run build     # production build → dist/index.html (single self-contained file)
npm run lint      # ESLint
npm run preview   # preview the production build locally
```

## Architecture

This is a single-page Pomodoro timer. All logic lives in **`src/App.jsx`**; there are no routes, no state management library, and no backend.

### Key design decisions

**Single-file output** — `vite-plugin-singlefile` inlines all JS and CSS into `dist/index.html` so the file can be opened directly in a browser or shared without a server. After every change, run `npm run build` and commit `dist/index.html`.

**Custom durations** — The static `MODES` object holds only labels and colors. Minutes are stored in `customMinutes` state (initialized from `localStorage` key `pomodoroMinutes`). A `customMinRef` ref mirrors this state so `handleComplete` can always read the latest value without being listed as a dependency.

**Audio** — Uses the Web Audio API (`AudioContext`). The context must be created/resumed during a user gesture to avoid the browser's autoplay policy suspending it. `ensureAudioCtx()` is called inside `handleToggle` (button click) so the context is active when the timer fires `playSound()` at completion.

**Notifications** — The Notifications API is not available on iOS Safari and some Android browsers. All access is guarded with `typeof Notification !== 'undefined'` checks.

**Mobile** — Buttons carry `touch-action: manipulation` to eliminate the 300 ms tap delay on Android. The card width uses `min(360px, 100vw - 32px)` to fit small screens.

**Fonts (offline)** — Playfair Display is self-hosted in `src/fonts/` (4 WOFF2 subsets: latin, latin-ext, vietnamese, cyrillic). `src/fonts.css` declares the `@font-face` rules with relative paths; `src/index.css` imports it. Vite's `assetsInlineLimit: 100_000_000` converts all WOFF2 files to base64 data URIs in the CSS, which `vite-plugin-singlefile` then embeds into the final HTML. Do **not** use an external CDN link for these fonts — the single-file build must work offline.

**UI theme** — Warm paper / wabi-sabi aesthetic. Light cream background (`#faf4eb`), Playfair Display for the timer numerals, Noto Sans SC (system fallback) for Chinese labels. The SVG ring uses a thin 8px stroke with 60 dial tick marks. Mode accent colors: rose `#c0566a` / sage `#4a8a68` / slate `#4a6a9c`.
