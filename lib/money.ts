export function formatCentsAsEuro(value: number) {
  return new Intl.NumberFormat("en-AT", {
    style: "currency",
    currency: "EUR",
  }).format(value / 100);
}
