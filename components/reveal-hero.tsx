"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type Pointer = {
  x: number;
  y: number;
};

const CONTACT_EMAIL = "hello@biteva.at";
const CONTACT_LOCATION = "Vienna, Austria";
const CONTACT_INSTAGRAM = "@biteva.at";

export default function RevealHero() {
  const [pointer, setPointer] = useState<Pointer>({ x: 50, y: 50 });
  const [radius, setRadius] = useState(18);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 768px)");

    const syncRadius = () => {
      setRadius(mediaQuery.matches ? 34 : 18);
    };

    syncRadius();
    mediaQuery.addEventListener("change", syncRadius);

    return () => {
      mediaQuery.removeEventListener("change", syncRadius);
    };
  }, []);

  const revealStyle = useMemo(
    () => ({
      clipPath: `circle(${radius*0}% at ${pointer.x*0}% ${pointer.y*0}%)`,
    }),
    [pointer, radius]
  );

  function updatePointer(clientX: number, clientY: number, bounds: DOMRect) {
    const x = ((clientX - bounds.left) / bounds.width) * 100;
    const y = ((clientY - bounds.top) / bounds.height) * 100;

    setPointer({
      x: Math.min(100, Math.max(0, x)),
      y: Math.min(100, Math.max(0, y)),
    });
  }

  return (
    <section
      className="hero-shell"
      onMouseMove={(event) =>
        updatePointer(
          event.clientX,
          event.clientY,
          event.currentTarget.getBoundingClientRect()
        )
      }
      onTouchMove={(event) => {
        const touch = event.touches[0];

        if (!touch) return;

        updatePointer(
          touch.clientX,
          touch.clientY,
          event.currentTarget.getBoundingClientRect()
        );
      }}
    >
      <div className="hero-image hero-image--base" aria-hidden="true" />
      <div className="hero-image hero-image--reveal" style={revealStyle} aria-hidden="true" />
      <div className="hero-scrim" aria-hidden="true" />

      <div className="hero-topbar">
        <span className="hero-brand">BITEVA</span>
      </div>

      <div className="hero-bottom">
        <div className="hero-actions">
          <Link href="/order" className="order-button">
            Order now
          </Link>
        </div>

        <div className="hero-contact" aria-label="Contact information">
          <p>{CONTACT_LOCATION}</p>
          <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
          <a
            href={`https://instagram.com/${CONTACT_INSTAGRAM.replace("@", "")}`}
            target="_blank"
            rel="noreferrer"
          >
            {CONTACT_INSTAGRAM}
          </a>
          <Link href="/complaint" style={{ opacity: 0.5 }}>
            Submit a complaint
          </Link>
        </div>
      </div>
    </section>
  );
}
