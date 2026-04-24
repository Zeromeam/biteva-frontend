import posthog from "posthog-js";

export function trackProductOpened(productId: string, productName: string) {
  posthog.capture("product_opened", { product_id: productId, product_name: productName });
}

export function trackCustomizationStepReached(step: string, stepIndex: number, productName: string) {
  posthog.capture("customization_step_reached", { step, step_index: stepIndex, product_name: productName });
}

export function trackItemAddedToCart(productName: string, quantity: number, totalPrice: number) {
  posthog.capture("item_added_to_cart", { product_name: productName, quantity, total_price: totalPrice });
}

export function trackCheckoutStarted(itemCount: number, subtotal: number) {
  posthog.capture("checkout_started", { item_count: itemCount, subtotal });
}

export function trackPaymentAttempted(method: "card" | "express", subtotal: number) {
  posthog.capture("payment_attempted", { method, subtotal });
}

export function trackOrderCompleted(orderNumber: string, subtotal: number, email?: string) {
  posthog.capture("order_completed", { order_number: orderNumber, subtotal });
  if (email) posthog.identify(email, { email, last_order_number: orderNumber });
}
