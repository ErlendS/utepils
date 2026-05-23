import { css } from "remix/ui";

import { routes } from "../routes.ts";

const FONT_STACK =
  'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

export function SunPage() {
  return () => (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <meta name="color-scheme" content="light" />
        <meta name="robots" content="noindex,nofollow" />
        <title>utepils</title>
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link
          rel="icon"
          type="image/png"
          sizes="32x32"
          href="/favicon-32x32.png"
        />
        <link
          rel="icon"
          type="image/png"
          sizes="16x16"
          href="/favicon-16x16.png"
        />
        <link
          rel="apple-touch-icon"
          sizes="180x180"
          href="/apple-touch-icon.png"
        />
        <link rel="manifest" href="/site.webmanifest" />
        <script
          type="module"
          src={routes.assets.href({ path: "app/assets/entry.ts" })}
        ></script>
        <script
          type="module"
          src={routes.assets.href({ path: "app/assets/sun-app.ts" })}
        ></script>
      </head>
      <body mix={pageStyle}>
        <div id="sky-backdrop" mix={skyBackdropStyle} aria-hidden="true">
          <div mix={skyStarsStyle}></div>
        </div>
        <div id="app-shell" mix={shellStyle}>
          <aside mix={panelStyle}>
            <div>
              <div mix={brandStyle}>
                <img src="/logo.png" alt="Utepils logo" />
                <span>utepils</span>
              </div>
              <h1 mix={titleStyle}>
                Can I enjoy a beer in the sun right now? 🍻
              </h1>
              <p mix={copyStyle}>
                Click a spot on the map to see when it gets direct sunlight
                today. Use the time slider to check how the sun changes through
                the day.
              </p>
            </div>

            <div mix={dividerStyle} aria-hidden="true"></div>

            <section mix={searchStyle} aria-label="Address search">
              <p>Address</p>
              <div mix={searchControlsStyle}>
                <div id="place-search" mix={placeSearchStyle}></div>
                <button
                  id="use-location-button"
                  type="button"
                  mix={locationButtonStyle}
                  aria-label="Use my location"
                  title="Use my location"
                >
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                  >
                    <circle cx="12" cy="12" r="7" />
                    <circle cx="12" cy="12" r="2" />
                    <path d="M12 2v3" />
                    <path d="M12 19v3" />
                    <path d="M2 12h3" />
                    <path d="M19 12h3" />
                  </svg>
                </button>
              </div>
              <p
                id="place-search-message"
                mix={placeSearchMessageStyle}
                aria-live="polite"
              ></p>
            </section>

            <section mix={statusCardStyle} aria-live="polite">
              <div mix={statusHeaderStyle}>
                <span id="status-dot" mix={statusDotStyle}></span>
                <div>
                  <p id="status-label" mix={statusLabelStyle}>
                    Choose a point
                  </p>
                  <p id="status-detail" mix={statusDetailStyle}>
                    Click the map to compute a profile.
                  </p>
                </div>
              </div>
              <dl mix={factsStyle}>
                <div>
                  <dt title="The latitude and longitude of the spot selected on the map.">
                    Point
                  </dt>
                  <dd id="point-readout">None selected</dd>
                </div>
                <div>
                  <dt title="Digital Surface Model: elevation data for ground, buildings, and tree canopy.">
                    DSM
                  </dt>
                  <dd id="dsm-readout">Waiting</dd>
                </div>
                <div>
                  <dt title="Copy a link to this selected map point.">
                    Share location
                  </dt>
                  <dd>
                    <button
                      id="copy-link-button"
                      type="button"
                      mix={copyLinkButtonStyle}
                      disabled
                    >
                      None selected
                    </button>
                  </dd>
                </div>
              </dl>
            </section>

            <section mix={scrubberStyle}>
              <div mix={scrubberHeaderStyle}>
                <label htmlFor="time-slider">Time today</label>
                <output id="time-output" htmlFor="time-slider">
                  --:--
                </output>
              </div>
              <input
                id="time-slider"
                type="range"
                min="0"
                max="1439"
                step="1"
              />
              <div
                id="sun-windows"
                mix={windowsStyle}
                role="img"
                aria-label="Sun windows today"
              ></div>
            </section>
          </aside>

          <main mix={mapWrapStyle}>
            <div id="map" mix={mapStyle}></div>
            <div id="map-sky-overlay" mix={mapSkyOverlayStyle}></div>
            <div id="map-toast" mix={toastStyle} role="alert"></div>
          </main>
        </div>
      </body>
    </html>
  );
}

const pageStyle = css({
  "--map-sky-gradient":
    "linear-gradient(180deg, rgba(115, 183, 230, 0.1), rgba(247, 221, 151, 0.02))",
  "--map-sky-opacity": "0.12",
  "--sky-bottom": "#dbefff",
  "--sky-glow": "rgba(255, 220, 134, 0.4)",
  "--sky-mid": "#98cdf0",
  "--sky-star-opacity": "0",
  "--sky-top": "#5eabdf",
  "--ui-brand-text": "#31413a",
  "--ui-card-bg": "rgba(255, 255, 255, 0.24)",
  "--ui-card-border": "rgba(255, 255, 255, 0.36)",
  "--ui-card-highlight": "rgba(255, 255, 255, 0.2)",
  "--ui-control-bg": "rgba(255, 255, 255, 0.24)",
  "--ui-control-border": "rgba(255, 255, 255, 0.36)",
  "--ui-control-hover-bg": "rgba(255, 255, 255, 0.34)",
  "--ui-control-hover-border": "rgba(255, 255, 255, 0.5)",
  "--ui-divider": "rgba(215, 221, 210, 0.76)",
  "--ui-error-text": "#b14242",
  "--ui-focus": "rgba(86, 160, 200, 0.4)",
  "--ui-label": "#34413b",
  "--ui-logo-shadow": "rgba(245, 185, 63, 0.25)",
  "--ui-slider-thumb": "#f5b93f",
  "--ui-slider-thumb-border": "rgba(255, 255, 255, 0.72)",
  "--ui-slider-thumb-shadow": "rgba(16, 29, 51, 0.18)",
  "--ui-status-divider": "rgba(237, 241, 234, 0.82)",
  "--ui-text": "#17201d",
  "--ui-text-muted": "#4f5c55",
  "--ui-window-fill": "rgba(255, 255, 255, 0.16)",
  "--ui-window-bg": "transparent",
  margin: 0,
  minHeight: "100vh",
  background: "var(--sky-bottom)",
  color: "var(--ui-text)",
  fontFamily: FONT_STACK,
  "& *, & *::before, & *::after": { boxSizing: "border-box" },
});

const skyBackdropStyle = css({
  background:
    "linear-gradient(180deg, var(--sky-top) 0%, var(--sky-mid) 48%, var(--sky-bottom) 100%)",
  inset: 0,
  overflow: "hidden",
  pointerEvents: "none",
  position: "fixed",
  zIndex: 0,
  "&::before": {
    background:
      "radial-gradient(circle at 72% 18%, var(--sky-glow) 0 8%, rgba(255, 255, 255, 0) 28%)",
    content: '""',
    inset: 0,
    opacity: 0.9,
    position: "absolute",
  },
});

const skyStarsStyle = css({
  animation: "sky-stars-flicker 4.8s ease-in-out infinite",
  backgroundImage:
    "radial-gradient(circle at 8% 18%, rgba(255, 255, 255, 0.9) 0 1px, transparent 1.7px), radial-gradient(circle at 18% 72%, rgba(255, 255, 255, 0.72) 0 1px, transparent 1.6px), radial-gradient(circle at 33% 28%, rgba(255, 255, 255, 0.86) 0 1px, transparent 1.8px), radial-gradient(circle at 47% 12%, rgba(255, 255, 255, 0.68) 0 1px, transparent 1.5px), radial-gradient(circle at 59% 62%, rgba(255, 255, 255, 0.82) 0 1px, transparent 1.7px), radial-gradient(circle at 73% 34%, rgba(255, 255, 255, 0.76) 0 1px, transparent 1.6px), radial-gradient(circle at 84% 78%, rgba(255, 255, 255, 0.9) 0 1px, transparent 1.7px), radial-gradient(circle at 93% 22%, rgba(255, 255, 255, 0.66) 0 1px, transparent 1.5px)",
  backgroundSize: "280px 220px",
  inset: 0,
  opacity: "var(--sky-star-opacity)",
  position: "absolute",
  "@media (prefers-reduced-motion: reduce)": {
    animation: "none",
  },
  "@keyframes sky-stars-flicker": {
    "0%, 100%": { opacity: "calc(var(--sky-star-opacity) * 0.82)" },
    "42%": { opacity: "var(--sky-star-opacity)" },
    "68%": { opacity: "calc(var(--sky-star-opacity) * 0.68)" },
  },
});

const shellStyle = css({
  display: "grid",
  gridTemplateColumns: "minmax(0, 380px) minmax(0, 1fr)",
  minHeight: "100vh",
  position: "relative",
  zIndex: 1,
  "@media (max-width: 860px)": {
    gridTemplateColumns: "1fr",
    gridTemplateRows: "auto minmax(min(520px, 90vh), 90vh)",
  },
});

const panelStyle = css({
  background: "transparent",
  display: "flex",
  flexDirection: "column",
  gap: "24px",
  minWidth: 0,
  overflowX: "hidden",
  padding: "28px",
  position: "relative",
  zIndex: 1,
});

const brandStyle = css({
  alignItems: "center",
  color: "var(--ui-brand-text)",
  display: "inline-flex",
  fontSize: "13px",
  fontWeight: 800,
  gap: "10px",
  lineHeight: 1,
  marginBottom: "18px",
  "& img": {
    borderRadius: "8px",
    boxShadow: "0 8px 18px var(--ui-logo-shadow)",
    display: "block",
    height: "32px",
    width: "32px",
  },
});

const titleStyle = css({
  fontSize: "32px",
  lineHeight: 1.08,
  letterSpacing: 0,
  margin: 0,
});

const copyStyle = css({
  color: "var(--ui-text-muted)",
  fontSize: "15px",
  lineHeight: 1.55,
  margin: "14px 0 0",
});

const dividerStyle = css({
  background:
    "linear-gradient(90deg, rgba(215, 221, 210, 0), var(--ui-divider) 18%, var(--ui-divider) 82%, rgba(215, 221, 210, 0))",
  height: "1px",
  margin: "4px 0",
  width: "100%",
});

const searchStyle = css({
  display: "grid",
  gap: "8px",
  minWidth: 0,
  position: "relative",
  zIndex: 3,
  "& p": {
    color: "var(--ui-label)",
    fontSize: "13px",
    fontWeight: 800,
    margin: 0,
  },
});

const placeSearchStyle = css({
  minHeight: "44px",
  minWidth: 0,
  overflowX: "clip",
  width: "100%",
  "& gmp-place-autocomplete": {
    "--gmp-mat-color-on-surface": "var(--ui-text)",
    "--gmp-mat-color-on-surface-variant": "var(--ui-text-muted)",
    "--gmp-mat-color-surface": "var(--ui-control-bg)",
    "--gmp-mat-color-surface-container": "var(--ui-control-bg)",
    "--gmp-mat-color-surface-container-high": "var(--ui-control-hover-bg)",
    background: "var(--ui-control-bg)",
    backdropFilter: "blur(18px) saturate(1.15)",
    border: "1px solid var(--ui-control-border)",
    borderRadius: "8px",
    boxShadow: "inset 0 1px 0 var(--ui-card-highlight)",
    display: "block",
    maxWidth: "100%",
    minWidth: 0,
    width: "100%",
  },
  "& gmp-place-autocomplete::part(input)": {
    color: "var(--ui-text)",
  },
  "& gmp-place-autocomplete:focus-within:not([data-has-place])::part(input)": {
    color: "#17201d",
  },
  "& gmp-place-autocomplete::part(input)::placeholder": {
    color: "var(--ui-text-muted)",
    opacity: 1,
  },
  "& gmp-place-autocomplete::part(input)::-webkit-input-placeholder": {
    color: "var(--ui-text-muted)",
    opacity: 1,
  },
});

const searchControlsStyle = css({
  alignItems: "stretch",
  display: "grid",
  gap: "10px",
  gridTemplateColumns: "minmax(0, 1fr) 44px",
});

const placeSearchMessageStyle = css({
  color: "var(--ui-error-text)",
  fontSize: "12px",
  lineHeight: 1.35,
  margin: 0,
});

const locationButtonStyle = css({
  alignItems: "center",
  background: "var(--ui-control-bg)",
  backdropFilter: "blur(18px) saturate(1.15)",
  border: "1px solid var(--ui-control-border)",
  borderRadius: "8px",
  color: "var(--ui-text)",
  cursor: "pointer",
  display: "inline-flex",
  font: "inherit",
  justifyContent: "center",
  minWidth: "44px",
  minHeight: "44px",
  padding: 0,
  transition:
    "background 140ms ease, border-color 140ms ease, color 140ms ease, opacity 140ms ease, transform 140ms ease",
  width: "44px",
  "& svg": {
    height: "20px",
    width: "20px",
  },
  "&:hover:not(:disabled)": {
    background: "var(--ui-control-hover-bg)",
    borderColor: "var(--ui-control-hover-border)",
    transform: "translateY(-1px)",
  },
  "&:focus-visible": {
    outline: "3px solid var(--ui-focus)",
    outlineOffset: "2px",
  },
  "&:disabled": {
    cursor: "wait",
    opacity: 0.68,
    transform: "none",
  },
  "&[aria-busy='true'] svg": {
    animation: "location-button-pulse 900ms ease-in-out infinite",
  },
  "@media (prefers-reduced-motion: reduce)": {
    "&[aria-busy='true'] svg": {
      animation: "none",
    },
  },
  "@keyframes location-button-pulse": {
    "0%, 100%": { transform: "scale(1)" },
    "50%": { transform: "scale(0.86)" },
  },
});

const copyLinkButtonStyle = css({
  alignItems: "center",
  background: "var(--ui-control-bg)",
  border: "1px solid var(--ui-control-border)",
  borderRadius: "8px",
  color: "var(--ui-text)",
  cursor: "pointer",
  display: "inline-flex",
  font: "inherit",
  fontSize: "13px",
  fontWeight: 800,
  justifyContent: "center",
  minHeight: "34px",
  minWidth: "112px",
  padding: "0 12px",
  transition:
    "background 140ms ease, border-color 140ms ease, color 140ms ease, opacity 140ms ease",
  whiteSpace: "nowrap",
  "&:hover:not(:disabled)": {
    background: "var(--ui-control-hover-bg)",
    borderColor: "var(--ui-control-hover-border)",
  },
  "&:focus-visible": {
    outline: "3px solid var(--ui-focus)",
    outlineOffset: "2px",
  },
  "&:disabled": {
    cursor: "not-allowed",
    opacity: 0.54,
  },
});

const statusCardStyle = css({
  background: "var(--ui-card-bg)",
  backdropFilter: "blur(18px) saturate(1.15)",
  border: "1px solid var(--ui-card-border)",
  borderRadius: "8px",
  boxShadow: "inset 0 1px 0 var(--ui-card-highlight)",
  padding: "18px",
  position: "relative",
  zIndex: 1,
});

const statusHeaderStyle = css({
  alignItems: "center",
  display: "flex",
  gap: "14px",
});

const statusDotStyle = css({
  background: "#9ca79f",
  borderRadius: "999px",
  boxShadow: "0 0 0 6px rgba(156, 167, 159, 0.15)",
  display: "block",
  flex: "0 0 16px",
  height: "16px",
  width: "16px",
});

const statusLabelStyle = css({
  fontSize: "20px",
  fontWeight: 800,
  lineHeight: 1.2,
  margin: 0,
});

const statusDetailStyle = css({
  color: "var(--ui-text-muted)",
  fontSize: "13px",
  lineHeight: 1.4,
  margin: "4px 0 0",
});

const factsStyle = css({
  borderTop: "1px solid var(--ui-status-divider)",
  display: "grid",
  gap: "10px",
  margin: "18px 0 0",
  padding: "16px 0 0",
  "& div": {
    display: "grid",
    gap: "4px",
  },
  "& dt": {
    color: "var(--ui-label)",
    fontSize: "11px",
    fontWeight: 800,
    letterSpacing: "0.07em",
    margin: 0,
    textTransform: "uppercase",
  },
  "& dt[title]": {
    cursor: "help",
  },
  "& dd": {
    color: "var(--ui-text)",
    fontSize: "13px",
    lineHeight: 1.35,
    margin: 0,
    wordBreak: "break-word",
  },
});

const scrubberStyle = css({
  display: "grid",
  gap: "14px",
  "& input[type='range']": {
    appearance: "none",
    background: "transparent",
    cursor: "pointer",
    height: "28px",
    margin: 0,
    width: "100%",
  },
  "& input[type='range']:focus": {
    outline: "none",
  },
  "& input[type='range']:focus-visible::-webkit-slider-thumb": {
    outline: "3px solid var(--ui-focus)",
    outlineOffset: "3px",
  },
  "& input[type='range']:focus-visible::-moz-range-thumb": {
    outline: "3px solid var(--ui-focus)",
    outlineOffset: "3px",
  },
  "& input[type='range']::-webkit-slider-runnable-track": {
    background:
      "linear-gradient(180deg, rgba(0, 0, 0, 0.16), var(--ui-control-border) 48%, rgba(255, 255, 255, 0.1))",
    border: 0,
    borderRadius: "999px",
    boxShadow:
      "inset 0 1px 2px rgba(0, 0, 0, 0.16), inset 0 -1px 1px rgba(255, 255, 255, 0.08)",
    height: "4px",
  },
  "& input[type='range']::-moz-range-track": {
    background:
      "linear-gradient(180deg, rgba(0, 0, 0, 0.16), var(--ui-control-border) 48%, rgba(255, 255, 255, 0.1))",
    border: 0,
    borderRadius: "999px",
    boxShadow:
      "inset 0 1px 2px rgba(0, 0, 0, 0.16), inset 0 -1px 1px rgba(255, 255, 255, 0.08)",
    height: "4px",
  },
  "& input[type='range']::-webkit-slider-thumb": {
    appearance: "none",
    background: "var(--ui-slider-thumb)",
    border: "2px solid var(--ui-slider-thumb-border)",
    borderRadius: "999px",
    boxShadow:
      "0 5px 12px var(--ui-slider-thumb-shadow), inset 0 1px 0 rgba(255, 255, 255, 0.55), inset 0 -2px 4px rgba(85, 53, 0, 0.18)",
    height: "22px",
    marginTop: "-9px",
    width: "22px",
  },
  "& input[type='range']::-moz-range-thumb": {
    background: "var(--ui-slider-thumb)",
    border: "2px solid var(--ui-slider-thumb-border)",
    borderRadius: "999px",
    boxShadow:
      "0 5px 12px var(--ui-slider-thumb-shadow), inset 0 1px 0 rgba(255, 255, 255, 0.55), inset 0 -2px 4px rgba(85, 53, 0, 0.18)",
    height: "18px",
    width: "18px",
  },
});

const scrubberHeaderStyle = css({
  alignItems: "baseline",
  display: "flex",
  justifyContent: "space-between",
  "& label": {
    color: "var(--ui-label)",
    fontSize: "13px",
    fontWeight: 800,
  },
  "& output": {
    color: "var(--ui-text)",
    fontVariantNumeric: "tabular-nums",
    fontWeight: 800,
  },
});

const windowsStyle = css({
  background: "var(--ui-window-fill)",
  border: "1px solid var(--ui-control-border)",
  borderRadius: "999px",
  boxShadow: "inset 0 1px 0 var(--ui-card-highlight)",
  height: "14px",
  overflow: "hidden",
  position: "relative",
});

const mapWrapStyle = css({
  minWidth: 0,
  minHeight: "100vh",
  overscrollBehavior: "contain",
  position: "relative",
  touchAction: "none",
  "@media (max-width: 860px)": {
    height: "90vh",
    minHeight: "min(520px, 90vh)",
  },
});

const mapStyle = css({
  height: "100%",
  minHeight: "100vh",
  touchAction: "none",
  width: "100%",
  "@media (max-width: 860px)": {
    minHeight: "100%",
  },
});

const mapSkyOverlayStyle = css({
  background: "var(--map-sky-gradient)",
  inset: 0,
  mixBlendMode: "multiply",
  opacity: "var(--map-sky-opacity)",
  pointerEvents: "none",
  position: "absolute",
  zIndex: 1,
});

const toastStyle = css({
  background: "#17201d",
  borderRadius: "8px",
  bottom: "24px",
  color: "#f8faf6",
  fontSize: "13px",
  left: "24px",
  maxWidth: "min(420px, calc(100vw - 48px))",
  opacity: 0,
  padding: "12px 14px",
  pointerEvents: "none",
  position: "absolute",
  transition: "opacity 160ms ease",
  zIndex: 2,
});
