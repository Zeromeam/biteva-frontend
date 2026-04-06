export type MenuProduct = {
  id: string;
  name: string;
  subtitle: string;
  price: number;
  image: string;
};

export type MenuOption = {
  id: string;
  name: string;
  price: number;
};

export type CartItem = {
  cartId: string;
  product: MenuProduct;
  side: MenuOption | null;
  sauces: MenuOption[];
  drink: MenuOption | null;
  quantity: number;
};

export type CustomerDetails = {
  fullName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  postalCode: string;
  country: string;
  note: string;
};

export const products: MenuProduct[] = [
  {
    id: "beef",
    name: "Beef",
    subtitle: "Bold grilled flavor, rich and satisfying.",
    price: 10.9,
    image: "/images/order/beef.png",
  },
  {
    id: "chicken-skewer",
    name: "Chicken Skewer",
    subtitle: "Juicy skewers with a lighter finish.",
    price: 9.9,
    image: "/images/order/chicken-skewer.png",
  },
  {
    id: "vegan",
    name: "Vegan",
    subtitle: "Fresh, seasoned, clean, and filling.",
    price: 9.4,
    image: "/images/order/vegan.png",
  },
];

export const sides: MenuOption[] = [
  { id: "fries", name: "Fries", price: 2.2 },
  { id: "rice", name: "Rice", price: 2.0 },
  { id: "salad", name: "Salad", price: 2.3 },
  { id: "sweet-potato", name: "Sweet potato fries", price: 2.8 },
];

export const sauces: MenuOption[] = [
  { id: "garlic", name: "Garlic sauce", price: 0.8 },
  { id: "spicy", name: "Spicy sauce", price: 0.8 },
  { id: "bbq", name: "BBQ sauce", price: 0.8 },
  { id: "tahini", name: "Tahini", price: 0.8 },
];

export const drinks: MenuOption[] = [
  { id: "cola", name: "Cola", price: 2.0 },
  { id: "cola-zero", name: "Cola Zero", price: 2.0 },
  { id: "sprite", name: "Sprite", price: 2.0 },
  { id: "water", name: "Water", price: 1.5 },
  { id: "ice-tea", name: "Ice tea", price: 2.2 },
];

export const initialCustomerDetails: CustomerDetails = {
  fullName: "",
  email: "",
  phone: "",
  address: "",
  city: "",
  postalCode: "",
  country: "AT",
  note: "",
};

const STORAGE_KEY = "biteva-cart";
const CART_EVENT = "biteva-cart-updated";

export function formatMoney(value: number) {
  return new Intl.NumberFormat("de-AT", {
    style: "currency",
    currency: "EUR",
  }).format(value);
}

export function getItemUnitPrice(item: CartItem) {
  return (
    item.product.price +
    (item.side?.price ?? 0) +
    item.sauces.reduce((sum, sauce) => sum + sauce.price, 0) +
    (item.drink?.price ?? 0)
  );
}

export function getCartSubtotal(cart: CartItem[]) {
  return cart.reduce((sum, item) => sum + getItemUnitPrice(item) * item.quantity, 0);
}

export function getCartCount(cart: CartItem[]) {
  return cart.reduce((sum, item) => sum + item.quantity, 0);
}

export function loadCart(): CartItem[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveCart(cart: CartItem[]) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
  window.dispatchEvent(new Event(CART_EVENT));
}

export function clearCart() {
  saveCart([]);
}

export function addCartItem(item: CartItem) {
  const current = loadCart();
  current.push(item);
  saveCart(current);
}

export function updateCartItemQuantity(cartId: string, quantity: number) {
  const next = loadCart()
    .map((item) => (item.cartId === cartId ? { ...item, quantity } : item))
    .filter((item) => item.quantity > 0);

  saveCart(next);
}

export function removeCartItem(cartId: string) {
  const next = loadCart().filter((item) => item.cartId !== cartId);
  saveCart(next);
}

export function subscribeToCartUpdates(callback: () => void) {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  window.addEventListener(CART_EVENT, callback);
  window.addEventListener("storage", callback);

  return () => {
    window.removeEventListener(CART_EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}
