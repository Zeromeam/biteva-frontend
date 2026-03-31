"use client";

import Image from "next/image";
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

function CartIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="9" cy="20" r="1.6" />
      <circle cx="18" cy="20" r="1.6" />
      <path d="M3 4h2l2.2 10.2a1 1 0 0 0 1 .8h9.9a1 1 0 0 0 1-.8L21 7H7.2" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="m5 12 4.2 4.2L19 6.5" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="m6 6 12 12M18 6 6 18" />
    </svg>
  );
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

export default function OrderExperience() {
  const [cartCount, setCartCount] = useState(0);
  const [activeProduct, setActiveProduct] = useState<MenuProduct | null>(null);
  const [step, setStep] = useState<BuilderStep>("addons");
  const [selectedSideId, setSelectedSideId] = useState<string>(sides[0].id);
  const [selectedSauceIds, setSelectedSauceIds] = useState<string[]>([]);
  const [selectedDrinkId, setSelectedDrinkId] = useState<string>(drinks[0].id);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    const syncCartCount = () => {
      const nextCount = getCartCount(loadCart());
      setCartCount(nextCount);
    };

    syncCartCount();
    return subscribeToCartUpdates(syncCartCount);
  }, []);

  useEffect(() => {
    if (!toast) {
      return;
    }

    const timeout = window.setTimeout(() => setToast(null), 2200);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const selectedSide = useMemo(
    () => sides.find((option) => option.id === selectedSideId) ?? sides[0],
    [selectedSideId],
  );

  const selectedSauces = useMemo(
    () => sauces.filter((option) => selectedSauceIds.includes(option.id)),
    [selectedSauceIds],
  );

  const selectedDrink = useMemo(
    () => drinks.find((option) => option.id === selectedDrinkId) ?? drinks[0],
    [selectedDrinkId],
  );

  const currentTotal = activeProduct
    ? getSelectionTotal(activeProduct, selectedSide, selectedSauces, selectedDrink)
    : 0;

  const openBuilder = (product: MenuProduct) => {
    setActiveProduct(product);
    setStep("addons");
    setSelectedSideId(sides[0].id);
    setSelectedSauceIds([]);
    setSelectedDrinkId(drinks[0].id);
  };

  const closeBuilder = () => {
    setActiveProduct(null);
    setStep("addons");
  };

  const toggleSauce = (sauceId: string) => {
    setSelectedSauceIds((current) =>
      current.includes(sauceId)
        ? current.filter((id) => id !== sauceId)
        : [...current, sauceId],
    );
  };

  const addToCart = () => {
    if (!activeProduct) {
      return;
    }

    addCartItem({
      cartId: `${activeProduct.id}-${Date.now()}`,
      product: activeProduct,
      side: selectedSide.id === "none" ? null : selectedSide,
      sauces: selectedSauces,
      drink: selectedDrink.id === "none" ? null : selectedDrink,
      quantity: 1,
    });

    setToast(`${activeProduct.name} added to cart`);
    closeBuilder();
  };

  return (
    <main className="min-h-screen bg-[#06111f] text-white">
      <div className="mx-auto max-w-7xl px-4 pb-16 pt-6 sm:px-6 lg:px-8">
        <header className="mb-10 flex items-start justify-between gap-4">
          <div className="max-w-2xl">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.45em] text-blue-300/90">
              Biteva Menu
            </p>
            <h1 className="text-4xl font-semibold tracking-tight text-white sm:text-5xl">
              Pick your meal.
            </h1>
            <p className="mt-4 max-w-xl text-sm leading-6 text-slate-300 sm:text-base">
              Clean product view, simple choices, fast checkout. Tap the blue plus,
              choose your add-ons, then finish on the checkout page.
            </p>
          </div>

          <Link
            href="/order/checkout"
            className="relative inline-flex h-14 w-14 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white shadow-[0_18px_40px_rgba(0,0,0,0.35)] backdrop-blur transition hover:border-blue-400/50 hover:bg-blue-500/15 hover:text-blue-200"
            aria-label="Open cart"
          >
            <CartIcon />
            <span className="absolute -right-1 -top-1 inline-flex min-h-6 min-w-6 items-center justify-center rounded-full bg-blue-500 px-1.5 text-xs font-semibold text-white">
              {cartCount}
            </span>
          </Link>
        </header>

        <section className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
          {products.map((product) => (
            <article
              key={product.id}
              className="group overflow-hidden rounded-[30px] border border-white/10 bg-[#0b1729] shadow-[0_28px_80px_rgba(0,0,0,0.35)] transition duration-300 hover:-translate-y-1 hover:border-blue-400/50"
            >
              <div className="relative aspect-[4/4.8] overflow-hidden">
                <Image
                  src={product.image}
                  alt={product.name}
                  fill
                  sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw"
                  className="object-cover transition duration-500 group-hover:scale-[1.03]"
                  priority={product.id === "beef"}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#06111f] via-[#06111f]/15 to-transparent" />

                <button
                  type="button"
                  onClick={() => openBuilder(product)}
                  className="absolute right-4 top-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-blue-500 text-white shadow-[0_12px_30px_rgba(59,130,246,0.45)] transition hover:scale-105 hover:bg-blue-400"
                  aria-label={`Customize ${product.name}`}
                >
                  <PlusIcon />
                </button>

                <div className="absolute inset-x-0 bottom-0 p-5 sm:p-6">
                  <div className="inline-flex rounded-full border border-white/10 bg-black/30 px-3 py-1 text-xs font-medium text-slate-200 backdrop-blur">
                    from {formatMoney(product.price)}
                  </div>
                  <h2 className="mt-3 text-2xl font-semibold tracking-tight text-white">
                    {product.name}
                  </h2>
                  <p className="mt-2 max-w-xs text-sm text-slate-300">
                    {product.subtitle}
                  </p>
                </div>
              </div>
            </article>
          ))}
        </section>
      </div>

      {activeProduct ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#020817]/80 px-4 py-6 backdrop-blur-sm">
          <div className="relative max-h-[92vh] w-full max-w-5xl overflow-hidden rounded-[34px] border border-white/10 bg-[#081223] shadow-[0_30px_120px_rgba(0,0,0,0.55)]">
            <button
              type="button"
              onClick={closeBuilder}
              className="absolute right-5 top-5 z-10 inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-black/20 text-white transition hover:border-white/25 hover:bg-white/10"
              aria-label="Close"
            >
              <CloseIcon />
            </button>

            <div className="grid max-h-[92vh] grid-cols-1 overflow-y-auto lg:grid-cols-[1.08fr_1fr]">
              <div className="relative min-h-[320px] lg:min-h-full">
                <Image
                  src={activeProduct.image}
                  alt={activeProduct.name}
                  fill
                  sizes="(max-width: 1024px) 100vw, 50vw"
                  className="object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#040b16] via-[#040b16]/10 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-6 sm:p-8">
                  <div className="inline-flex rounded-full border border-white/15 bg-black/25 px-3 py-1 text-xs font-medium text-slate-100 backdrop-blur">
                    {activeProduct.name}
                  </div>
                  <h2 className="mt-4 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                    Build your order
                  </h2>
                  <p className="mt-3 max-w-md text-sm leading-6 text-slate-200/90">
                    Choose your side, sauces, and drink. Everything you select here
                    goes straight into the cart.
                  </p>
                </div>
              </div>

              <div className="p-5 sm:p-7 lg:p-8">
                <div className="mb-7 flex items-center gap-3">
                  <div className={`inline-flex h-10 min-w-10 items-center justify-center rounded-full text-sm font-semibold ${step === "addons" ? "bg-blue-500 text-white" : "bg-white/8 text-slate-300"}`}>
                    1
                  </div>
                  <div className="h-px flex-1 bg-white/10" />
                  <div className={`inline-flex h-10 min-w-10 items-center justify-center rounded-full text-sm font-semibold ${step === "drinks" ? "bg-blue-500 text-white" : "bg-white/8 text-slate-300"}`}>
                    2
                  </div>
                </div>

                {step === "addons" ? (
                  <div className="space-y-7">
                    <section>
                      <div className="mb-4 flex items-end justify-between gap-3">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-blue-300">
                            Sides
                          </p>
                          <h3 className="mt-2 text-2xl font-semibold text-white">
                            Pick one side
                          </h3>
                        </div>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2">
                        {sides.map((option) => {
                          const selected = selectedSideId === option.id;
                          return (
                            <button
                              key={option.id}
                              type="button"
                              onClick={() => setSelectedSideId(option.id)}
                              className={`rounded-[22px] border px-4 py-4 text-left transition ${selected ? "border-blue-400 bg-blue-500/15 shadow-[0_12px_35px_rgba(59,130,246,0.18)]" : "border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/[0.07]"}`}
                            >
                              <div className="flex items-center justify-between gap-3">
                                <div>
                                  <p className="text-base font-medium text-white">{option.name}</p>
                                  <p className="mt-1 text-sm text-slate-300">{formatMoney(option.price)}</p>
                                </div>
                                {selected ? (
                                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-blue-500 text-white">
                                    <CheckIcon />
                                  </span>
                                ) : null}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </section>

                    <section>
                      <div className="mb-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.35em] text-blue-300">
                          Sauces
                        </p>
                        <h3 className="mt-2 text-2xl font-semibold text-white">
                          Add your sauces
                        </h3>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2">
                        {sauces.map((option) => {
                          const selected = selectedSauceIds.includes(option.id);
                          return (
                            <button
                              key={option.id}
                              type="button"
                              onClick={() => toggleSauce(option.id)}
                              className={`rounded-[22px] border px-4 py-4 text-left transition ${selected ? "border-blue-400 bg-blue-500/15 shadow-[0_12px_35px_rgba(59,130,246,0.18)]" : "border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/[0.07]"}`}
                            >
                              <div className="flex items-center justify-between gap-3">
                                <div>
                                  <p className="text-base font-medium text-white">{option.name}</p>
                                  <p className="mt-1 text-sm text-slate-300">{formatMoney(option.price)}</p>
                                </div>
                                <span className={`inline-flex h-8 w-8 items-center justify-center rounded-full border ${selected ? "border-blue-400 bg-blue-500 text-white" : "border-white/15 text-transparent"}`}>
                                  <CheckIcon />
                                </span>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </section>
                  </div>
                ) : (
                  <div className="space-y-7">
                    <section>
                      <div className="mb-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.35em] text-blue-300">
                          Drinks
                        </p>
                        <h3 className="mt-2 text-2xl font-semibold text-white">
                          Choose your drink
                        </h3>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2">
                        {drinks.map((option) => {
                          const selected = selectedDrinkId === option.id;
                          return (
                            <button
                              key={option.id}
                              type="button"
                              onClick={() => setSelectedDrinkId(option.id)}
                              className={`rounded-[22px] border px-4 py-4 text-left transition ${selected ? "border-blue-400 bg-blue-500/15 shadow-[0_12px_35px_rgba(59,130,246,0.18)]" : "border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/[0.07]"}`}
                            >
                              <div className="flex items-center justify-between gap-3">
                                <div>
                                  <p className="text-base font-medium text-white">{option.name}</p>
                                  <p className="mt-1 text-sm text-slate-300">{formatMoney(option.price)}</p>
                                </div>
                                {selected ? (
                                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-blue-500 text-white">
                                    <CheckIcon />
                                  </span>
                                ) : null}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </section>
                  </div>
                )}

                <div className="mt-8 rounded-[24px] border border-white/10 bg-white/5 p-4">
                  <div className="flex items-center justify-between gap-4 text-sm text-slate-300">
                    <span>Total</span>
                    <span className="text-xl font-semibold text-white">{formatMoney(currentTotal)}</span>
                  </div>
                </div>

                <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-between">
                  {step === "drinks" ? (
                    <button
                      type="button"
                      onClick={() => setStep("addons")}
                      className="inline-flex items-center justify-center rounded-full border border-white/12 bg-white/5 px-5 py-3 text-sm font-medium text-white transition hover:border-white/20 hover:bg-white/[0.08]"
                    >
                      Back
                    </button>
                  ) : (
                    <div />
                  )}

                  {step === "addons" ? (
                    <button
                      type="button"
                      onClick={() => setStep("drinks")}
                      className="inline-flex items-center justify-center rounded-full bg-blue-500 px-6 py-3 text-sm font-semibold text-white shadow-[0_16px_40px_rgba(59,130,246,0.3)] transition hover:bg-blue-400"
                    >
                      Continue to drinks
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={addToCart}
                      className="inline-flex items-center justify-center rounded-full bg-blue-500 px-6 py-3 text-sm font-semibold text-white shadow-[0_16px_40px_rgba(59,130,246,0.3)] transition hover:bg-blue-400"
                    >
                      Add to cart
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {toast ? (
        <div className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-full border border-blue-400/30 bg-[#09182d] px-5 py-3 text-sm font-medium text-white shadow-[0_18px_60px_rgba(0,0,0,0.4)]">
          {toast}
        </div>
      ) : null}
    </main>
  );
}
