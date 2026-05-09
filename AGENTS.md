# utepils Agent Guide

This is a Remix 3 beta app. It uses Fetch API routes/controllers, not Remix v2 route modules.

## Commands

```sh
npm run dev
npm test
npm run typecheck
```

## Route Ownership

- `app/routes.ts` defines route contracts.
- `app/router.ts` maps routes to controllers.
- `app/controllers/home.tsx` renders the app shell.
- `app/controllers/api.ts` owns `/api/config` and `/api/poi-profile`.
- `app/services/solar.ts` owns Google Solar API and GeoTIFF parsing.
- `app/services/horizon.ts` owns DSM raymarching and horizon profile computation.
- `app/assets/sun-app.ts` owns browser-side Google Maps, SunCalc, and the time scrubber.

## Important Constraints

- DSM fetching stays server-side.
- Google Maps JavaScript key is exposed to the browser by design.
- `GOOGLE_MAPS_PLATFORM_REFERER` must match the HTTP referrer restrictions configured on the key.
- The Solar API does not accept a `signature` query parameter on `dataLayers:get`; use the API key and an allowed referrer.
