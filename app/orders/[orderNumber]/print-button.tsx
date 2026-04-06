"use client";

export function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      style={{
        padding: "10px 22px", borderRadius: "99px", border: "1px solid rgba(255,255,255,0.12)",
        background: "rgba(255,255,255,0.04)", color: "#9a9290", fontFamily: "'DM Sans', system-ui, sans-serif",
        fontSize: "13px", fontWeight: 500, cursor: "pointer",
      }}
    >
      Drucken / Print
    </button>
  );
}
