# utepils

This project is an experiment in building an app using only AI.

Remix 3 MVP for checking whether a clicked outdoor spot is in sun or shade today, assuming clear skies.

## What it does

- Renders a Google Maps JavaScript map centered on Oslo.
- Lets you click a point and request `/api/poi-profile`.
- Fetches a Google Solar API DSM GeoTIFF server-side with `view=DSM_LAYER`, `requiredQuality=HIGH`, and 0.5m pixels.
- Computes a 360-degree obstruction horizon by raymarching building and tree-canopy heights.
- Computes sun position in the browser so the time scrubber updates instantly after the profile arrives.

## Environment

`.env` is gitignored. Local development expects:

```sh
GOOGLE_MAPS_PLATFORM_API_KEY=...
GOOGLE_MAPS_PLATFORM_REFERER=http://localhost:3000/
```

## Commands

```sh
npm install
npm run dev
npm test
npm run typecheck
```
