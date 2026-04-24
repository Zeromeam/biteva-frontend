"use client";

import { useEffect } from "react";
import { trackOrderCompleted } from "@/lib/analytics";

export function OrderCompletedTracker({ orderNumber, subtotal, email }: {
  orderNumber: string;
  subtotal: number;
  email?: string | null;
}) {
  useEffect(() => {
    trackOrderCompleted(orderNumber, subtotal, email ?? undefined);
  }, [orderNumber, subtotal, email]);

  return null;
}
