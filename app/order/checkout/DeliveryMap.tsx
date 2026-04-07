"use client";

import { useEffect, useRef, useState } from "react";
import type { Map as LeafletMap, Marker as LeafletMarker } from "leaflet";

interface DeliveryMapProps {
  coords: { lat: number; lng: number } | null;
  onCoordsChange: (coords: { lat: number; lng: number }) => void;
}

// Vienna city centre as default
const DEFAULT_LAT = 48.2082;
const DEFAULT_LNG = 16.3738;
const DEFAULT_ZOOM = 15;

export default function DeliveryMap({ coords, onCoordsChange }: DeliveryMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markerRef = useRef<LeafletMarker | null>(null);
  const [locating, setLocating] = useState(false);
  const [locateError, setLocateError] = useState<string | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    let cancelled = false;

    // Inject Leaflet CSS once (avoids Turbopack static import issues)
    const LEAFLET_CSS = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.min.css";
    if (!document.querySelector(`link[href="${LEAFLET_CSS}"]`)) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = LEAFLET_CSS;
      document.head.appendChild(link);
    }

    // Dynamically import Leaflet to avoid SSR issues
    import("leaflet").then((L) => {
      // StrictMode runs effects twice in dev — bail if this run was cancelled
      if (cancelled || !containerRef.current || mapRef.current) return;
      // Fix default marker icon paths broken by webpack
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });

      const initLat = coords?.lat ?? DEFAULT_LAT;
      const initLng = coords?.lng ?? DEFAULT_LNG;

      const map = L.map(containerRef.current!, { zoomControl: true }).setView([initLat, initLng], DEFAULT_ZOOM);
      mapRef.current = map;

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);

      // Place initial marker if coords already set
      if (coords) {
        const marker = L.marker([coords.lat, coords.lng], { draggable: true }).addTo(map);
        markerRef.current = marker;
        marker.on("dragend", () => {
          const pos = marker.getLatLng();
          onCoordsChange({ lat: pos.lat, lng: pos.lng });
        });
      }

      // Click on map to place/move marker
      map.on("click", (e) => {
        const { lat, lng } = e.latlng;
        if (markerRef.current) {
          markerRef.current.setLatLng([lat, lng]);
        } else {
          const marker = L.marker([lat, lng], { draggable: true }).addTo(map);
          markerRef.current = marker;
          marker.on("dragend", () => {
            const pos = marker.getLatLng();
            onCoordsChange({ lat: pos.lat, lng: pos.lng });
          });
        }
        onCoordsChange({ lat, lng });
      });
    });

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        markerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLocate = () => {
    if (!navigator.geolocation) {
      setLocateError("Geolocation is not supported by your browser.");
      return;
    }
    setLocating(true);
    setLocateError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        const { latitude: lat, longitude: lng } = pos.coords;
        if (mapRef.current) {
          mapRef.current.setView([lat, lng], DEFAULT_ZOOM);
        }
        if (markerRef.current) {
          markerRef.current.setLatLng([lat, lng]);
        } else {
          import("leaflet").then((L) => {
            if (!mapRef.current) return;
            const marker = L.marker([lat, lng], { draggable: true }).addTo(mapRef.current);
            markerRef.current = marker;
            marker.on("dragend", () => {
              const p = marker.getLatLng();
              onCoordsChange({ lat: p.lat, lng: p.lng });
            });
          });
        }
        onCoordsChange({ lat, lng });
      },
      (err) => {
        setLocating(false);
        if (err.code === err.PERMISSION_DENIED) {
          setLocateError("Location permission denied. Tap the map to place your pin manually.");
        } else {
          setLocateError("Could not get your location. Tap the map to place your pin manually.");
        }
      },
      { timeout: 10000 }
    );
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      <button
        type="button"
        onClick={handleLocate}
        disabled={locating}
        style={{
          display: "flex", alignItems: "center", justifyContent: "center", gap: "6px",
          width: "100%", padding: "11px 16px", borderRadius: "12px",
          border: "1px solid rgba(217,158,79,0.3)",
          background: "rgba(217,158,79,0.06)",
          color: "#D99E4F",
          fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: "13px", fontWeight: 600,
          cursor: locating ? "wait" : "pointer",
          opacity: locating ? 0.7 : 1,
          transition: "all 0.2s",
        }}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>
        </svg>
        {locating ? "Detecting location…" : "Use my current location"}
      </button>

      {locateError && (
        <p style={{ fontSize: "12px", color: "#ff9090", margin: 0, lineHeight: 1.5 }}>{locateError}</p>
      )}

      <div
        ref={containerRef}
        style={{ height: "300px", borderRadius: "14px", overflow: "hidden", border: "1px solid rgba(255,255,255,0.08)" }}
      />
    </div>
  );
}
