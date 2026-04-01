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

// ── Pickles are defined locally since they aren't in the lib yet.
// Add them to lib/order-cart.ts when ready, then import instead.
const pickles: MenuOption[] = [
  { id: "pickle-classic",  name: "Classic Dill",     price: 0   },
  { id: "pickle-spicy",    name: "Spicy Jalapeño",   price: 0.5 },
  { id: "pickle-bread",    name: "Bread & Butter",   price: 0   },
  { id: "pickle-garlic",   name: "Garlic Pickle",    price: 0.5 },
];

// ── Free allowances per step
const FREE_SIDES   = 1;   // 1 side free
const FREE_SAUCES  = 2;   // 2 sauce units free
const FREE_PICKLES = 1;   // 1 pickle unit free

type StepId = "sides" | "sauces" | "pickles" | "drinks";

const STEPS: { id: StepId; label: string; hint: string }[] = [
  { id: "sides",   label: "Sides",   hint: `${FREE_SIDES} included free` },
  { id: "sauces",  label: "Sauces",  hint: `${FREE_SAUCES} included free` },
  { id: "pickles", label: "Pickles", hint: `${FREE_PICKLES} included free` },
  { id: "drinks",  label: "Drinks",  hint: ""              },
];

// qty map: { [itemId]: count }
type QtyMap = Record<string, number>;

function sumQty(qm: QtyMap) {
  return Object.values(qm).reduce((a, b) => a + b, 0);
}

function extraCost(items: MenuOption[], qm: QtyMap, freeUnits: number): number {
  let total = 0;
  let freeLeft = freeUnits;
  for (const item of items) {
    const q = qm[item.id] ?? 0;
    if (q === 0) continue;
    if (item.price === 0) { /* always free price */ }
    else {
      // free units cover cheap items first
      const paid = Math.max(0, q - freeLeft);
      freeLeft = Math.max(0, freeLeft - q);
      total += paid * item.price;
    }
  }
  // For free-priced items: count them against free slots
  // Actually simpler: freeUnits apply to total quantity
  // Recalculate cleanly:
  total = 0;
  const sorted = [...items]
    .filter((i) => (qm[i.id] ?? 0) > 0)
    .sort((a, b) => a.price - b.price); // cheapest first gets free units
  let free = freeUnits;
  for (const item of sorted) {
    const q = qm[item.id] ?? 0;
    const freeApplied = Math.min(q, free);
    free -= freeApplied;
    const paid = q - freeApplied;
    total += paid * item.price;
  }
  return total;
}

function drinksCost(qm: QtyMap): number {
  let total = 0;
  let free = 0;
  const sorted = [...drinks]
    .filter((d) => (qm[d.id] ?? 0) > 0)
    .sort((a, b) => a.price - b.price);
  for (const d of sorted) {
    const q = qm[d.id] ?? 0;
    const freeApplied = Math.min(q, free);
    free -= freeApplied;
    total += (q - freeApplied) * d.price;
  }
  return total;
}

function computeTotal(
  product: MenuProduct,
  mainQty: number,
  sidesQm: QtyMap,
  saucesQm: QtyMap,
  picklesQm: QtyMap,
  drinksQm: QtyMap,
): number {
  const unit =
    product.price +
    extraCost(sides, sidesQm, FREE_SIDES) +
    extraCost(sauces, saucesQm, FREE_SAUCES) +
    extraCost(pickles, picklesQm, FREE_PICKLES) +
    drinksCost(drinksQm);
  return unit * mainQty;
}

// ── Colour & gradient helpers ───────────────────────────────────────────
const CARD_GRADIENTS = [
  "linear-gradient(150deg,#3d1a0a,#1a0d05,#0e0a07)",
  "linear-gradient(150deg,#1a2410,#0d1a08,#080e05)",
  "linear-gradient(150deg,#1a1210,#120a08,#0a0806)",
  "linear-gradient(150deg,#201510,#140e0a,#0e0a07)",
  "linear-gradient(150deg,#0e1a1a,#081212,#050d0d)",
  "linear-gradient(150deg,#1a150a,#120e06,#0e0a05)",
];
const FOOD_EMOJIS: Record<string, string> = {
  beef:"🥩", chicken:"🍗", vegan:"🥗", wrap:"🌯",
  burger:"🍔", fish:"🐟", lamb:"🍖", pasta:"🍝", salad:"🥙",
};
function foodEmoji(name: string) {
  const k = Object.keys(FOOD_EMOJIS).find((k) => name.toLowerCase().includes(k));
  return k ? FOOD_EMOJIS[k] : "🍽️";
}

// ── Icons ───────────────────────────────────────────────────────────────
const BagIcon = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
    <line x1="3" y1="6" x2="21" y2="6"/>
    <path d="M16 10a4 4 0 0 1-8 0"/>
  </svg>
);
const ChevRight = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 18 15 12 9 6"/>
  </svg>
);
const ChevLeft = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="15 18 9 12 15 6"/>
  </svg>
);
const XIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
);
const CheckIcon = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);

// ── ProductCard ─────────────────────────────────────────────────────────
function ProductCard({ product, index, onOrder }: {
  product: MenuProduct; index: number; onOrder: (p: MenuProduct) => void;
}) {
  const [imgFailed, setImgFailed] = useState(!product.image);
  return (
    <article
      style={{
        display:"flex", flexDirection:"column", overflow:"hidden",
        borderRadius:"24px", border:"1px solid rgba(255,255,255,0.07)",
        background:"#0e0e0e",
        transition:"transform 0.38s cubic-bezier(0.16,1,0.3,1), box-shadow 0.38s ease, border-color 0.25s",
        animation:`fadeUp 0.55s cubic-bezier(0.16,1,0.3,1) ${index*0.07}s both`,
      }}
      onMouseEnter={e => {
        const el = e.currentTarget as HTMLElement;
        el.style.transform = "translateY(-5px)";
        el.style.boxShadow = "0 28px 60px rgba(0,0,0,0.7)";
        el.style.borderColor = "rgba(255,255,255,0.12)";
      }}
      onMouseLeave={e => {
        const el = e.currentTarget as HTMLElement;
        el.style.transform = ""; el.style.boxShadow = ""; el.style.borderColor = "";
      }}
    >
      {/* Image */}
      <div style={{ position:"relative", height:"210px", overflow:"hidden", flexShrink:0, background: CARD_GRADIENTS[index % CARD_GRADIENTS.length] }}>
        {product.image && !imgFailed && (
          <img src={product.image} alt={product.name} onError={()=>setImgFailed(true)}
            style={{ position:"absolute", inset:0, width:"100%", height:"100%", objectFit:"cover" }} />
        )}
        <div style={{ position:"absolute", inset:0, background:"linear-gradient(to bottom,rgba(0,0,0,0.06) 0%,rgba(12,12,12,1) 100%)" }}/>
        {imgFailed && (
          <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center", fontSize:"78px", opacity:0.14, filter:"grayscale(1)", pointerEvents:"none" }}>
            {foodEmoji(product.name)}
          </div>
        )}
        <span style={{ position:"absolute", top:"14px", right:"14px", padding:"5px 13px", borderRadius:"99px", background:"rgba(8,8,8,0.72)", border:"1px solid rgba(255,255,255,0.11)", backdropFilter:"blur(10px)", fontSize:"13px", fontWeight:600, color:"#e2ddd6" }}>
          {formatMoney(product.price)}
        </span>
      </div>
      {/* Body */}
      <div style={{ padding:"18px 22px 22px", display:"flex", flexDirection:"column", flex:1 }}>
        <h2 style={{ fontFamily:"'Cormorant Garamond',Georgia,serif", fontSize:"24px", fontWeight:600, color:"#fff", margin:"0 0 6px", lineHeight:1.2 }}>
          {product.name}
        </h2>
        <p style={{ fontSize:"13px", color:"#5a5550", lineHeight:1.55, margin:0, display:"-webkit-box", WebkitLineClamp:2, WebkitBoxOrient:"vertical" as const, overflow:"hidden" }}>
          {product.subtitle}
        </p>
        <button type="button" onClick={()=>onOrder(product)}
          style={{ display:"flex", alignItems:"center", justifyContent:"space-between", width:"100%", marginTop:"18px", padding:"13px 18px", borderRadius:"14px", border:"1px solid rgba(217,158,79,0.35)", background:"rgba(217,158,79,0.07)", color:"#D99E4F", fontFamily:"'DM Sans',system-ui,sans-serif", fontSize:"13px", fontWeight:600, cursor:"pointer", transition:"all 0.2s" }}
          onMouseEnter={e=>{ const el=e.currentTarget as HTMLButtonElement; el.style.background="#D99E4F"; el.style.color="#000"; el.style.borderColor="#D99E4F"; }}
          onMouseLeave={e=>{ const el=e.currentTarget as HTMLButtonElement; el.style.background="rgba(217,158,79,0.07)"; el.style.color="#D99E4F"; el.style.borderColor="rgba(217,158,79,0.35)"; }}
        >
          <span>Customise &amp; Order</span><ChevRight />
        </button>
      </div>
    </article>
  );
}

// ── ItemRow – shows one option with its own +/− counter ─────────────────
function ItemRow({
  item, qty, onInc, onDec, freeRemaining, stepFreeAllowance,
}: {
  item: MenuOption;
  qty: number;
  onInc: () => void;
  onDec: () => void;
  freeRemaining: number;
  stepFreeAllowance: number;
}) {
  const isSelected = qty > 0;
  const thisUnitFree = freeRemaining > 0;

  return (
    <div style={{
      display:"flex", alignItems:"center", justifyContent:"space-between",
      padding:"14px 16px", borderRadius:"16px",
      border: isSelected ? "1px solid rgba(217,158,79,0.4)" : "1px solid rgba(255,255,255,0.07)",
      background: isSelected ? "rgba(217,158,79,0.07)" : "rgba(255,255,255,0.02)",
      transition:"all 0.2s ease",
      gap:"12px",
    }}>
      {/* Left: name + price tag */}
      <div style={{ flex:1, minWidth:0 }}>
        <p style={{ margin:0, fontSize:"15px", fontWeight:500, color: isSelected ? "#fff" : "#9a9290", lineHeight:1.3, transition:"color 0.2s" }}>
          {item.name}
        </p>
        <p style={{ margin:"3px 0 0", fontSize:"12px", color: isSelected ? "#D99E4F" : "#444" }}>
          {item.price === 0
            ? <span style={{ color:"#5a7a3a", fontWeight:600 }}>Free</span>
            : thisUnitFree
              ? <><span style={{ color:"#5a7a3a", fontWeight:600 }}>Free</span> <span style={{ color:"#444" }}>({formatMoney(item.price)} after)</span></>
              : <span style={{ color: isSelected ? "#D99E4F" : "#444" }}>+{formatMoney(item.price)} each</span>
          }
        </p>
      </div>

      {/* Right: counter */}
      <div style={{ display:"flex", alignItems:"center", gap:"0", borderRadius:"12px", border:"1px solid rgba(255,255,255,0.1)", background:"rgba(0,0,0,0.3)", overflow:"hidden", flexShrink:0 }}>
        <button
          type="button"
          onClick={onDec}
          disabled={qty === 0}
          style={{ width:"36px", height:"36px", display:"flex", alignItems:"center", justifyContent:"center", border:"none", background:"transparent", color: qty===0 ? "#333" : "#888", fontSize:"18px", cursor: qty===0 ? "not-allowed" : "pointer", fontWeight:300, transition:"background 0.15s, color 0.15s", lineHeight:1 }}
          onMouseEnter={e=>{ if(qty>0)(e.currentTarget as HTMLButtonElement).style.background="rgba(255,255,255,0.07)"; }}
          onMouseLeave={e=>{ (e.currentTarget as HTMLButtonElement).style.background="transparent"; }}
        >−</button>
        <span style={{ width:"30px", textAlign:"center", fontSize:"15px", fontWeight:600, color: qty>0 ? "#fff" : "#444", lineHeight:"36px" }}>
          {qty}
        </span>
        <button
          type="button"
          onClick={onInc}
          style={{ width:"36px", height:"36px", display:"flex", alignItems:"center", justifyContent:"center", border:"none", background:"transparent", color:"#888", fontSize:"18px", cursor:"pointer", fontWeight:300, transition:"background 0.15s, color 0.15s", lineHeight:1 }}
          onMouseEnter={e=>{ (e.currentTarget as HTMLButtonElement).style.background="rgba(255,255,255,0.07)"; (e.currentTarget as HTMLButtonElement).style.color="#fff"; }}
          onMouseLeave={e=>{ (e.currentTarget as HTMLButtonElement).style.background="transparent"; (e.currentTarget as HTMLButtonElement).style.color="#888"; }}
        >+</button>
      </div>
    </div>
  );
}

// ── Main Page ───────────────────────────────────────────────────────────
export default function OrderPage() {
  const [cartCount, setCartCount] = useState(0);
  const [activeProduct, setActiveProduct] = useState<MenuProduct | null>(null);
  const [stepIndex, setStepIndex]         = useState(0);
  const [mainQty, setMainQty]             = useState(1);

  // Per-item quantity maps for each category
  const [sidesQm,   setSidesQm]   = useState<QtyMap>({});
  const [saucesQm,  setSaucesQm]  = useState<QtyMap>({});
  const [picklesQm, setPicklesQm] = useState<QtyMap>({});
  const [drinksQm,  setDrinksQm]  = useState<QtyMap>({});

  const [panelVisible, setPanelVisible] = useState(false);
  const [toast, setToast] = useState<{ msg: string; key: number } | null>(null);

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

  const totalPrice = useMemo(() =>
    activeProduct
      ? computeTotal(activeProduct, mainQty, sidesQm, saucesQm, picklesQm, drinksQm)
      : 0,
    [activeProduct, mainQty, sidesQm, saucesQm, picklesQm, drinksQm]
  );

  // Free remaining counters for current display
  const sidesFreeLeft   = Math.max(0, FREE_SIDES   - sumQty(sidesQm));
  const saucesFreeLeft  = Math.max(0, FREE_SAUCES  - sumQty(saucesQm));
  const picklesFreeLeft = Math.max(0, FREE_PICKLES - sumQty(picklesQm));

  function openBuilder(product: MenuProduct) {
    setActiveProduct(product);
    setStepIndex(0);
    setMainQty(1);
    setSidesQm({});
    setSaucesQm({});
    setPicklesQm({});
    setDrinksQm({});
  }
  const closeBuilder = () => setActiveProduct(null);

  function inc(setFn: React.Dispatch<React.SetStateAction<QtyMap>>, id: string) {
    setFn(q => ({ ...q, [id]: (q[id] ?? 0) + 1 }));
  }
  function dec(setFn: React.Dispatch<React.SetStateAction<QtyMap>>, id: string) {
    setFn(q => ({ ...q, [id]: Math.max(0, (q[id] ?? 0) - 1) }));
  }
  function selectPickle(id: string) {
    setPicklesQm(prev => {
      const wasSelected = (prev[id] ?? 0) > 0;
      const next: QtyMap = {};
      pickles.forEach(p => { next[p.id] = 0; });
      if (!wasSelected) next[id] = 1;
      return next;
    });
  }
  
  
  function addToCart() {
    if (!activeProduct) return;

    // Convert qty maps to flat MenuOption arrays for the API
    const selectedSides   = sides.filter(s => (sidesQm[s.id] ?? 0) > 0);
    const selectedSauces  = [
      ...sauces.filter(s  => (saucesQm[s.id]  ?? 0) > 0),
      ...pickles.filter(p => (picklesQm[p.id] ?? 0) > 0),
    ];
    const selectedDrink   = drinks.find(d => (drinksQm[d.id] ?? 0) > 0) ?? null;

    addCartItem({
      cartId:  `${activeProduct.id}-${Date.now()}`,
      product: activeProduct,
      side:    selectedSides[0] ?? null,
      sauces:  selectedSauces,
      drink:   selectedDrink,
      quantity: mainQty,
    });
    setToast({ msg: `${mainQty}× ${activeProduct.name} added`, key: Date.now() });
    closeBuilder();
  }

  const currentStep = STEPS[stepIndex];
  const isLastStep  = stepIndex === STEPS.length - 1;

  // Render items for the active step
  function renderStepItems() {
    switch (currentStep.id) {
      case "sides":
        return sides.map(item => (
          <ItemRow key={item.id} item={item} qty={sidesQm[item.id]??0}
            onInc={()=>inc(setSidesQm, item.id)} onDec={()=>dec(setSidesQm, item.id)}
            freeRemaining={sidesFreeLeft} stepFreeAllowance={FREE_SIDES} />
        ));
      case "sauces":
        return sauces.map(item => (
          <ItemRow key={item.id} item={item} qty={saucesQm[item.id]??0}
            onInc={()=>inc(setSaucesQm, item.id)} onDec={()=>dec(setSaucesQm, item.id)}
            freeRemaining={saucesFreeLeft} stepFreeAllowance={FREE_SAUCES} />
        ));

      case "pickles":
        return pickles.map(item => {
          const selected = (picklesQm[item.id] ?? 0) > 0;
          return (
            <div key={item.id} onClick={() => selectPickle(item.id)} style={{
              display:"flex", alignItems:"center", justifyContent:"space-between",
              padding:"14px 16px", borderRadius:"16px", cursor:"pointer",
              border: selected ? "1px solid rgba(217,158,79,0.4)" : "1px solid rgba(255,255,255,0.07)",
              background: selected ? "rgba(217,158,79,0.07)" : "rgba(255,255,255,0.02)",
              transition:"all 0.2s ease", gap:"12px",
            }}>
              <div style={{ flex:1, minWidth:0 }}>
                <p style={{ margin:0, fontSize:"15px", fontWeight:500, color: selected ? "#fff" : "#9a9290" }}>
                  {item.name}
                </p>
                <p style={{ margin:"3px 0 0", fontSize:"12px" }}>
                  {item.price === 0
                    ? <span style={{ color:"#5a7a3a", fontWeight:600 }}>Free</span>
                    : <span style={{ color: selected ? "#D99E4F" : "#444" }}>+{formatMoney(item.price)}</span>
                  }
                </p>
              </div>
              <div style={{
                width:"22px", height:"22px", borderRadius:"50%", flexShrink:0,
                border: selected ? "2px solid #D99E4F" : "2px solid rgba(255,255,255,0.15)",
                display:"flex", alignItems:"center", justifyContent:"center",
                transition:"border-color 0.2s",
              }}>
                {selected && <div style={{ width:"10px", height:"10px", borderRadius:"50%", background:"#D99E4F" }}/>}
              </div>
            </div>
          );
        });
        
      case "drinks":
        return drinks.map(item => (
          <ItemRow key={item.id} item={item} qty={drinksQm[item.id]??0}
            onInc={()=>inc(setDrinksQm, item.id)} onDec={()=>dec(setDrinksQm, item.id)}
            freeRemaining={0} stepFreeAllowance={1} />
        ));
    }
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;0,600;0,700;1,500;1,600&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600&display=swap');
        *, *::before, *::after { box-sizing: border-box; }
        body { margin: 0; padding: 0; }

        @keyframes fadeUp {
          from { opacity:0; transform:translateY(18px); }
          to   { opacity:1; transform:translateY(0); }
        }
        @keyframes toastIn {
          from { opacity:0; transform:translateX(-50%) translateY(10px) scale(0.95); }
          to   { opacity:1; transform:translateX(-50%) translateY(0) scale(1); }
        }
        @keyframes stepSlideIn {
          from { opacity:0; transform:translateX(18px); }
          to   { opacity:1; transform:translateX(0); }
        }

        .product-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(290px, 1fr));
          gap: 20px;
          max-width: 1200px;
          margin: 0 auto;
          padding: 0 24px 80px;
        }
        .modal-scroll::-webkit-scrollbar { width: 4px; }
        .modal-scroll::-webkit-scrollbar-track { background: transparent; }
        .modal-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 99px; }

        .step-items { animation: stepSlideIn 0.32s cubic-bezier(0.16,1,0.3,1) both; }
      `}</style>

      <div style={{ minHeight:"100vh", background:"#080808", color:"#e2ddd6", fontFamily:"'DM Sans',system-ui,sans-serif" }}>

        {/* ── Nav ──────────────────────────────────────── */}
        <nav style={{ position:"sticky", top:0, zIndex:40, borderBottom:"1px solid rgba(255,255,255,0.06)", background:"rgba(8,8,8,0.88)", backdropFilter:"blur(18px)", WebkitBackdropFilter:"blur(18px)" }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", maxWidth:"1200px", margin:"0 auto", padding:"14px 24px" }}>
            <div>
              <p style={{ fontFamily:"'Cormorant Garamond',Georgia,serif", fontSize:"26px", fontWeight:600, fontStyle:"italic", color:"#D99E4F", letterSpacing:"0.04em", lineHeight:1, margin:0 }}>Biteva</p>
              <p style={{ fontSize:"10px", fontWeight:500, letterSpacing:"0.22em", textTransform:"uppercase", color:"#525252", marginTop:"2px", marginBottom:0 }}>Fine Dining · Order</p>
            </div>
            <Link href="/order/checkout" style={{ display:"flex", alignItems:"center", gap:"10px", padding:"10px 20px", borderRadius:"99px", border:"1px solid rgba(255,255,255,0.1)", background:"rgba(255,255,255,0.04)", color:"#c4bcb2", fontFamily:"'DM Sans',system-ui,sans-serif", fontSize:"14px", fontWeight:500, textDecoration:"none", whiteSpace:"nowrap" }}>
              <BagIcon size={18}/>
              <span>Cart</span>
              {cartCount > 0 && (
                <span style={{ display:"flex", alignItems:"center", justifyContent:"center", minWidth:"20px", height:"20px", padding:"0 5px", borderRadius:"99px", background:"#D99E4F", color:"#000", fontSize:"11px", fontWeight:700 }}>
                  {cartCount}
                </span>
              )}
            </Link>
          </div>
        </nav>

        {/* ── Hero ─────────────────────────────────────── */}
        <div style={{ maxWidth:"1200px", margin:"0 auto", padding:"52px 24px 36px", animation:"fadeUp 0.6s cubic-bezier(0.16,1,0.3,1) both" }}>
          <p style={{ fontSize:"11px", fontWeight:600, letterSpacing:"0.24em", textTransform:"uppercase", color:"#D99E4F", marginBottom:"14px", margin:"0 0 14px" }}>Today&apos;s Selection</p>
          <h1 style={{ fontFamily:"'Cormorant Garamond',Georgia,serif", fontSize:"clamp(42px,6vw,72px)", fontWeight:600, lineHeight:1.08, color:"#fff", margin:"0 0 16px" }}>
            Crafted for<br/><em style={{ fontStyle:"italic", color:"#D99E4F" }}>every craving.</em>
          </h1>
          <p style={{ fontSize:"15px", color:"#5a5550", maxWidth:"400px", lineHeight:1.65, margin:0 }}>
            Choose your dish, build your perfect meal with premium sides, sauces, and drinks.
          </p>
        </div>

        {/* Rule */}
        <div style={{ maxWidth:"1200px", margin:"0 auto 36px", padding:"0 24px" }}>
          <div style={{ height:"1px", background:"linear-gradient(90deg,rgba(217,158,79,0.35) 0%,rgba(255,255,255,0.05) 55%,transparent 100%)" }}/>
        </div>

        {/* ── Grid ─────────────────────────────────────── */}
        <div className="product-grid">
          {products.map((p, i) => (
            <ProductCard key={p.id} product={p} index={i} onOrder={openBuilder}/>
          ))}
        </div>

        {/* ── Builder Modal ─────────────────────────────── */}
        {activeProduct && (
          <div
            onClick={closeBuilder}
            style={{ position:"fixed", inset:0, zIndex:50, display:"flex", alignItems:"flex-end", justifyContent:"center", background: panelVisible ? "rgba(0,0,0,0.88)" : "rgba(0,0,0,0)", backdropFilter: panelVisible ? "blur(8px)" : "none", WebkitBackdropFilter: panelVisible ? "blur(8px)" : "none", transition:"background 0.3s, backdrop-filter 0.3s" }}
          >
            <div
              onClick={e=>e.stopPropagation()}
              style={{ position:"relative", zIndex:1, width:"100%", maxWidth:"600px", maxHeight:"92vh", display:"flex", flexDirection:"column", background:"#0c0c0c", border:"1px solid rgba(255,255,255,0.08)", borderRadius:"26px 26px 0 0", boxShadow:"0 -24px 80px rgba(0,0,0,0.85)", overflow:"hidden", transform: panelVisible ? "translateY(0)" : "translateY(32px)", opacity: panelVisible ? 1 : 0, transition:"transform 0.4s cubic-bezier(0.16,1,0.3,1), opacity 0.35s ease" }}
            >

              {/* ── Modal Header ── */}
              <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", padding:"22px 24px 18px", borderBottom:"1px solid rgba(255,255,255,0.06)", flexShrink:0 }}>
                <div style={{ flex:1 }}>
                  <h2 style={{ fontFamily:"'Cormorant Garamond',Georgia,serif", fontSize:"28px", fontWeight:600, color:"#fff", margin:"0 0 3px", lineHeight:1.1 }}>{activeProduct.name}</h2>
                  <p style={{ fontSize:"12px", color:"#5a5550", margin:0 }}>{activeProduct.subtitle}</p>
                </div>

                {/* Main quantity */}
                <div style={{ display:"flex", alignItems:"center", gap:"8px", marginLeft:"12px" }}>
                  <span style={{ fontSize:"11px", color:"#5a5550", fontWeight:500, whiteSpace:"nowrap" }}>Qty</span>
                  <div style={{ display:"flex", alignItems:"center", borderRadius:"10px", border:"1px solid rgba(255,255,255,0.1)", overflow:"hidden" }}>
                    <button onClick={()=>setMainQty(q=>Math.max(1,q-1))} disabled={mainQty<=1} style={{ width:"32px", height:"32px", border:"none", background:"transparent", color: mainQty<=1?"#333":"#777", fontSize:"16px", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>−</button>
                    <span style={{ width:"26px", textAlign:"center", fontSize:"14px", fontWeight:600, color:"#fff" }}>{mainQty}</span>
                    <button onClick={()=>setMainQty(q=>q+1)} style={{ width:"32px", height:"32px", border:"none", background:"transparent", color:"#777", fontSize:"16px", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>+</button>
                  </div>
                  <button onClick={closeBuilder} style={{ display:"flex", alignItems:"center", justifyContent:"center", width:"32px", height:"32px", borderRadius:"50%", border:"none", background:"rgba(255,255,255,0.05)", color:"#666", cursor:"pointer" }}>
                    <XIcon/>
                  </button>
                </div>
              </div>

              {/* ── Step Progress Bar ── */}
              <div style={{ padding:"16px 24px 0", flexShrink:0 }}>
                {/* Step labels */}
                <div style={{ display:"flex", justifyContent:"space-between", marginBottom:"10px" }}>
                  {STEPS.map((step, i) => (
                    <button
                      key={step.id}
                      onClick={()=>setStepIndex(i)}
                      style={{ background:"none", border:"none", cursor:"pointer", padding:0, display:"flex", flexDirection:"column", alignItems:"center", gap:"4px", flex:1 }}
                    >
                      {/* Step number dot */}
                      <span style={{
                        width:"28px", height:"28px", borderRadius:"50%",
                        display:"flex", alignItems:"center", justifyContent:"center",
                        fontSize:"12px", fontWeight:700,
                        background: i < stepIndex ? "#D99E4F" : i === stepIndex ? "rgba(217,158,79,0.15)" : "rgba(255,255,255,0.05)",
                        border: i === stepIndex ? "1.5px solid #D99E4F" : i < stepIndex ? "1.5px solid #D99E4F" : "1.5px solid rgba(255,255,255,0.1)",
                        color: i < stepIndex ? "#000" : i === stepIndex ? "#D99E4F" : "#444",
                        transition:"all 0.25s",
                      }}>
                        {i < stepIndex ? <CheckIcon/> : i+1}
                      </span>
                      <span style={{ fontSize:"10px", fontWeight:600, letterSpacing:"0.08em", textTransform:"uppercase", color: i === stepIndex ? "#D99E4F" : i < stepIndex ? "#7a6a4a" : "#3a3a3a", transition:"color 0.25s" }}>
                        {step.label}
                      </span>
                    </button>
                  ))}
                </div>
                {/* Progress track */}
                <div style={{ height:"2px", background:"rgba(255,255,255,0.06)", borderRadius:"99px", marginBottom:"0", overflow:"hidden" }}>
                  <div style={{ height:"100%", background:"linear-gradient(90deg,#D99E4F,#c4863a)", borderRadius:"99px", width:`${((stepIndex)/(STEPS.length-1))*100}%`, transition:"width 0.4s cubic-bezier(0.16,1,0.3,1)" }}/>
                </div>
              </div>

              {/* ── Step Title ── */}
              <div style={{ padding:"18px 24px 10px", flexShrink:0 }}>
                <div style={{ display:"flex", alignItems:"baseline", justifyContent:"space-between" }}>
                  <div>
                    <h3 style={{ fontFamily:"'Cormorant Garamond',Georgia,serif", fontSize:"22px", fontWeight:600, color:"#fff", margin:"0 0 2px" }}>
                      {currentStep.label}
                    </h3>
                    <p style={{ fontSize:"12px", color:"#5a7a3a", margin:0, fontWeight:500 }}>
                      ✦ {currentStep.hint}
                    </p>
                  </div>
                  {/* Running tally for this step */}
                  {currentStep.id === "sides"   && sumQty(sidesQm)   > 0 && <span style={{ fontSize:"13px", color:"#D99E4F", fontWeight:600 }}>{sumQty(sidesQm)} selected</span>}
                  {currentStep.id === "sauces"  && sumQty(saucesQm)  > 0 && <span style={{ fontSize:"13px", color:"#D99E4F", fontWeight:600 }}>{sumQty(saucesQm)} selected</span>}
                  {currentStep.id === "pickles" && sumQty(picklesQm) > 0 && <span style={{ fontSize:"13px", color:"#D99E4F", fontWeight:600 }}>{sumQty(picklesQm)} selected</span>}
                  {currentStep.id === "drinks"  && sumQty(drinksQm)  > 0 && <span style={{ fontSize:"13px", color:"#D99E4F", fontWeight:600 }}>{sumQty(drinksQm)} selected</span>}
                </div>
              </div>

              {/* ── Scrollable Items ── */}
              <div className="modal-scroll" style={{ flex:1, overflowY:"auto", padding:"4px 24px 20px" }}>
                <div className="step-items" key={currentStep.id} style={{ display:"flex", flexDirection:"column", gap:"8px" }}>
                  {renderStepItems()}
                </div>
              </div>

              {/* ── Footer ── */}
              <div style={{ borderTop:"1px solid rgba(255,255,255,0.06)", background:"#0a0a0a", padding:"16px 24px 20px", flexShrink:0 }}>
                {/* Total */}
                <div style={{ display:"flex", alignItems:"baseline", justifyContent:"space-between", marginBottom:"14px" }}>
                  <span style={{ fontSize:"13px", color:"#5a5550" }}>Total · {mainQty} item{mainQty>1?"s":""}</span>
                  <span style={{ fontFamily:"'Cormorant Garamond',Georgia,serif", fontSize:"28px", fontWeight:600, color:"#fff", letterSpacing:"-0.01em" }}>
                    {formatMoney(totalPrice)}
                  </span>
                </div>

                {/* Nav buttons */}
                <div style={{ display:"flex", alignItems:"center", gap:"10px" }}>
                  {stepIndex > 0 ? (
                    <button
                      onClick={()=>setStepIndex(i=>i-1)}
                      style={{ display:"flex", alignItems:"center", gap:"6px", padding:"0 16px", height:"48px", borderRadius:"13px", border:"1px solid rgba(255,255,255,0.1)", background:"transparent", color:"#777", fontFamily:"'DM Sans',system-ui,sans-serif", fontSize:"13px", fontWeight:500, cursor:"pointer", flexShrink:0, transition:"border-color 0.18s, color 0.18s" }}
                      onMouseEnter={e=>{ const el=e.currentTarget as HTMLButtonElement; el.style.borderColor="rgba(255,255,255,0.2)"; el.style.color="#ccc"; }}
                      onMouseLeave={e=>{ const el=e.currentTarget as HTMLButtonElement; el.style.borderColor="rgba(255,255,255,0.1)"; el.style.color="#777"; }}
                    >
                      <ChevLeft/> Back
                    </button>
                  ) : (
                    // Skip all / close
                    <button onClick={closeBuilder} style={{ display:"flex", alignItems:"center", gap:"6px", padding:"0 16px", height:"48px", borderRadius:"13px", border:"1px solid rgba(255,255,255,0.08)", background:"transparent", color:"#555", fontFamily:"'DM Sans',system-ui,sans-serif", fontSize:"13px", cursor:"pointer", flexShrink:0 }}>
                      <XIcon/> Cancel
                    </button>
                  )}

                  {isLastStep ? (
                    <button
                      onClick={addToCart}
                      style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", gap:"9px", height:"48px", borderRadius:"13px", border:"none", background:"#D99E4F", color:"#000", fontFamily:"'DM Sans',system-ui,sans-serif", fontSize:"14px", fontWeight:700, cursor:"pointer", letterSpacing:"0.01em", transition:"filter 0.18s, transform 0.18s" }}
                      onMouseEnter={e=>{ const el=e.currentTarget as HTMLButtonElement; el.style.filter="brightness(1.1)"; el.style.transform="translateY(-1px)"; }}
                      onMouseLeave={e=>{ const el=e.currentTarget as HTMLButtonElement; el.style.filter=""; el.style.transform=""; }}
                    >
                      <BagIcon size={17}/> Add to Cart — {formatMoney(totalPrice)}
                    </button>
                  ) : (
                    <button
                      onClick={()=>setStepIndex(i=>i+1)}
                      style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", gap:"9px", height:"48px", borderRadius:"13px", border:"none", background:"#D99E4F", color:"#000", fontFamily:"'DM Sans',system-ui,sans-serif", fontSize:"14px", fontWeight:700, cursor:"pointer", letterSpacing:"0.01em", transition:"filter 0.18s, transform 0.18s" }}
                      onMouseEnter={e=>{ const el=e.currentTarget as HTMLButtonElement; el.style.filter="brightness(1.1)"; el.style.transform="translateY(-1px)"; }}
                      onMouseLeave={e=>{ const el=e.currentTarget as HTMLButtonElement; el.style.filter=""; el.style.transform=""; }}
                    >
                      Next: {STEPS[stepIndex+1].label} <ChevRight/>
                    </button>
                  )}
                </div>
              </div>

            </div>
          </div>
        )}

        {/* ── Toast ─────────────────────────────────────── */}
        {toast && (
          <div key={toast.key} style={{ position:"fixed", bottom:"32px", left:"50%", zIndex:100, display:"flex", alignItems:"center", gap:"10px", padding:"12px 20px", borderRadius:"99px", border:"1px solid rgba(217,158,79,0.2)", background:"rgba(12,12,12,0.95)", backdropFilter:"blur(16px)", fontSize:"14px", fontWeight:500, color:"#e2ddd6", whiteSpace:"nowrap", animation:"toastIn 0.4s cubic-bezier(0.16,1,0.3,1) both", boxShadow:"0 8px 40px rgba(0,0,0,0.6)", transform:"translateX(-50%)" }}>
            <span style={{ width:"20px", height:"20px", borderRadius:"50%", background:"#D99E4F", display:"flex", alignItems:"center", justifyContent:"center", color:"#000", flexShrink:0 }}>
              <CheckIcon/>
            </span>
            {toast.msg}
          </div>
        )}
      </div>
    </>
  );
}
