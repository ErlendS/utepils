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
              <div id="place-search" mix={placeSearchStyle}></div>
              <p
                id="place-search-message"
                mix={placeSearchMessageStyle}
                aria-live="polite"
              ></p>
            </section>

            <button
              id="use-location-button"
              type="button"
              mix={locationButtonStyle}
            >
              Use my location
            </button>

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
  margin: 0,
  minHeight: "100vh",
  background: "var(--sky-bottom)",
  color: "#17201d",
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
  color: "#3f4d46",
  display: "inline-flex",
  fontSize: "13px",
  fontWeight: 800,
  gap: "10px",
  lineHeight: 1,
  marginBottom: "18px",
  "& img": {
    borderRadius: "8px",
    boxShadow: "0 8px 18px rgba(245, 185, 63, 0.25)",
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
  color: "#4f5c55",
  fontSize: "15px",
  lineHeight: 1.55,
  margin: "14px 0 0",
});

const dividerStyle = css({
  background:
    "linear-gradient(90deg, rgba(215, 221, 210, 0), #d7ddd2 18%, #d7ddd2 82%, rgba(215, 221, 210, 0))",
  height: "1px",
  margin: "4px 0",
  width: "100%",
});

const searchStyle = css({
  display: "grid",
  gap: "8px",
  minWidth: 0,
  "& p": {
    color: "#34413b",
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
    colorScheme: "light",
    display: "block",
    maxWidth: "100%",
    minWidth: 0,
    width: "100%",
  },
});

const placeSearchMessageStyle = css({
  color: "#b14242",
  fontSize: "12px",
  lineHeight: 1.35,
  margin: 0,
});

const locationButtonStyle = css({
  alignItems: "center",
  background: "#17201d",
  border: "1px solid #17201d",
  borderRadius: "8px",
  color: "#f8faf6",
  cursor: "pointer",
  display: "inline-flex",
  font: "inherit",
  fontSize: "14px",
  fontWeight: 800,
  justifyContent: "center",
  minHeight: "44px",
  padding: "0 16px",
  transition:
    "background 140ms ease, border-color 140ms ease, color 140ms ease, opacity 140ms ease",
  width: "100%",
  "&:hover:not(:disabled)": {
    background: "#2a3832",
    borderColor: "#2a3832",
  },
  "&:focus-visible": {
    outline: "3px solid rgba(86, 160, 200, 0.4)",
    outlineOffset: "2px",
  },
  "&:disabled": {
    cursor: "wait",
    opacity: 0.68,
  },
});

const copyLinkButtonStyle = css({
  alignItems: "center",
  background: "#ffffff",
  border: "1px solid #cbd5c8",
  borderRadius: "8px",
  color: "#25302b",
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
    background: "#eef3eb",
    borderColor: "#9fab98",
  },
  "&:focus-visible": {
    outline: "3px solid rgba(86, 160, 200, 0.4)",
    outlineOffset: "2px",
  },
  "&:disabled": {
    cursor: "not-allowed",
    opacity: 0.54,
  },
});

const statusCardStyle = css({
  background: "#ffffff",
  border: "1px solid #dce3d8",
  borderRadius: "8px",
  boxShadow: "0 16px 40px rgba(35, 52, 43, 0.08)",
  padding: "18px",
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
  color: "#617068",
  fontSize: "13px",
  lineHeight: 1.4,
  margin: "4px 0 0",
});

const factsStyle = css({
  borderTop: "1px solid #edf1ea",
  display: "grid",
  gap: "10px",
  margin: "18px 0 0",
  padding: "16px 0 0",
  "& div": {
    display: "grid",
    gap: "4px",
  },
  "& dt": {
    color: "#6a756e",
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
    color: "#222d28",
    fontSize: "13px",
    lineHeight: 1.35,
    margin: 0,
    wordBreak: "break-word",
  },
});

const scrubberStyle = css({
  display: "grid",
  gap: "14px",
});

const scrubberHeaderStyle = css({
  alignItems: "baseline",
  display: "flex",
  justifyContent: "space-between",
  "& label": {
    color: "#34413b",
    fontSize: "13px",
    fontWeight: 800,
  },
  "& output": {
    fontVariantNumeric: "tabular-nums",
    fontWeight: 800,
  },
});

const windowsStyle = css({
  background: "#dfe5db",
  borderRadius: "999px",
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
