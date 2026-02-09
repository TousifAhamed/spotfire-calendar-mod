# Calendar Chart — Spotfire Visualization Mod

[![GitHub](https://img.shields.io/badge/GitHub-TousifAhamed-181717?logo=github)](https://github.com/TousifAhamed/spotfire-calendar-mod)
[![License](https://img.shields.io/badge/License-BSD%203--Clause-blue.svg)](https://opensource.org/licenses/BSD-3-Clause)
[![Spotfire Mod](https://img.shields.io/badge/Spotfire-Visualization%20Mod-orange)](https://www.spotfire.com/)

A Spotfire® visualization mod that renders a **D3-based calendar heatmap chart**, inspired by the [Observable D3 Calendar](https://observablehq.com/@d3/calendar/2). Each cell represents a day, colored by a continuous value, organized into rows by year.

## Features

- **Year-over-year calendar heatmap** — one row per year, 7 days × 53 weeks grid
- **25+ color schemes** — diverging (PiYG, RdYlGn, Spectral) and sequential (Viridis, Blues, Inferno, Turbo, etc.)
- **Custom colors** — define your own min/max color gradient
- **Spotfire marking** — click cells to select data points; Ctrl+click to add/toggle
- **Tooltips** — hover over cells to see date and value details
- **Month separators** — thin outlines delineate each month within a year
- **Configurable week start** — Monday or Sunday
- **Hide specific days** — remove weekends or any day-of-week from the view
- **Week numbers** — optionally display ISO week numbers
- **Responsive** — adapts cell size to the available window area
- **Export-ready** — properly signals render complete for Spotfire export

## Screenshot

> Add a screenshot here by placing an image in the repo and referencing it:
> `![Calendar Chart Screenshot](screenshot.png)`

## Axes

| Axis | Mode | Description |
|------|------|-------------|
| **Date** | Categorical | The date column (one row per day). Accepts various date formats. |
| **Value** | Continuous | The numeric value to visualize for each day cell. |
| **ColorBy** | Dual | *(Optional)* Override cell color via a Spotfire color expression. |

## Mod Properties

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `colorScheme` | string | `PiYG` | D3 color interpolator name. Options include: PiYG, RdYlGn, RdBu, BrBG, Blues, Greens, Viridis, Inferno, Turbo, etc. |
| `weekStart` | string | `sunday` | First day of the week: `monday` or `sunday`. |
| `showMonthLabels` | boolean | `true` | Show abbreviated month labels above each year row. |
| `showDayLabels` | boolean | `true` | Show day-of-week labels (Mon, Wed, Fri) to the left. |
| `customMinColor` | string | *(empty)* | Custom hex color for the low end of the scale. Leave empty to use the selected color scheme. |
| `customMaxColor` | string | *(empty)* | Custom hex color for the high end of the scale. Leave empty to use the selected color scheme. |
| `hiddenDays` | string | *(empty)* | Comma-separated day indices to hide (0=Sun, 1=Mon, ..., 6=Sat). E.g. `"0,6"` hides weekends. |
| `showWeekNumbers` | boolean | `false` | Display ISO week numbers above the calendar grid. |

## Prerequisites

- [Node.js](https://nodejs.org/) version 22 LTS or later
- A running instance of Spotfire (installed client or web client via Chrome)
- [Visual Studio Code](https://code.visualstudio.com/) *(recommended)*

## Getting Started

### With Development Server

1. Clone this repository:
   ```sh
   git clone https://github.com/TousifAhamed/spotfire-calendar-mod.git
   cd spotfire-calendar-mod
   ```
2. Install dependencies:
   ```sh
   npm install
   ```
3. Press **Ctrl+Shift+B** in VS Code to start the build watchers, or run:
   ```sh
   npm run start
   ```
4. In Spotfire, open an analysis with date-based data.
5. Go to **Tools → Development → Mods development**.
6. Click **Connect to development server** and verify the port (default `8090`).
7. Click **Add to page** to place the calendar chart on the current page.
8. Configure the **Date** axis to a date column and the **Value** axis to a numeric measure.

### Without a Development Server

1. Run `npm install` (first time only).
2. Run `npm run build` — this bundles and minifies the JavaScript into the `build` folder.
3. In Spotfire, create a new mod and browse to the `mod-manifest.json` file.

## Build Scripts

| Command | Description |
|---------|-------------|
| `npm run build` | Minified production build |
| `npm run build:dev` | Unminified watch build with source maps |
| `npm run start` | Alias for `build:dev` (watch mode) |
| `npm run server` | Start the Spotfire mods dev server |

## Project Structure

```
spotfire-calendar-mod/
├── .vscode/
│   ├── settings.json        # JSON schema for mod manifest
│   └── tasks.json           # Build tasks (Ctrl+Shift+B)
├── src/
│   ├── main.ts              # Spotfire mod entry point & read-render loop
│   ├── render.ts            # D3 calendar rendering logic
│   ├── data.ts              # Data parsing from Spotfire DataView
│   └── colorSchemes.ts      # D3 color interpolator registry
├── build/                   # Compiled output (generated)
├── index.html               # HTML entry point with Spotfire loader
├── main.css                 # Chart styles
├── mod-manifest.json        # Spotfire mod manifest
├── package.json             # npm dependencies & scripts
├── tsconfig.json            # TypeScript configuration
├── esbuild.config.js        # esbuild bundler configuration
└── README.md                # This file
```

## Tech Stack

- **TypeScript** — type-safe source code
- **D3.js v7** — calendar layout, color scales, and SVG rendering
- **esbuild** — fast bundling via `@spotfire/mods-sdk`
- **Spotfire Mods API v1.3** — integration with Spotfire analytics platform

## Limitations

- Maximum of 100,000 data rows supported per rendering cycle.
- The Date axis expects parsable date strings. Non-date values are silently skipped.
- The chart is optimized for daily granularity; sub-daily or weekly data may not render as expected.

## Author

**Tousif Ahamed** — [GitHub](https://github.com/TousifAhamed)

## License

Licensed under the [3-Clause BSD](https://opensource.org/licenses/BSD-3-Clause) License.
