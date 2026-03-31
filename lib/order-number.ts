function pad(value: number) {
  return String(value).padStart(2, "0");
}

export function makeOrderNumber() {
  const now = new Date();
  const datePart = [
    now.getFullYear(),
    pad(now.getMonth() + 1),
    pad(now.getDate()),
  ].join("");

  const randomPart = Math.random().toString(36).slice(2, 8).toUpperCase();

  return `BTV-${datePart}-${randomPart}`;
}
