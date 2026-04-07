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
const LEAFLET_CSS = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.min.css";

// ── Pin SVG (gold) ────────────────────────────────────────────────────────────
function PinIcon({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
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

// ── Main component ─────────────────────────────────────────────────────────────
export default function DeliveryMap({ coords, onCoordsChange }: DeliveryMapProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [geocodeHint, setGeocodeHint] = useState("");
  const [confirmedHint, setConfirmedHint] = useState("");
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [locating, setLocating] = useState(false);
  const [locateError, setLocateError] = useState<string | null>(null);

  const mapRef = useRef<LeafletMap | null>(null);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const moveEndTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Geocode helper ───────────────────────────────────────────────────────────
  const geocode = (lat: number, lng: number) => {
    if (moveEndTimerRef.current) clearTimeout(moveEndTimerRef.current);
    setIsGeocoding(true);
    moveEndTimerRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
          { headers: { "Accept-Language": "en" } }
        );
        const data = await res.json() as { address?: { road?: string; pedestrian?: string; house_number?: string; display_name?: string } };
        const a = data.address ?? {};
        const road = a.road ?? a.pedestrian ?? "";
        const hint = a.house_number ? `${road} ${a.house_number}`.trim() : road;
        setGeocodeHint(hint || "");
      } catch {
        setGeocodeHint("");
      } finally {
        setIsGeocoding(false);
      }
    }, 600);
  };

  // ── Leaflet lifecycle: rebuild on open, destroy on close ─────────────────────
  useEffect(() => {
    if (!isModalOpen) {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      if (moveEndTimerRef.current) clearTimeout(moveEndTimerRef.current);
      return;
    }

    if (!mapContainerRef.current || mapRef.current) return;
    let cancelled = false;

    // Inject Leaflet CSS once
    if (!document.querySelector(`link[href="${LEAFLET_CSS}"]`)) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = LEAFLET_CSS;
      document.head.appendChild(link);
    }

    import("leaflet").then((L) => {
      if (cancelled || !mapContainerRef.current || mapRef.current) return;

      // Fix broken marker icon paths (webpack/Turbopack)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });

      const initLat = coords?.lat ?? DEFAULT_LAT;
      const initLng = coords?.lng ?? DEFAULT_LNG;

      const map = L.map(mapContainerRef.current, {
        zoomControl: true,
        attributionControl: true,
      }).setView([initLat, initLng], DEFAULT_ZOOM);

      mapRef.current = map;

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);

      // Critical: fixes tile loading in constrained containers
      map.invalidateSize();

      // Update geocode hint on every pan/zoom stop
      map.on("moveend", () => {
        if (!mapRef.current) return;
        const { lat, lng } = mapRef.current.getCenter();
        geocode(lat, lng);
      });

      // Fire geocode immediately for initial position
      geocode(initLat, initLng);
    });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isModalOpen]);

  // ── Geolocation ──────────────────────────────────────────────────────────────
  const handleLocate = () => {
    if (!navigator.geolocation) {
      setLocateError("Geolocation is not supported by your browser.");
      return;
    }
    setLocating(true);
    setLocateError(null);
    navigator.geolocation.getCurrentPosition(
      ({ coords: pos }) => {
        setLocating(false);
        mapRef.current?.setView([pos.latitude, pos.longitude], DEFAULT_ZOOM);
        // moveend will fire and trigger geocode
      },
      (err) => {
        setLocating(false);
        setLocateError(
          err.code === err.PERMISSION_DENIED
            ? "Location permission denied. Pan the map to your spot."
            : "Could not get your location. Pan the map to your spot."
        );
      },
      { timeout: 10000 }
    );
  };

  // ── Confirm ──────────────────────────────────────────────────────────────────
  const handleConfirm = () => {
    if (!mapRef.current) return;
    const { lat, lng } = mapRef.current.getCenter();
    const hint = geocodeHint || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    setConfirmedHint(hint);
    onCoordsChange({ lat, lng });
    setIsModalOpen(false);
  };

  const closeModal = () => setIsModalOpen(false);

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <>
      {/* Trigger — button or confirmation card */}
      {coords === null ? (
        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          style={{
            display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
            width: "100%", padding: "16px", borderRadius: "14px",
            border: "1.5px solid #D99E4F", background: "rgba(217,158,79,0.07)",
            color: "#D99E4F", fontFamily: "'DM Sans', system-ui, sans-serif",
            fontSize: "15px", fontWeight: 600, cursor: "pointer", transition: "background 0.2s",
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
            <span style={{
              fontSize: "13px", color: "#e2ddd6", fontFamily: "'DM Sans', system-ui, sans-serif",
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>
              {confirmedHint || `${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            style={{
              flexShrink: 0, background: "none", border: "none",
              color: "#D99E4F", fontSize: "13px", fontWeight: 600,
              fontFamily: "'DM Sans', system-ui, sans-serif", cursor: "pointer",
              textDecoration: "underline", padding: 0,
            }}
          >
            Change
          </button>
        </div>
      )}

      {/* Full-screen modal */}
      {isModalOpen && (
        <div
          onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}
          style={{
            position: "fixed", inset: 0, zIndex: 1000,
            background: "rgba(0,0,0,0.82)", backdropFilter: "blur(4px)",
            WebkitBackdropFilter: "blur(4px)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >
          <style>{`
            .delivery-modal-panel {
              width: 100%;
              height: 100dvh;
              border-radius: 0;
              display: flex;
              flex-direction: column;
              background: #111;
              overflow: hidden;
            }
            @media (min-width: 600px) {
              .delivery-modal-panel {
                width: 560px;
                height: 92vh;
                border-radius: 20px;
              }
            }
            .delivery-map-container { width: 100%; height: 100%; }
            .delivery-map-container .leaflet-container { width: 100% !important; height: 100% !important; }
          `}</style>

          <div className="delivery-modal-panel">

            {/* Header */}
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "16px 20px", borderBottom: "1px solid rgba(255,255,255,0.07)",
              flexShrink: 0,
            }}>
              <div>
                <p style={{ margin: 0, fontSize: "16px", fontWeight: 600, color: "#fff", fontFamily: "'DM Sans', system-ui, sans-serif" }}>
                  Pin your delivery location
                </p>
                <p style={{ margin: 0, fontSize: "12px", color: "#5a5550", fontFamily: "'DM Sans', system-ui, sans-serif" }}>
                  Pan the map so the pin points to your spot
                </p>
              </div>
              <button
                type="button"
                onClick={closeModal}
                aria-label="Close map"
                style={{
                  width: "44px", height: "44px", display: "flex", alignItems: "center", justifyContent: "center",
                  borderRadius: "99px", border: "1px solid rgba(255,255,255,0.1)",
                  background: "rgba(255,255,255,0.04)", color: "#9a9290",
                  fontSize: "18px", cursor: "pointer", flexShrink: 0,
                }}
              >
                ✕
              </button>
            </div>

            {/* Use my location button */}
            <div style={{ padding: "12px 16px 0", flexShrink: 0 }}>
              <button
                type="button"
                onClick={handleLocate}
                disabled={locating}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
                  width: "100%", padding: "13px 16px", borderRadius: "12px",
                  border: "none", background: locating ? "rgba(217,158,79,0.5)" : "#D99E4F",
                  color: "#000", fontFamily: "'DM Sans', system-ui, sans-serif",
                  fontSize: "14px", fontWeight: 700,
                  cursor: locating ? "wait" : "pointer", transition: "background 0.2s",
                }}
              >
                <CrosshairIcon />
                {locating ? "Detecting your location…" : "Use my current location"}
              </button>
              {locateError && (
                <p style={{ margin: "8px 0 0", fontSize: "12px", color: "#ff9090", lineHeight: 1.5 }}>
                  {locateError}
                </p>
              )}
            </div>

            {/* Map area — flex:1 fills remaining height */}
            <div style={{ flex: 1, position: "relative", overflow: "hidden", margin: "12px 0 0" }}>

              {/* Leaflet container */}
              <div
                ref={mapContainerRef}
                className="delivery-map-container"
                style={{ width: "100%", height: "100%" }}
              />

              {/* Center crosshair pin — CSS only, no Leaflet marker */}
              <div style={{
                position: "absolute", top: "50%", left: "50%",
                transform: "translate(-50%, -100%)",
                pointerEvents: "none", zIndex: 999,
                filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.5))",
              }}>
                <PinIcon size={42} />
              </div>

              {/* Geocode hint bubble — floats above the pin */}
              {(geocodeHint || isGeocoding) && (
                <div style={{
                  position: "absolute",
                  top: "calc(50% - 54px)",
                  left: "50%",
                  transform: "translateX(-50%)",
                  pointerEvents: "none", zIndex: 1000,
                  background: "rgba(8,8,8,0.9)",
                  border: "1px solid rgba(217,158,79,0.3)",
                  padding: "5px 14px", borderRadius: "99px",
                  fontSize: "12px", fontWeight: 600,
                  fontFamily: "'DM Sans', system-ui, sans-serif",
                  color: isGeocoding ? "#7a6a50" : "#D99E4F",
                  whiteSpace: "nowrap", maxWidth: "240px",
                  overflow: "hidden", textOverflow: "ellipsis",
                  transition: "color 0.2s",
                }}>
                  {isGeocoding ? "Locating…" : geocodeHint}
                </div>
              )}
            </div>

            {/* Bottom bar — confirm button */}
            <div style={{
              padding: "12px 16px",
              borderTop: "1px solid rgba(255,255,255,0.07)",
              background: "#111", flexShrink: 0,
            }}>
              <button
                type="button"
                onClick={handleConfirm}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "center",
                  width: "100%", padding: "16px",
                  borderRadius: "14px", border: "1px solid rgba(217,158,79,0.35)",
                  background: "#D99E4F", color: "#000",
                  fontFamily: "'DM Sans', system-ui, sans-serif",
                  fontSize: "15px", fontWeight: 700,
                  cursor: "pointer", transition: "opacity 0.2s",
                }}
              >
                Confirm this location
              </button>
            </div>

          </div>
        </div>
      )}
    </>
  );
}
