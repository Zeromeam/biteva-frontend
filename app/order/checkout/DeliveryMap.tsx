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
const LEAFLET_CSS_URL = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.min.css";

// ── Wait for Leaflet CSS to fully load before initialising the map.
// Without the CSS, .leaflet-map-pane has no position:absolute and every
// tile gets placed at the wrong origin, producing fragmented chunks.
function loadLeafletCSS(): Promise<void> {
  const existing = document.querySelector<HTMLLinkElement>(`link[href="${LEAFLET_CSS_URL}"]`);
  if (existing) {
    // Already injected — resolve immediately if loaded, otherwise wait
    return existing.sheet
      ? Promise.resolve()
      : new Promise((res) => { existing.addEventListener("load", () => res(), { once: true }); });
  }
  return new Promise((res) => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = LEAFLET_CSS_URL;
    link.addEventListener("load", () => res(), { once: true });
    link.addEventListener("error", () => res(), { once: true }); // never block on CSS error
    document.head.appendChild(link);
  });
}

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

      map.invalidateSize();

      map.on("moveend", () => {
        if (!mapRef.current) return;
        const c = mapRef.current.getCenter();
        geocode(c.lat, c.lng);
      });

      geocode(initLat, initLng);
    };

    // Load CSS and Leaflet JS in parallel, then wait for the container
    // to report non-zero dimensions via ResizeObserver before calling L.map().
    // This is the only reliable way to guarantee Leaflet reads correct dimensions.
    Promise.all([loadLeafletCSS(), import("leaflet")]).then(([, L]) => {
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
              display: grid;
              grid-template-rows: auto auto 1fr auto;
            }
            @media (min-width: 600px) {
              .dm-panel { width: 560px; height: 92vh; border-radius: 20px; }
            }
            /* Leaflet internal styles depend on this */
            .dm-map-wrap .leaflet-container { width: 100% !important; height: 100% !important; }
          `}</style>

          <div className="dm-panel">

            {/* Row 1 — Header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
              <div>
                <p style={{ margin: 0, fontSize: "16px", fontWeight: 600, color: "#fff", fontFamily: "'DM Sans', system-ui, sans-serif" }}>Pin your delivery location</p>
                <p style={{ margin: 0, fontSize: "12px", color: "#5a5550", fontFamily: "'DM Sans', system-ui, sans-serif" }}>Pan the map so the pin points to your spot</p>
              </div>
              <button type="button" onClick={() => setIsModalOpen(false)} aria-label="Close" style={{ width: "44px", height: "44px", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "99px", border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.04)", color: "#9a9290", fontSize: "18px", cursor: "pointer", flexShrink: 0 }}>✕</button>
            </div>

            {/* Row 2 — Location button */}
            <div style={{ padding: "12px 16px" }}>
              <button type="button" onClick={handleLocate} disabled={locating} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", width: "100%", padding: "13px 16px", borderRadius: "12px", border: "none", background: locating ? "rgba(217,158,79,0.5)" : "#D99E4F", color: "#000", fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: "14px", fontWeight: 700, cursor: locating ? "wait" : "pointer" }}>
                <CrosshairIcon />
                {locating ? "Detecting your location…" : "Use my current location"}
              </button>
              {locateError && <p style={{ margin: "8px 0 0", fontSize: "12px", color: "#ff9090", lineHeight: 1.5 }}>{locateError}</p>}
            </div>

            {/* Row 3 — Map (grid row 1fr fills this) */}
            <div className="dm-map-wrap" style={{ position: "relative", overflow: "hidden" }}>
              {/* The map div fills its grid cell via position:absolute inset:0.
                  The grid row is 1fr so the cell has real pixel dimensions,
                  which Leaflet reads correctly via getBoundingClientRect(). */}
              <div ref={mapContainerRef} style={{ position: "absolute", inset: 0 }} />

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

            {/* Row 4 — Confirm button */}
            <div style={{ padding: "12px 16px", borderTop: "1px solid rgba(255,255,255,0.07)", background: "#111" }}>
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
