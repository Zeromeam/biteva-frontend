"use client";

import { useEffect, useRef, useState } from "react";
import type { Map as LeafletMap } from "leaflet";

interface DeliveryMapProps {
  coords: { lat: number; lng: number } | null;
  onCoordsChange: (coords: { lat: number; lng: number }) => void;
}

const DEFAULT_LAT = 48.2082;
const DEFAULT_LNG = 16.3738;
const DEFAULT_ZOOM = 15;

// ── Leaflet CSS inlined verbatim from node_modules/leaflet/dist/leaflet.css ──
// This MUST be in the DOM before L.map() runs. Loading from a CDN is unreliable
// because the browser may not have parsed the CSSOM by the time Leaflet reads
// .leaflet-map-pane dimensions. Inlining guarantees the rules are active.
const LEAFLET_CSS = `
/* required styles */
.leaflet-pane,
.leaflet-tile,
.leaflet-marker-icon,
.leaflet-marker-shadow,
.leaflet-tile-container,
.leaflet-pane > svg,
.leaflet-pane > canvas,
.leaflet-zoom-box,
.leaflet-image-layer,
.leaflet-layer {
  position: absolute;
  left: 0;
  top: 0;
}
.leaflet-container {
  overflow: hidden;
}
.leaflet-tile,
.leaflet-marker-icon,
.leaflet-marker-shadow {
  -webkit-user-select: none;
  -moz-user-select: none;
  user-select: none;
  -webkit-user-drag: none;
}
.leaflet-tile::selection {
  background: transparent;
}
.leaflet-safari .leaflet-tile {
  image-rendering: -webkit-optimize-contrast;
}
.leaflet-safari .leaflet-tile-container {
  width: 1600px;
  height: 1600px;
  -webkit-transform-origin: 0 0;
}
.leaflet-marker-icon,
.leaflet-marker-shadow {
  display: block;
}
.leaflet-container .leaflet-overlay-pane svg {
  max-width: none !important;
  max-height: none !important;
}
.leaflet-container .leaflet-marker-pane img,
.leaflet-container .leaflet-shadow-pane img,
.leaflet-container .leaflet-tile-pane img,
.leaflet-container img.leaflet-image-layer,
.leaflet-container .leaflet-tile {
  max-width: none !important;
  max-height: none !important;
  width: auto;
  padding: 0;
}
.leaflet-container img.leaflet-tile {
  mix-blend-mode: plus-lighter;
}
.leaflet-container.leaflet-touch-zoom {
  -ms-touch-action: pan-x pan-y;
  touch-action: pan-x pan-y;
}
.leaflet-container.leaflet-touch-drag {
  -ms-touch-action: pinch-zoom;
  touch-action: none;
  touch-action: pinch-zoom;
}
.leaflet-container.leaflet-touch-drag.leaflet-touch-zoom {
  -ms-touch-action: none;
  touch-action: none;
}
.leaflet-container {
  -webkit-tap-highlight-color: transparent;
}
.leaflet-container a {
  -webkit-tap-highlight-color: rgba(51, 181, 229, 0.4);
}
.leaflet-tile {
  filter: inherit;
  visibility: hidden;
}
.leaflet-tile-loaded {
  visibility: inherit;
}
.leaflet-zoom-box {
  width: 0;
  height: 0;
  box-sizing: border-box;
  z-index: 800;
}
.leaflet-overlay-pane svg {
  -moz-user-select: none;
}
.leaflet-pane         { z-index: 400; }
.leaflet-tile-pane    { z-index: 200; }
.leaflet-overlay-pane { z-index: 400; }
.leaflet-shadow-pane  { z-index: 500; }
.leaflet-marker-pane  { z-index: 600; }
.leaflet-tooltip-pane { z-index: 650; }
.leaflet-popup-pane   { z-index: 700; }
.leaflet-map-pane canvas { z-index: 100; }
.leaflet-map-pane svg    { z-index: 200; }
.leaflet-vml-shape {
  width: 1px;
  height: 1px;
}
.lvml {
  behavior: url(#default#VML);
  display: inline-block;
  position: absolute;
}

/* control positioning */
.leaflet-control {
  position: relative;
  z-index: 800;
  pointer-events: visiblePainted;
  pointer-events: auto;
}
.leaflet-top,
.leaflet-bottom {
  position: absolute;
  z-index: 1000;
  pointer-events: none;
}
.leaflet-top    { top: 0; }
.leaflet-right  { right: 0; }
.leaflet-bottom { bottom: 0; }
.leaflet-left   { left: 0; }
.leaflet-control {
  float: left;
  clear: both;
}
.leaflet-right .leaflet-control {
  float: right;
}
.leaflet-top .leaflet-control    { margin-top: 10px; }
.leaflet-bottom .leaflet-control { margin-bottom: 10px; }
.leaflet-left .leaflet-control   { margin-left: 10px; }
.leaflet-right .leaflet-control  { margin-right: 10px; }

/* zoom and fade animations */
.leaflet-fade-anim .leaflet-popup {
  opacity: 0;
  transition: opacity 0.2s linear;
}
.leaflet-fade-anim .leaflet-map-pane .leaflet-popup {
  opacity: 1;
}
.leaflet-zoom-animated {
  -webkit-transform-origin: 0 0;
  -ms-transform-origin: 0 0;
  transform-origin: 0 0;
}
svg.leaflet-zoom-animated {
  will-change: transform;
}
.leaflet-zoom-anim .leaflet-zoom-animated {
  transition: transform 0.25s cubic-bezier(0,0,0.25,1);
}
.leaflet-zoom-anim .leaflet-tile,
.leaflet-pan-anim .leaflet-tile {
  transition: none;
}
.leaflet-zoom-anim .leaflet-zoom-hide {
  visibility: hidden;
}

/* cursors */
.leaflet-interactive { cursor: pointer; }
.leaflet-grab { cursor: -webkit-grab; cursor: -moz-grab; cursor: grab; }
.leaflet-crosshair,
.leaflet-crosshair .leaflet-interactive { cursor: crosshair; }
.leaflet-popup-pane,
.leaflet-control { cursor: auto; }
.leaflet-dragging .leaflet-grab,
.leaflet-dragging .leaflet-grab .leaflet-interactive,
.leaflet-dragging .leaflet-marker-draggable {
  cursor: move;
  cursor: -webkit-grabbing;
  cursor: -moz-grabbing;
  cursor: grabbing;
}

/* marker & overlays interactivity */
.leaflet-marker-icon,
.leaflet-marker-shadow,
.leaflet-image-layer,
.leaflet-pane > svg path,
.leaflet-tile-container {
  pointer-events: none;
}
.leaflet-marker-icon.leaflet-interactive,
.leaflet-image-layer.leaflet-interactive,
.leaflet-pane > svg path.leaflet-interactive,
svg.leaflet-image-layer.leaflet-interactive path {
  pointer-events: visiblePainted;
  pointer-events: auto;
}

/* visual tweaks */
.leaflet-container {
  background: #ddd;
  outline-offset: 1px;
}
.leaflet-container a { color: #0078A8; }
.leaflet-zoom-box {
  border: 2px dotted #38f;
  background: rgba(255,255,255,0.5);
}
.leaflet-container {
  font-family: "Helvetica Neue", Arial, Helvetica, sans-serif;
  font-size: 12px;
  font-size: 0.75rem;
  line-height: 1.5;
}

/* toolbar */
.leaflet-bar {
  box-shadow: 0 1px 5px rgba(0,0,0,0.65);
  border-radius: 4px;
}
.leaflet-bar a {
  background-color: #fff;
  border-bottom: 1px solid #ccc;
  width: 26px;
  height: 26px;
  line-height: 26px;
  display: block;
  text-align: center;
  text-decoration: none;
  color: black;
}
.leaflet-bar a,
.leaflet-control-layers-toggle {
  background-position: 50% 50%;
  background-repeat: no-repeat;
  display: block;
}
.leaflet-bar a:hover,
.leaflet-bar a:focus { background-color: #f4f4f4; }
.leaflet-bar a:first-child {
  border-top-left-radius: 4px;
  border-top-right-radius: 4px;
}
.leaflet-bar a:last-child {
  border-bottom-left-radius: 4px;
  border-bottom-right-radius: 4px;
  border-bottom: none;
}
.leaflet-bar a.leaflet-disabled {
  cursor: default;
  background-color: #f4f4f4;
  color: #bbb;
}
.leaflet-touch .leaflet-bar a {
  width: 30px;
  height: 30px;
  line-height: 30px;
}
.leaflet-touch .leaflet-bar a:first-child {
  border-top-left-radius: 2px;
  border-top-right-radius: 2px;
}
.leaflet-touch .leaflet-bar a:last-child {
  border-bottom-left-radius: 2px;
  border-bottom-right-radius: 2px;
}

/* zoom control */
.leaflet-control-zoom-in,
.leaflet-control-zoom-out {
  font: bold 18px 'Lucida Console', Monaco, monospace;
  text-indent: 1px;
}
.leaflet-touch .leaflet-control-zoom-in,
.leaflet-touch .leaflet-control-zoom-out {
  font-size: 22px;
}

/* attribution */
.leaflet-container .leaflet-control-attribution {
  background: #fff;
  background: rgba(255, 255, 255, 0.8);
  margin: 0;
}
.leaflet-control-attribution,
.leaflet-control-scale-line {
  padding: 0 5px;
  color: #333;
  line-height: 1.4;
}
.leaflet-control-attribution a { text-decoration: none; }
.leaflet-control-attribution a:hover,
.leaflet-control-attribution a:focus { text-decoration: underline; }
.leaflet-attribution-flag {
  display: inline !important;
  vertical-align: baseline !important;
  width: 1em;
  height: 0.6669em;
}

/* popup */
.leaflet-popup { position: absolute; text-align: center; margin-bottom: 20px; }
.leaflet-popup-content-wrapper { padding: 1px; text-align: left; border-radius: 12px; }
.leaflet-popup-content { margin: 13px 24px 13px 20px; line-height: 1.3; font-size: 13px; min-height: 1px; }
.leaflet-popup-tip-container {
  width: 40px; height: 20px; position: absolute; left: 50%;
  margin-top: -1px; margin-left: -20px; overflow: hidden; pointer-events: none;
}
.leaflet-popup-tip {
  width: 17px; height: 17px; padding: 1px; margin: -10px auto 0;
  pointer-events: auto; transform: rotate(45deg);
}
.leaflet-popup-content-wrapper,
.leaflet-popup-tip {
  background: white; color: #333; box-shadow: 0 3px 14px rgba(0,0,0,0.4);
}
.leaflet-container a.leaflet-popup-close-button {
  position: absolute; top: 0; right: 0; border: none; text-align: center;
  width: 24px; height: 24px; font: 16px/24px Tahoma, Verdana, sans-serif;
  color: #757575; text-decoration: none; background: transparent;
}

/* tooltip */
.leaflet-tooltip {
  position: absolute; padding: 6px; background-color: #fff;
  border: 1px solid #fff; border-radius: 3px; color: #222;
  white-space: nowrap; user-select: none; pointer-events: none;
  box-shadow: 0 1px 3px rgba(0,0,0,0.4);
}

@media print {
  .leaflet-control {
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
}
`;

// ── SVGs ──────────────────────────────────────────────────────────────────────
function PinIcon({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="#D99E4F" />
      <circle cx="12" cy="9" r="2.5" fill="#000" />
    </svg>
  );
}

function CrosshairIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" /><path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
    </svg>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function DeliveryMap({ coords, onCoordsChange }: DeliveryMapProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [geocodeHint, setGeocodeHint] = useState("");
  const [confirmedHint, setConfirmedHint] = useState("");
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [locating, setLocating] = useState(false);
  const [locateError, setLocateError] = useState<string | null>(null);

  const mapRef = useRef<LeafletMap | null>(null);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const geocodeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Geocoding ──────────────────────────────────────────────────────────────
  const geocode = (lat: number, lng: number) => {
    if (geocodeTimerRef.current) clearTimeout(geocodeTimerRef.current);
    setIsGeocoding(true);
    geocodeTimerRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
          { headers: { "Accept-Language": "en" } }
        );
        const data = await res.json() as { address?: { road?: string; pedestrian?: string; house_number?: string } };
        const a = data.address ?? {};
        const road = a.road ?? a.pedestrian ?? "";
        setGeocodeHint(a.house_number ? `${road} ${a.house_number}`.trim() : road);
      } catch {
        setGeocodeHint("");
      } finally {
        setIsGeocoding(false);
      }
    }, 600);
  };

  // ── Leaflet lifecycle ──────────────────────────────────────────────────────
  useEffect(() => {
    // Cleanup path (modal closed)
    if (!isModalOpen) {
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; }
      if (geocodeTimerRef.current) clearTimeout(geocodeTimerRef.current);
      return;
    }

    const container = mapContainerRef.current;
    if (!container || mapRef.current) return;

    let cancelled = false;
    let ro: ResizeObserver | null = null;

    const initMap = (L: Awaited<typeof import("leaflet")>) => {
      if (cancelled || mapRef.current || !container) return;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });

      const initLat = coords?.lat ?? DEFAULT_LAT;
      const initLng = coords?.lng ?? DEFAULT_LNG;

      const map = L.map(container, { zoomControl: true }).setView([initLat, initLng], DEFAULT_ZOOM);
      mapRef.current = map;

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);

      // Force Leaflet to re-read the container size now that everything is settled
      map.invalidateSize();

      // Also invalidateSize after a short delay, in case the browser is still laying out
      setTimeout(() => {
        if (mapRef.current && !cancelled) mapRef.current.invalidateSize();
      }, 200);

      map.on("moveend", () => {
        if (!mapRef.current) return;
        const c = mapRef.current.getCenter();
        geocode(c.lat, c.lng);
      });

      geocode(initLat, initLng);
    };

    // CSS is already in the DOM via the <style> tag (rendered before useEffect).
    // We only need to wait for the Leaflet JS module and valid container dimensions.
    import("leaflet").then((L) => {
      if (cancelled) return;

      const tryInit = () => {
        const r = container.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) {
          ro?.disconnect();
          ro = null;
          initMap(L);
        }
      };

      // Try immediately (container may already have dimensions)
      tryInit();

      // Otherwise watch for when it does
      if (!mapRef.current && !cancelled) {
        ro = new ResizeObserver(tryInit);
        ro.observe(container);
      }
    });

    return () => {
      cancelled = true;
      ro?.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isModalOpen]);

  // ── Geolocation ───────────────────────────────────────────────────────────
  const handleLocate = () => {
    if (!navigator.geolocation) { setLocateError("Geolocation not supported."); return; }
    setLocating(true);
    setLocateError(null);
    navigator.geolocation.getCurrentPosition(
      ({ coords: pos }) => {
        setLocating(false);
        mapRef.current?.setView([pos.latitude, pos.longitude], DEFAULT_ZOOM);
      },
      (err) => {
        setLocating(false);
        setLocateError(
          err.code === err.PERMISSION_DENIED
            ? "Permission denied. Pan the map to your spot."
            : "Could not get location. Pan the map to your spot."
        );
      },
      { timeout: 10000 }
    );
  };

  // ── Confirm ───────────────────────────────────────────────────────────────
  const handleConfirm = () => {
    if (!mapRef.current) return;
    const { lat, lng } = mapRef.current.getCenter();
    setConfirmedHint(geocodeHint || `${lat.toFixed(5)}, ${lng.toFixed(5)}`);
    onCoordsChange({ lat, lng });
    setIsModalOpen(false);
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      {/* Leaflet CSS — inlined so it's in the DOM before useEffect fires */}
      <style dangerouslySetInnerHTML={{ __html: LEAFLET_CSS }} />

      {/* Trigger */}
      {coords === null ? (
        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          style={{
            display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
            width: "100%", padding: "16px", borderRadius: "14px",
            border: "1.5px solid #D99E4F", background: "rgba(217,158,79,0.07)",
            color: "#D99E4F", fontFamily: "'DM Sans', system-ui, sans-serif",
            fontSize: "15px", fontWeight: 600, cursor: "pointer",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(217,158,79,0.14)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(217,158,79,0.07)"; }}
        >
          <PinIcon size={20} />
          Pick delivery location
        </button>
      ) : (
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px",
          padding: "14px 16px", borderRadius: "14px",
          border: "1px solid rgba(217,158,79,0.25)", background: "rgba(217,158,79,0.05)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0 }}>
            <PinIcon size={22} />
            <span style={{ fontSize: "13px", color: "#e2ddd6", fontFamily: "'DM Sans', system-ui, sans-serif", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {confirmedHint || `${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`}
            </span>
          </div>
          <button type="button" onClick={() => setIsModalOpen(true)} style={{ flexShrink: 0, background: "none", border: "none", color: "#D99E4F", fontSize: "13px", fontWeight: 600, fontFamily: "'DM Sans', system-ui, sans-serif", cursor: "pointer", textDecoration: "underline", padding: 0 }}>
            Change
          </button>
        </div>
      )}

      {/* Modal */}
      {isModalOpen && (
        <div
          onClick={(e) => { if (e.target === e.currentTarget) setIsModalOpen(false); }}
          style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.82)", backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center" }}
        >
          <style>{`
            .dm-panel {
              width: 100%; height: 100dvh; border-radius: 0;
              background: #111; overflow: hidden;
              display: flex; flex-direction: column;
            }
            @media (min-width: 600px) {
              .dm-panel { width: 560px; height: 92vh; border-radius: 20px; }
            }
          `}</style>

          <div className="dm-panel">

            {/* Header */}
            <div style={{ flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
              <div>
                <p style={{ margin: 0, fontSize: "16px", fontWeight: 600, color: "#fff", fontFamily: "'DM Sans', system-ui, sans-serif" }}>Pin your delivery location</p>
                <p style={{ margin: 0, fontSize: "12px", color: "#5a5550", fontFamily: "'DM Sans', system-ui, sans-serif" }}>Pan the map so the pin points to your spot</p>
              </div>
              <button type="button" onClick={() => setIsModalOpen(false)} aria-label="Close" style={{ width: "44px", height: "44px", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "99px", border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.04)", color: "#9a9290", fontSize: "18px", cursor: "pointer", flexShrink: 0 }}>✕</button>
            </div>

            {/* Location button */}
            <div style={{ flexShrink: 0, padding: "12px 16px" }}>
              <button type="button" onClick={handleLocate} disabled={locating} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", width: "100%", padding: "13px 16px", borderRadius: "12px", border: "none", background: locating ? "rgba(217,158,79,0.5)" : "#D99E4F", color: "#000", fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: "14px", fontWeight: 700, cursor: locating ? "wait" : "pointer" }}>
                <CrosshairIcon />
                {locating ? "Detecting your location…" : "Use my current location"}
              </button>
              {locateError && <p style={{ margin: "8px 0 0", fontSize: "12px", color: "#ff9090", lineHeight: 1.5 }}>{locateError}</p>}
            </div>

            {/* Map — flex:1 + min-height:0 fills remaining space */}
            <div style={{ flex: "1 1 0%", minHeight: 0, position: "relative", overflow: "hidden" }}>
              <div ref={mapContainerRef} style={{ width: "100%", height: "100%" }} />

              {/* Center pin */}
              <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -100%)", pointerEvents: "none", zIndex: 999, filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.6))" }}>
                <PinIcon size={44} />
              </div>

              {/* Geocode hint bubble */}
              {(geocodeHint || isGeocoding) && (
                <div style={{ position: "absolute", top: "calc(50% - 58px)", left: "50%", transform: "translateX(-50%)", pointerEvents: "none", zIndex: 1000, background: "rgba(8,8,8,0.92)", border: "1px solid rgba(217,158,79,0.35)", padding: "5px 14px", borderRadius: "99px", fontSize: "12px", fontWeight: 600, fontFamily: "'DM Sans', system-ui, sans-serif", color: isGeocoding ? "#7a6a50" : "#D99E4F", whiteSpace: "nowrap", maxWidth: "260px", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {isGeocoding ? "Locating…" : geocodeHint}
                </div>
              )}
            </div>

            {/* Confirm button */}
            <div style={{ flexShrink: 0, padding: "12px 16px", borderTop: "1px solid rgba(255,255,255,0.07)", background: "#111" }}>
              <button type="button" onClick={handleConfirm} style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "100%", padding: "16px", borderRadius: "14px", border: "none", background: "#D99E4F", color: "#000", fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: "15px", fontWeight: 700, cursor: "pointer" }}>
                Confirm this location
              </button>
            </div>

          </div>
        </div>
      )}
    </>
  );
}
