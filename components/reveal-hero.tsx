import Link from "next/link";

const CONTACT_EMAIL = "hello@biteva.at";
const CONTACT_LOCATION = "Vienna, Austria";
const CONTACT_INSTAGRAM = "@biteva.at";

export default function RevealHero() {
  return (
    <section className="hero-shell">
      <div className="hero-image hero-image--base" aria-hidden="true" />
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
        </div>
      </div>
    </section>
  );
}
