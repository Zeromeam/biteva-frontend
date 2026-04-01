"use client";

import Image from "next/image";
import { useMemo, useState } from "react";

type MenuProduct = {
  id: string;
  name: string;
  description: string;
  price: number;
  image: string;
};

type MenuOption = {
  id: string;
  name: string;
  price: number;
};

type CartItem = {
  cartId: string;
  product: MenuProduct;
  side: MenuOption;
  sauce: MenuOption;
  drink: MenuOption;
  quantity: number;
};

type CustomerDetails = {
  fullName: string;
  phone: string;
  address: string;
  note: string;
};

const products: MenuProduct[] = [
  {
    id: "beef",
    name: "Beef",
    description: "Tender beef, fresh bread, strong flavor.",
    price: 10.9,
    image: "/images/order/beef.png",
  },
  {
    id: "chicken-skewer",
    name: "Chicken Skewer",
    description: "Juicy chicken skewers with a lighter taste.",
    price: 9.9,
    image: "/images/order/chicken-skewer.png",
  },
  {
    id: "vegan",
    name: "Vegan",
    description: "A full vegan option with bold seasoning.",
    price: 9.4,
    image: "/images/order/vegan.png",
  },
];

const sideOptions: MenuOption[] = [
  { id: "fries", name: "Fries", price: 2.2 },
  { id: "rice", name: "Rice", price: 2.0 },
  { id: "salad", name: "Salad", price: 2.3 },
  { id: "sweet-potato-fries", name: "Sweet Potato Fries", price: 2.8 },
];

const sauceOptions: MenuOption[] = [
  { id: "garlic", name: "Garlic Sauce", price: 0.8 },
  { id: "spicy", name: "Spicy Sauce", price: 0.8 },
  { id: "bbq", name: "BBQ Sauce", price: 0.8 },
  { id: "tahini", name: "Tahini", price: 0.8 },
];

const drinkOptions: MenuOption[] = [
  { id: "cola", name: "Cola", price: 2.0 },
  { id: "cola-zero", name: "Cola Zero", price: 2.0 },
  { id: "sprite", name: "Sprite", price: 2.0 },
  { id: "water", name: "Water", price: 1.5 },
  { id: "ice-tea", name: "Ice Tea", price: 2.2 },
];

const initialDetails: CustomerDetails = {
  fullName: "",
  phone: "",
  address: "",
  note: "",
};

const money = (value: number) =>
  new Intl.NumberFormat("de-AT", {
    style: "currency",
    currency: "EUR",
  }).format(value);

const getItemUnitPrice = (item: CartItem) =>
  item.product.price + item.side.price + item.sauce.price + item.drink.price;

export default function OrderBuilder() {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerDetails, setCustomerDetails] =
    useState<CustomerDetails>(initialDetails);
  const [activeProduct, setActiveProduct] = useState<MenuProduct | null>(null);
  const [builderStep, setBuilderStep] = useState<"sides" | "drinks">("sides");
  const [selectedSideId, setSelectedSideId] = useState<string>(sideOptions[0].id);
  const [selectedSauceId, setSelectedSauceId] = useState<string>(
    sauceOptions[0].id,
  );
  const [selectedDrinkId, setSelectedDrinkId] = useState<string>(
    drinkOptions[0].id,
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const subtotal = useMemo(
    () =>
      cart.reduce(
        (sum, item) => sum + getItemUnitPrice(item) * item.quantity,
        0,
      ),
    [cart],
  );

  const cartCount = useMemo(
    () => cart.reduce((sum, item) => sum + item.quantity, 0),
    [cart],
  );

  const selectedSide =
    sideOptions.find((option) => option.id === selectedSideId) ?? sideOptions[0];
  const selectedSauce =
    sauceOptions.find((option) => option.id === selectedSauceId) ?? sauceOptions[0];
  const selectedDrink =
    drinkOptions.find((option) => option.id === selectedDrinkId) ?? drinkOptions[0];

  const openBuilder = (product: MenuProduct) => {
    setActiveProduct(product);
    setBuilderStep("sides");
    setSelectedSideId(sideOptions[0].id);
    setSelectedSauceId(sauceOptions[0].id);
    setSelectedDrinkId(drinkOptions[0].id);
    setErrorMessage(null);
    setSuccessMessage(null);
  };

  const closeBuilder = () => {
    setActiveProduct(null);
    setBuilderStep("sides");
  };

  const addToCart = () => {
    if (!activeProduct) {
      return;
    }

    const newItem: CartItem = {
      cartId: `${activeProduct.id}-${Date.now()}`,
      product: activeProduct,
      side: selectedSide,
      sauce: selectedSauce,
      drink: selectedDrink,
      quantity: 1,
    };

    setCart((current) => [...current, newItem]);
    setSuccessMessage(`${activeProduct.name} added to cart.`);
    setErrorMessage(null);
    closeBuilder();
  };

  const updateQuantity = (cartId: string, nextQuantity: number) => {
    if (nextQuantity <= 0) {
      setCart((current) => current.filter((item) => item.cartId !== cartId));
      return;
    }

    setCart((current) =>
      current.map((item) =>
        item.cartId === cartId ? { ...item, quantity: nextQuantity } : item,
      ),
    );
  };

  const removeItem = (cartId: string) => {
    setCart((current) => current.filter((item) => item.cartId !== cartId));
  };

  const onDetailsChange = (
    field: keyof CustomerDetails,
    value: CustomerDetails[keyof CustomerDetails],
  ) => {
    setCustomerDetails((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const handleBuyNow = async () => {
    setErrorMessage(null);
    setSuccessMessage(null);

    if (cart.length === 0) {
      setErrorMessage("Your cart is empty.");
      return;
    }

    if (
      !customerDetails.fullName.trim() ||
      !customerDetails.phone.trim() ||
      !customerDetails.address.trim()
    ) {
      setErrorMessage("Please fill your name, phone, and address.");
      return;
    }

    const payload = {
      customer: customerDetails,
      items: cart.map((item) => ({
        productId: item.product.id,
        productName: item.product.name,
        quantity: item.quantity,
        side: item.side.name,
        sauce: item.sauce.name,
        drink: item.drink.name,
        unitPrice: getItemUnitPrice(item),
        totalPrice: getItemUnitPrice(item) * item.quantity,
      })),
      totals: {
        itemCount: cartCount,
        subtotal,
      },
    };

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data: unknown = await response.json().catch(() => null);

      if (!response.ok) {
        if (
          data &&
          typeof data === "object" &&
          "error" in data &&
          typeof data.error === "string"
        ) {
          throw new Error(data.error);
        }

        throw new Error("Could not place your order.");
      }

      setSuccessMessage("Order placed successfully.");
      setCart([]);
      setCustomerDetails(initialDetails);
    } catch (error) {
      const fallbackMessage =
        error instanceof Error
          ? error.message
          : "Could not place your order.";

      setErrorMessage(
        `${fallbackMessage} If your current backend expects different fields, update the payload inside handleBuyNow in components/order-builder.tsx.`,
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#050816] px-4 py-6 text-white sm:px-6 lg:px-10">
      <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[1.7fr_0.95fr]">
        <section className="space-y-6">
          <div className="rounded-[28px] border border-blue-500/30 bg-[#0a1330] p-5 shadow-[0_0_30px_rgba(37,99,235,0.12)] sm:p-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-sm font-medium uppercase tracking-[0.35em] text-blue-300">
                  Biteva Order
                </p>
                <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">
                  Pick your meal.
                </h1>
              </div>

              <div className="rounded-full border border-blue-400/35 bg-blue-500/10 px-4 py-2 text-sm font-semibold text-blue-100">
                {cartCount} item{cartCount === 1 ? "" : "s"} in cart
              </div>
            </div>
          </div>

          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {products.map((product) => (
              <article
                key={product.id}
                className="group overflow-hidden rounded-[30px] border border-blue-500/25 bg-[#091127] shadow-[0_24px_60px_rgba(2,8,23,0.45)] transition duration-200 hover:-translate-y-1 hover:border-blue-400/50"
              >
                <div className="relative aspect-[4/5] overflow-hidden">
                  <Image
                    src={product.image}
                    alt={product.name}
                    fill
                    className="object-cover transition duration-300 group-hover:scale-[1.03]"
                    sizes="(max-width: 768px) 100vw, 33vw"
                    priority={product.id === "beef"}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#020617] via-[#020617]/25 to-transparent" />

                  <button
                    type="button"
                    onClick={() => openBuilder(product)}
                    className="absolute bottom-4 right-4 inline-flex h-14 w-14 items-center justify-center rounded-full border border-blue-200/40 bg-blue-600 text-4xl font-light leading-none text-white shadow-[0_0_24px_rgba(59,130,246,0.45)] transition hover:scale-105 hover:bg-blue-500"
                    aria-label={`Customize ${product.name}`}
                  >
                    +
                  </button>
                </div>

                <div className="space-y-3 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="text-2xl font-extrabold">{product.name}</h2>
                      <p className="mt-1 text-sm leading-6 text-slate-300">
                        {product.description}
                      </p>
                    </div>

                    <span className="shrink-0 rounded-full bg-blue-500/15 px-3 py-1 text-sm font-bold text-blue-100">
                      {money(product.price)}
                    </span>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        <aside className="lg:sticky lg:top-6 lg:h-fit">
          <div className="rounded-[30px] border border-blue-500/30 bg-[#081123] p-5 shadow-[0_0_30px_rgba(37,99,235,0.16)] sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm uppercase tracking-[0.3em] text-blue-300">
                  Cart
                </p>
                <h2 className="mt-2 text-2xl font-black">Your order</h2>
              </div>
              <div className="rounded-full bg-blue-500/15 px-3 py-1 text-sm font-bold text-blue-100">
                {money(subtotal)}
              </div>
            </div>

            <div className="mt-5 space-y-4">
              {cart.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-blue-400/25 bg-white/[0.03] p-5 text-sm leading-6 text-slate-300">
                  Add a product with the blue plus button.
                </div>
              ) : (
                cart.map((item) => (
                  <div
                    key={item.cartId}
                    className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4"
                  >
                    <div className="flex gap-3">
                      <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl border border-white/10">
                        <Image
                          src={item.product.image}
                          alt={item.product.name}
                          fill
                          className="object-cover"
                          sizes="80px"
                        />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <h3 className="text-lg font-bold">{item.product.name}</h3>
                            <p className="mt-1 text-xs leading-5 text-slate-300">
                              {item.side.name} · {item.sauce.name} · {item.drink.name}
                            </p>
                          </div>

                          <button
                            type="button"
                            onClick={() => removeItem(item.cartId)}
                            className="text-sm font-semibold text-slate-300 transition hover:text-red-300"
                          >
                            Remove
                          </button>
                        </div>

                        <div className="mt-3 flex items-center justify-between gap-3">
                          <div className="inline-flex items-center rounded-full border border-blue-400/25 bg-blue-500/10 p-1">
                            <button
                              type="button"
                              onClick={() =>
                                updateQuantity(item.cartId, item.quantity - 1)
                              }
                              className="h-9 w-9 rounded-full text-xl font-bold text-white transition hover:bg-white/10"
                            >
                              −
                            </button>
                            <span className="min-w-[2.5rem] text-center text-sm font-bold">
                              {item.quantity}
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                updateQuantity(item.cartId, item.quantity + 1)
                              }
                              className="h-9 w-9 rounded-full text-xl font-bold text-white transition hover:bg-white/10"
                            >
                              +
                            </button>
                          </div>

                          <div className="text-right text-base font-extrabold text-blue-100">
                            {money(getItemUnitPrice(item) * item.quantity)}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="mt-6 space-y-4 rounded-[26px] border border-blue-400/20 bg-blue-500/5 p-4 sm:p-5">
              <div>
                <p className="text-sm uppercase tracking-[0.3em] text-blue-300">
                  Details
                </p>
                <h3 className="mt-2 text-xl font-black">Fill before buy now</h3>
              </div>

              <div className="space-y-3">
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-slate-200">
                    Full name
                  </span>
                  <input
                    value={customerDetails.fullName}
                    onChange={(event) =>
                      onDetailsChange("fullName", event.target.value)
                    }
                    className="w-full rounded-2xl border border-blue-400/25 bg-[#050b1a] px-4 py-3 text-base text-white outline-none transition placeholder:text-slate-500 focus:border-blue-400"
                    placeholder="Your name"
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-slate-200">
                    Phone
                  </span>
                  <input
                    value={customerDetails.phone}
                    onChange={(event) =>
                      onDetailsChange("phone", event.target.value)
                    }
                    className="w-full rounded-2xl border border-blue-400/25 bg-[#050b1a] px-4 py-3 text-base text-white outline-none transition placeholder:text-slate-500 focus:border-blue-400"
                    placeholder="Phone number"
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-slate-200">
                    Address
                  </span>
                  <textarea
                    value={customerDetails.address}
                    onChange={(event) =>
                      onDetailsChange("address", event.target.value)
                    }
                    className="min-h-[100px] w-full rounded-2xl border border-blue-400/25 bg-[#050b1a] px-4 py-3 text-base text-white outline-none transition placeholder:text-slate-500 focus:border-blue-400"
                    placeholder="Street, number, city"
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-slate-200">
                    Note
                  </span>
                  <textarea
                    value={customerDetails.note}
                    onChange={(event) => onDetailsChange("note", event.target.value)}
                    className="min-h-[80px] w-full rounded-2xl border border-blue-400/25 bg-[#050b1a] px-4 py-3 text-base text-white outline-none transition placeholder:text-slate-500 focus:border-blue-400"
                    placeholder="Optional"
                  />
                </label>
              </div>
            </div>

            {(errorMessage || successMessage) && (
              <div
                className={`mt-4 rounded-2xl border px-4 py-3 text-sm font-medium ${
                  errorMessage
                    ? "border-red-400/35 bg-red-500/10 text-red-100"
                    : "border-emerald-400/35 bg-emerald-500/10 text-emerald-100"
                }`}
              >
                {errorMessage ?? successMessage}
              </div>
            )}

            <div className="mt-6 rounded-[24px] border border-white/10 bg-white/[0.03] p-4">
              <div className="flex items-center justify-between text-sm text-slate-300">
                <span>Items</span>
                <span>{cartCount}</span>
              </div>
              <div className="mt-3 flex items-center justify-between text-lg font-black text-white">
                <span>Total</span>
                <span>{money(subtotal)}</span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleBuyNow}
              disabled={isSubmitting}
              className="mt-5 inline-flex w-full items-center justify-center rounded-full bg-blue-600 px-5 py-4 text-lg font-black text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-blue-800"
            >
              {isSubmitting ? "Sending..." : "Buy now"}
            </button>
          </div>
        </aside>
      </div>

      {activeProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#01040d]/80 p-4 backdrop-blur-sm">
          <div className="relative grid max-h-[95vh] w-full max-w-5xl overflow-hidden rounded-[32px] border border-blue-400/30 bg-[#071120] shadow-[0_0_40px_rgba(37,99,235,0.2)] lg:grid-cols-[1fr_1.05fr]">
            <div className="relative min-h-[260px]">
              <Image
                src={activeProduct.image}
                alt={activeProduct.name}
                fill
                className="object-cover"
                sizes="(max-width: 1024px) 100vw, 50vw"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#020617] via-[#020617]/20 to-transparent" />
              <button
                type="button"
                onClick={closeBuilder}
                className="absolute right-4 top-4 inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/20 bg-black/30 text-2xl text-white transition hover:bg-black/50"
                aria-label="Close"
              >
                ×
              </button>
              <div className="absolute bottom-5 left-5 right-5 rounded-[24px] border border-white/10 bg-black/35 p-4 backdrop-blur-md">
                <div className="flex items-end justify-between gap-4">
                  <div>
                    <p className="text-sm uppercase tracking-[0.35em] text-blue-200">
                      Customize
                    </p>
                    <h2 className="mt-2 text-3xl font-black">{activeProduct.name}</h2>
                  </div>
                  <div className="rounded-full bg-blue-500/20 px-4 py-2 text-base font-black text-blue-100">
                    {money(activeProduct.price)}
                  </div>
                </div>
              </div>
            </div>

            <div className="overflow-y-auto p-5 sm:p-6">
              <div className="mb-6 flex items-center gap-3">
                <div
                  className={`rounded-full px-4 py-2 text-sm font-black ${
                    builderStep === "sides"
                      ? "bg-blue-600 text-white"
                      : "bg-white/5 text-slate-300"
                  }`}
                >
                  1. Sides & Sauce
                </div>
                <div
                  className={`rounded-full px-4 py-2 text-sm font-black ${
                    builderStep === "drinks"
                      ? "bg-blue-600 text-white"
                      : "bg-white/5 text-slate-300"
                  }`}
                >
                  2. Drink
                </div>
              </div>

              {builderStep === "sides" ? (
                <div className="space-y-6">
                  <section>
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <h3 className="text-2xl font-black">Choose a side</h3>
                      <span className="text-sm font-semibold text-slate-300">
                        Optional
                      </span>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {sideOptions.map((option) => {
                        const isSelected = selectedSideId === option.id;
                        return (
                          <button
                            key={option.id}
                            type="button"
                            onClick={() => setSelectedSideId(option.id)}
                            className={`rounded-[24px] border p-4 text-left transition ${
                              isSelected
                                ? "border-blue-400 bg-blue-600/15 text-white shadow-[0_0_24px_rgba(59,130,246,0.15)]"
                                : "border-white/10 bg-white/[0.03] text-slate-200 hover:border-blue-300/30 hover:bg-blue-500/5"
                            }`}
                          >
                            <div className="flex items-center justify-between gap-4">
                              <span className="text-lg font-bold">{option.name}</span>
                              <span className="rounded-full bg-black/20 px-3 py-1 text-sm font-bold">
                                {option.price === 0 ? "Included" : `+ ${money(option.price)}`}
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </section>

                  <section>
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <h3 className="text-2xl font-black">Choose a sauce</h3>
                      <span className="text-sm font-semibold text-slate-300">
                        Optional
                      </span>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {sauceOptions.map((option) => {
                        const isSelected = selectedSauceId === option.id;
                        return (
                          <button
                            key={option.id}
                            type="button"
                            onClick={() => setSelectedSauceId(option.id)}
                            className={`rounded-[24px] border p-4 text-left transition ${
                              isSelected
                                ? "border-blue-400 bg-blue-600/15 text-white shadow-[0_0_24px_rgba(59,130,246,0.15)]"
                                : "border-white/10 bg-white/[0.03] text-slate-200 hover:border-blue-300/30 hover:bg-blue-500/5"
                            }`}
                          >
                            <div className="flex items-center justify-between gap-4">
                              <span className="text-lg font-bold">{option.name}</span>
                              <span className="rounded-full bg-black/20 px-3 py-1 text-sm font-bold">
                                {option.price === 0 ? "Included" : `+ ${money(option.price)}`}
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </section>

                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => setBuilderStep("drinks")}
                      className="inline-flex items-center justify-center rounded-full bg-blue-600 px-6 py-3 text-base font-black text-white transition hover:bg-blue-500"
                    >
                      Next: Drinks
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  <section>
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <h3 className="text-2xl font-black">Choose a drink</h3>
                      <span className="text-sm font-semibold text-slate-300">
                        Optional
                      </span>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {drinkOptions.map((option) => {
                        const isSelected = selectedDrinkId === option.id;
                        return (
                          <button
                            key={option.id}
                            type="button"
                            onClick={() => setSelectedDrinkId(option.id)}
                            className={`rounded-[24px] border p-4 text-left transition ${
                              isSelected
                                ? "border-blue-400 bg-blue-600/15 text-white shadow-[0_0_24px_rgba(59,130,246,0.15)]"
                                : "border-white/10 bg-white/[0.03] text-slate-200 hover:border-blue-300/30 hover:bg-blue-500/5"
                            }`}
                          >
                            <div className="flex items-center justify-between gap-4">
                              <span className="text-lg font-bold">{option.name}</span>
                              <span className="rounded-full bg-black/20 px-3 py-1 text-sm font-bold">
                                {option.price === 0 ? "Included" : `+ ${money(option.price)}`}
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </section>

                  <div className="rounded-[24px] border border-blue-400/20 bg-blue-500/5 p-4">
                    <p className="text-sm uppercase tracking-[0.35em] text-blue-300">
                      Summary
                    </p>
                    <div className="mt-3 space-y-2 text-sm text-slate-200">
                      <div className="flex items-center justify-between gap-3">
                        <span>{activeProduct.name}</span>
                        <span>{money(activeProduct.price)}</span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span>{selectedSide.name}</span>
                        <span>
                          {selectedSide.price === 0
                            ? "Included"
                            : `+ ${money(selectedSide.price)}`}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span>{selectedSauce.name}</span>
                        <span>
                          {selectedSauce.price === 0
                            ? "Included"
                            : `+ ${money(selectedSauce.price)}`}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span>{selectedDrink.name}</span>
                        <span>
                          {selectedDrink.price === 0
                            ? "Included"
                            : `+ ${money(selectedDrink.price)}`}
                        </span>
                      </div>
                    </div>
                    <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-4 text-lg font-black text-white">
                      <span>Total</span>
                      <span>
                        {money(
                          activeProduct.price +
                            selectedSide.price +
                            selectedSauce.price +
                            selectedDrink.price,
                        )}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
                    <button
                      type="button"
                      onClick={() => setBuilderStep("sides")}
                      className="inline-flex items-center justify-center rounded-full border border-white/15 bg-white/[0.04] px-6 py-3 text-base font-black text-white transition hover:bg-white/[0.08]"
                    >
                      Back
                    </button>
                    <button
                      type="button"
                      onClick={addToCart}
                      className="inline-flex items-center justify-center rounded-full bg-blue-600 px-6 py-3 text-base font-black text-white transition hover:bg-blue-500"
                    >
                      Add to cart
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
