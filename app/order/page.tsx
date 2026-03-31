"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  addCartItem,
  drinks,
  formatMoney,
  getCartCount,
  loadCart,
  MenuOption,
  MenuProduct,
  products,
  sauces,
  sides,
  subscribeToCartUpdates,
} from "@/lib/order-cart";

type BuilderStep = "addons" | "drinks";

const CARD_GRADIENTS = [
  "linear-gradient(145deg, #3d1a0a 0%, #1a0d05 50%, #0e0a07 100%)",
  "linear-gradient(145deg, #1a2410 0%, #0d1a08 50%, #080e05 100%)",
  "linear-gradient(145deg, #1a1210 0%, #120a08 50%, #0a0806 100%)",
  "linear-gradient(145deg, #201510 0%, #140e0a 50%, #0e0a07 100%)",
  "linear-gradient(145deg, #0e1a1a 0%, #081212 50%, #050d0d 100%)",
  "linear-gradient(145deg, #1a150a 0%, #120e06 50%, #0e0a05 100%)",
];

const FOOD_EMOJIS: Record<string, string> = {
  beef: "🥩", chicken: "🍗", vegan: "🥗", wrap: "🌯",
  burger: "🍔", fish: "🐟", lamb: "🍖", pasta: "🍝", salad: "🥙",
};

function getFoodEmoji(name: string): string {
  const k = Object.keys(FOOD_EMOJIS).find((key) => name.toLowerCase().includes(key));
  return k ? FOOD_EMOJIS[k] : "🍽️";
}

function getSelectionTotal(
  product: MenuProduct,
  side: MenuOption | null,
  selectedSauces: MenuOption[],
  drink: MenuOption | null,
) {
  return (
    product.price +
    (side?.price ?? 0) +
    selectedSauces.reduce((sum, item) => sum + item.price, 0) +
    (drink?.price ?? 0)
  );
}

/* ── Icons ─────────────────────────────────────────────────────────── */

const BagIcon = () => (
  <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
    <line x1="3" y1="6" x2="21" y2="6"/>
    <path d="M16 10a4 4 0 0 1-8 0"/>
  </svg>
);
const CheckIcon = ({ size = 11 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);
const ChevRight = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 18 15 12 9 6"/>
  </svg>
);
const ChevLeft = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="15 18 9 12 15 6"/>
  </svg>
);
const XIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
);

/* ── ProductCard ────────────────────────────────────────────────────── */

function ProductCard({
  product, index, onOrder,
}: { product: MenuProduct; index: number; onOrder: (p: MenuProduct) => void }) {
  const [imgFailed, setImgFailed] = useState(!product.image);
  const gradient = CARD_GRADIENTS[index % CARD_GRADIENTS.length];
  const emoji = getFoodEmoji(product.name);

  return (
    <article
      style={{
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        borderRadius: "24px",
        border: "1px solid rgba(255,255,255,0.07)",
        background: "#0e0e0e",
        transition: "transform 0.38s cubic-bezier(0.16,1,0.3,1), box-shadow 0.38s ease, border-color 0.25s",
        animation: `fadeUp 0.55s cubic-bezier(0.16,1,0.3,1) ${index * 0.07}s both`,
      }}
      onMouseEnter={e => {
        const el = e.currentTarget as HTMLElement;
        el.style.transform = "translateY(-5px)";
        el.style.boxShadow = "0 28px 64px rgba(0,0,0,0.65)";
        el.style.borderColor = "rgba(255,255,255,0.12)";
      }}
      onMouseLeave={e => {
        const el = e.currentTarget as HTMLElement;
        el.style.transform = "translateY(0)";
        el.style.boxShadow = "none";
        el.style.borderColor = "rgba(255,255,255,0.07)";
      }}
    >
      {/* Image */}
      <div style={{ position: "relative", height: "210px", overflow: "hidden", flexShrink: 0, background: gradient }}>
        {product.image && !imgFailed && (
          <img
            src={product.image}
            alt={product.name}
            onError={() => setImgFailed(true)}
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
          />
        )}
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(0,0,0,0.08) 0%, rgba(12,12,12,1) 100%)" }} />
        {imgFailed && (
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "80px", opacity: 0.15, filter: "grayscale(1)", pointerEvents: "none" }}>
            {emoji}
          </div>
        )}
        <span style={{ position: "absolute", top: "14px", right: "14px", padding: "5px 13px", borderRadius: "99px", background: "rgba(8,8,8,0.72)", border: "1px solid rgba(255,255,255,0.11)", backdropFilter: "blur(10px)", fontSize: "13px", fontWeight: 600, color: "#e2ddd6" }}>
          {formatMoney(product.price)}
        </span>
      </div>

      {/* Body */}
      <div style={{ padding: "18px 22px 22px", display: "flex", flexDirection: "column", flex: 1 }}>
        <h2 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: "24px", fontWeight: 600, color: "#fff", margin: "0 0 6px", lineHeight: 1.2 }}>
          {product.name}
        </h2>
        <p style={{ fontSize: "13px", color: "#5a5550", lineHeight: 1.55, margin: 0, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as const, overflow: "hidden" }}>
          {product.subtitle}
        </p>
        <button
          type="button"
          onClick={() => onOrder(product)}
          style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", marginTop: "18px", padding: "13px 18px", borderRadius: "14px", border: "1px solid rgba(217,158,79,0.35)", background: "rgba(217,158,79,0.07)", color: "#D99E4F", fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: "13px", fontWeight: 600, cursor: "pointer", transition: "background 0.2s, color 0.2s, border-color 0.2s" }}
          onMouseEnter={e => {
            const el = e.currentTarget as HTMLButtonElement;
            el.style.background = "#D99E4F";
            el.style.color = "#000";
            el.style.borderColor = "#D99E4F";
          }}
          onMouseLeave={e => {
            const el = e.currentTarget as HTMLButtonElement;
            el.style.background = "rgba(217,158,79,0.07)";
            el.style.color = "#D99E4F";
            el.style.borderColor = "rgba(217,158,79,0.35)";
          }}
        >
          <span>Customise &amp; Order</span>
          <ChevRight />
        </button>
      </div>
    </article>
  );
}

/* ── OptionRow ──────────────────────────────────────────────────────── */

function OptionRow({ item, selected, onClick }: { item: MenuOption; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        width: "100%",
        padding: "13px 15px",
        borderRadius: "14px",
        border: selected ? "1px solid rgba(217,158,79,0.45)" : "1px solid rgba(255,255,255,0.07)",
        background: selected ? "rgba(217,158,79,0.09)" : "rgba(255,255,255,0.02)",
        cursor: "pointer",
        transition: "all 0.18s ease",
        textAlign: "left",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "11px", minWidth: 0 }}>
        <span style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "20px", height: "20px", borderRadius: "50%", border: selected ? "none" : "1.5px solid rgba(255,255,255,0.2)", background: selected ? "#D99E4F" : "transparent", flexShrink: 0, color: "#000", transition: "all 0.18s" }}>
          {selected && <CheckIcon />}
        </span>
        <span style={{ fontSize: "14px", fontWeight: 500, color: selected ? "#fff" : "#9a9290", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {item.name}
        </span>
      </div>
      <span style={{ fontSize: "12px", fontWeight: 600, color: selected ? "#D99E4F" : "#4a4a4a", flexShrink: 0, marginLeft: "8px" }}>
        {item.price > 0 ? `+${formatMoney(item.price)}` : "Free"}
      </span>
    </button>
  );
}

/* ── Main Page ──────────────────────────────────────────────────────── */

export default function OrderPage() {
  const [cartCount, setCartCount] = useState(0);
  const [activeProduct, setActiveProduct] = useState<MenuProduct | null>(null);
  const [step, setStep] = useState<BuilderStep>("addons");
  const [selectedSideId, setSelectedSideId] = useState(sides[0]?.id || "");
  const [selectedSauceIds, setSelectedSauceIds] = useState<string[]>([]);
  const [selectedDrinkId, setSelectedDrinkId] = useState(drinks[0]?.id || "");
  const [quantity, setQuantity] = useState(1);
  const [toast, setToast] = useState<{ msg: string; key: number } | null>(null);
  const [panelVisible, setPanelVisible] = useState(false);

  useEffect(() => {
    const sync = () => setCartCount(getCartCount(loadCart()));
    sync();
    return subscribeToCartUpdates(sync);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2800);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    if (activeProduct) {
      document.body.style.overflow = "hidden";
      requestAnimationFrame(() => setPanelVisible(true));
    } else {
      setPanelVisible(false);
      const t = setTimeout(() => { document.body.style.overflow = ""; }, 380);
      return () => clearTimeout(t);
    }
  }, [activeProduct]);

  const selectedSide = useMemo(() => sides.find((s) => s.id === selectedSideId) ?? sides[0], [selectedSideId]);
  const selectedSauces = useMemo(() => sauces.filter((s) => selectedSauceIds.includes(s.id)), [selectedSauceIds]);
  const selectedDrink = useMemo(() => drinks.find((d) => d.id === selectedDrinkId) ?? drinks[0], [selectedDrinkId]);

  const unitPrice = activeProduct ? getSelectionTotal(activeProduct, selectedSide, selectedSauces, selectedDrink) : 0;
  const totalPrice = unitPrice * quantity;

  const openBuilder = (product: MenuProduct) => {
    setActiveProduct(product);
    setStep("addons");
    setQuantity(1);
    setSelectedSideId(sides[0]?.id || "");
    setSelectedSauceIds([]);
    setSelectedDrinkId(drinks[0]?.id || "");
  };
  const closeBuilder = () => setActiveProduct(null);
  const toggleSauce = (id: string) =>
    setSelectedSauceIds((cur) => cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]);
  const addToCart = () => {
    if (!activeProduct) return;
    addCartItem({
      cartId: `${activeProduct.id}-${Date.now()}`,
      product: activeProduct,
      side: selectedSide?.id === "none" ? null : selectedSide,
      sauces: selectedSauces,
      drink: selectedDrink?.id === "none" ? null : selectedDrink,
      quantity,
    });
    setToast({ msg: `${quantity}× ${activeProduct.name} added`, key: Date.now() });
    closeBuilder();
  };

  /* shared inline style objects */
  const S = {
    page: { minHeight: "100vh", background: "#080808", color: "#e2ddd6", fontFamily: "'DM Sans', system-ui, sans-serif" } as React.CSSProperties,
    nav: { position: "sticky" as const, top: 0, zIndex: 40, width: "100%", borderBottom: "1px solid rgba(255,255,255,0.06)", background: "rgba(8,8,8,0.88)", backdropFilter: "blur(18px)", WebkitBackdropFilter: "blur(18px)" },
    navInner: { display: "flex", alignItems: "center", justifyContent: "space-between", maxWidth: "1200px", margin: "0 auto", padding: "14px 24px" } as React.CSSProperties,
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;0,600;0,700;1,500;1,600&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600&display=swap');
        *, *::before, *::after { box-sizing: border-box; }
        body { margin: 0; padding: 0; }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(18px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes toastIn {
          from { opacity: 0; transform: translateX(-50%) translateY(10px) scale(0.95); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0) scale(1); }
        }
        .tab-underline { position: relative; }
        .tab-underline::after {
          content: '';
          position: absolute;
          bottom: -1px; left: 0; right: 0;
          height: 2px;
          background: #D99E4F;
          transform: scaleX(0);
          transform-origin: left;
          transition: transform 0.3s cubic-bezier(0.16,1,0.3,1);
        }
        .tab-underline.tab-active::after { transform: scaleX(1); }
        .modal-scroll::-webkit-scrollbar { width: 4px; }
        .modal-scroll::-webkit-scrollbar-track { background: transparent; }
        .modal-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 99px; }
        .options-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
        }
        @media (max-width: 500px) { .options-grid { grid-template-columns: 1fr; } }
        .product-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(290px, 1fr));
          gap: 20px;
          max-width: 1200px;
          margin: 0 auto;
          padding: 0 24px 80px;
        }
      `}</style>

      <div style={S.page}>
        {/* ── Nav ────────────────────────────────────── */}
        <nav style={S.nav}>
          <div style={S.navInner}>
            {/* Logo LEFT */}
            <div>
              <p style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: "26px", fontWeight: 600, fontStyle: "italic", color: "#D99E4F", letterSpacing: "0.04em", lineHeight: 1, margin: 0 }}>
                Biteva
              </p>
              <p style={{ fontSize: "10px", fontWeight: 500, letterSpacing: "0.22em", textTransform: "uppercase", color: "#525252", marginTop: "2px", marginBottom: 0 }}>
                Fine Dining · Order
              </p>
            </div>

            {/* Cart RIGHT */}
            <Link
              href="/order/checkout"
              style={{ display: "flex", alignItems: "center", gap: "10px", padding: "10px 20px", borderRadius: "99px", border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.04)", color: "#c4bcb2", fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: "14px", fontWeight: 500, textDecoration: "none", transition: "background 0.18s, color 0.18s", whiteSpace: "nowrap" }}
            >
              <BagIcon />
              <span>Cart</span>
              {cartCount > 0 && (
                <span style={{ display: "flex", alignItems: "center", justifyContent: "center", minWidth: "20px", height: "20px", padding: "0 5px", borderRadius: "99px", background: "#D99E4F", color: "#000", fontSize: "11px", fontWeight: 700 }}>
                  {cartCount}
                </span>
              )}
            </Link>
          </div>
        </nav>

        {/* ── Hero ───────────────────────────────────── */}
        <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "52px 24px 36px", animation: "fadeUp 0.6s cubic-bezier(0.16,1,0.3,1) both" }}>
          <p style={{ fontSize: "11px", fontWeight: 600, letterSpacing: "0.24em", textTransform: "uppercase", color: "#D99E4F", marginBottom: "14px" }}>
            Today&apos;s Selection
          </p>
          <h1 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: "clamp(42px, 6vw, 72px)", fontWeight: 600, lineHeight: 1.08, color: "#fff", margin: "0 0 16px" }}>
            Crafted for<br />
            <em style={{ fontStyle: "italic", color: "#D99E4F" }}>every craving.</em>
          </h1>
          <p style={{ fontSize: "15px", color: "#5a5550", maxWidth: "400px", lineHeight: 1.65, margin: 0 }}>
            Choose your dish, build your perfect meal with premium sides and drinks.
          </p>
        </div>

        {/* Rule */}
        <div style={{ maxWidth: "1200px", margin: "0 auto 36px", padding: "0 24px" }}>
          <div style={{ height: "1px", background: "linear-gradient(90deg, rgba(217,158,79,0.35) 0%, rgba(255,255,255,0.05) 55%, transparent 100%)" }} />
        </div>

        {/* ── Grid ───────────────────────────────────── */}
        <div className="product-grid">
          {products.map((product, i) => (
            <ProductCard key={product.id} product={product} index={i} onOrder={openBuilder} />
          ))}
        </div>

        {/* ── Modal ──────────────────────────────────── */}
        {activeProduct && (
          <div
            onClick={closeBuilder}
            style={{
              position: "fixed", inset: 0, zIndex: 50,
              display: "flex", alignItems: "flex-end", justifyContent: "center",
              background: panelVisible ? "rgba(0,0,0,0.88)" : "rgba(0,0,0,0)",
              backdropFilter: panelVisible ? "blur(8px)" : "blur(0px)",
              WebkitBackdropFilter: panelVisible ? "blur(8px)" : "blur(0px)",
              transition: "background 0.3s, backdrop-filter 0.3s",
            }}
          >
            <div
              onClick={e => e.stopPropagation()}
              style={{
                position: "relative", zIndex: 1,
                width: "100%", maxWidth: "620px", maxHeight: "92vh",
                display: "flex", flexDirection: "column",
                background: "#0c0c0c",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: "26px 26px 0 0",
                boxShadow: "0 -24px 80px rgba(0,0,0,0.85)",
                overflow: "hidden",
                transform: panelVisible ? "translateY(0)" : "translateY(28px)",
                opacity: panelVisible ? 1 : 0,
                transition: "transform 0.4s cubic-bezier(0.16,1,0.3,1), opacity 0.35s ease",
              }}
            >
              {/* Header */}
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", padding: "24px 26px 20px", borderBottom: "1px solid rgba(255,255,255,0.06)", flexShrink: 0 }}>
                <div>
                  <h2 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: "30px", fontWeight: 600, color: "#fff", margin: "0 0 4px", lineHeight: 1.1 }}>
                    {activeProduct.name}
                  </h2>
                  <p style={{ fontSize: "13px", color: "#5a5550", margin: 0 }}>{activeProduct.subtitle}</p>
                </div>
                <button onClick={closeBuilder} style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "36px", height: "36px", borderRadius: "50%", border: "none", background: "rgba(255,255,255,0.05)", color: "#6b6b6b", cursor: "pointer", flexShrink: 0, marginLeft: "12px" }}>
                  <XIcon />
                </button>
              </div>

              {/* Tabs */}
              <div style={{ display: "flex", borderBottom: "1px solid rgba(255,255,255,0.06)", padding: "0 26px", flexShrink: 0 }}>
                {(["addons", "drinks"] as BuilderStep[]).map((s, i) => (
                  <button
                    key={s}
                    onClick={() => setStep(s)}
                    className={`tab-underline ${step === s ? "tab-active" : ""}`}
                    style={{ position: "relative", padding: "14px 0", marginRight: i === 0 ? "28px" : 0, fontSize: "13px", fontWeight: 600, border: "none", background: "none", cursor: "pointer", color: step === s ? "#fff" : "#525252", fontFamily: "'DM Sans', system-ui, sans-serif", transition: "color 0.18s" }}
                  >
                    {s === "addons" ? "1 · Sides & Sauces" : "2 · Drinks"}
                  </button>
                ))}
              </div>

              {/* Scrollable body */}
              <div className="modal-scroll" style={{ flex: 1, overflowY: "auto", padding: "22px 26px" }}>
                {step === "addons" ? (
                  <>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
                      <span style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: "#5a5550" }}>Choose a Side</span>
                      <span style={{ fontSize: "11px", color: "#3a3a3a" }}>Pick one</span>
                    </div>
                    <div className="options-grid">
                      {sides.map(item => <OptionRow key={item.id} item={item} selected={selectedSideId === item.id} onClick={() => setSelectedSideId(item.id)} />)}
                    </div>
                    <div style={{ height: "1px", background: "rgba(255,255,255,0.05)", margin: "22px 0" }} />
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
                      <span style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: "#5a5550" }}>Extra Sauces</span>
                      <span style={{ fontSize: "11px", color: "#3a3a3a" }}>Optional · multiple</span>
                    </div>
                    <div className="options-grid">
                      {sauces.map(item => <OptionRow key={item.id} item={item} selected={selectedSauceIds.includes(item.id)} onClick={() => toggleSauce(item.id)} />)}
                    </div>
                  </>
                ) : (
                  <>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
                      <span style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: "#5a5550" }}>Choose a Drink</span>
                      <span style={{ fontSize: "11px", color: "#3a3a3a" }}>Pick one</span>
                    </div>
                    <div className="options-grid">
                      {drinks.map(item => <OptionRow key={item.id} item={item} selected={selectedDrinkId === item.id} onClick={() => setSelectedDrinkId(item.id)} />)}
                    </div>
                  </>
                )}
              </div>

              {/* Footer */}
              <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", background: "#0a0a0a", padding: "18px 26px", flexShrink: 0 }}>
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: "14px" }}>
                  <span style={{ fontSize: "13px", color: "#5a5550" }}>Total{quantity > 1 ? ` · ${quantity}×` : ""}</span>
                  <span style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: "28px", fontWeight: 600, color: "#fff" }}>
                    {formatMoney(totalPrice)}
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  {/* Qty */}
                  <div style={{ display: "flex", alignItems: "center", gap: "2px", borderRadius: "14px", border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.03)", padding: "4px", flexShrink: 0 }}>
                    <button onClick={() => setQuantity(Math.max(1, quantity - 1))} disabled={quantity <= 1} style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "38px", height: "38px", borderRadius: "10px", border: "none", background: "transparent", color: "#6b6b6b", fontSize: "20px", cursor: "pointer", opacity: quantity <= 1 ? 0.25 : 1 }}>−</button>
                    <span style={{ width: "30px", textAlign: "center", fontSize: "16px", fontWeight: 600, color: "#fff" }}>{quantity}</span>
                    <button onClick={() => setQuantity(quantity + 1)} style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "38px", height: "38px", borderRadius: "10px", border: "none", background: "transparent", color: "#6b6b6b", fontSize: "20px", cursor: "pointer" }}>+</button>
                  </div>

                  {step === "drinks" && (
                    <button onClick={() => setStep("addons")} style={{ display: "flex", alignItems: "center", gap: "6px", padding: "8px 12px", borderRadius: "12px", border: "none", background: "transparent", color: "#5a5550", fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: "13px", fontWeight: 500, cursor: "pointer", flexShrink: 0 }}>
                      <ChevLeft />Back
                    </button>
                  )}

                  {step === "addons" ? (
                    <button onClick={() => setStep("drinks")} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", padding: "14px 22px", borderRadius: "14px", border: "none", background: "#D99E4F", color: "#000", fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: "14px", fontWeight: 700, cursor: "pointer", letterSpacing: "0.01em" }}>
                      Next: Drinks <ChevRight />
                    </button>
                  ) : (
                    <button onClick={addToCart} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", padding: "14px 22px", borderRadius: "14px", border: "none", background: "#D99E4F", color: "#000", fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: "14px", fontWeight: 700, cursor: "pointer", letterSpacing: "0.01em" }}>
                      <BagIcon /> Add to Cart
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Toast ──────────────────────────────────── */}
        {toast && (
          <div key={toast.key} style={{ position: "fixed", bottom: "32px", left: "50%", transform: "translateX(-50%)", zIndex: 100, display: "flex", alignItems: "center", gap: "10px", padding: "12px 20px", borderRadius: "99px", border: "1px solid rgba(217,158,79,0.2)", background: "rgba(12,12,12,0.95)", backdropFilter: "blur(16px)", fontSize: "14px", fontWeight: 500, color: "#e2ddd6", whiteSpace: "nowrap", animation: "toastIn 0.4s cubic-bezier(0.16,1,0.3,1) both", boxShadow: "0 8px 40px rgba(0,0,0,0.6)" }}>
            <span style={{ width: "20px", height: "20px", borderRadius: "50%", background: "#D99E4F", display: "flex", alignItems: "center", justifyContent: "center", color: "#000", flexShrink: 0 }}>
              <CheckIcon />
            </span>
            {toast.msg}
          </div>
        )}
      </div>
    </>
  );
}
