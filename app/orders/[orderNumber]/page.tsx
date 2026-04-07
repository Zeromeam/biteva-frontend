import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { formatCentsAsEuro } from "@/lib/money";
import { PrintButton } from "./print-button";

type PageProps = {
  params: Promise<{ orderNumber: string }>;
};

export default async function OrderReceiptPage({ params }: PageProps) {
  const { orderNumber } = await params;

  const order = await prisma.order.findUnique({
    where: { orderNumber },
    include: {
      items: { include: { product: true } },
    },
  });

  if (!order) notFound();

  const addressParts = [
    order.shippingAddressLine1,
    order.shippingCity && order.shippingPostalCode
      ? `${order.shippingPostalCode} ${order.shippingCity}`
      : order.shippingCity ?? order.shippingPostalCode,
    order.shippingCountry,
  ].filter(Boolean);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,600;1,600&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600&display=swap');
        *, *::before, *::after { box-sizing: border-box; }
        body { margin: 0; padding: 0; background: #080808; }

        @media print {
          body { background: #fff !important; color: #000 !important; }
          .no-print { display: none !important; }
          .print-card {
            border: 1px solid #ddd !important;
            background: #fff !important;
            color: #000 !important;
          }
          .print-card * { color: #000 !important; border-color: #ddd !important; }
          .print-gold { color: #8a6020 !important; }
        }
      `}</style>

      <div style={{ minHeight: "100vh", background: "#080808", color: "#e2ddd6", fontFamily: "'DM Sans', system-ui, sans-serif", padding: "48px 24px 80px" }}>
        <div style={{ maxWidth: "680px", margin: "0 auto" }}>

          {/* Header */}
          <div style={{ marginBottom: "36px", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "16px", flexWrap: "wrap" }}>
            <div>
              <p style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: "30px", fontWeight: 600, fontStyle: "italic", color: "#D99E4F", margin: "0 0 4px" }}>Biteva</p>
              <p style={{ fontSize: "11px", letterSpacing: "0.2em", textTransform: "uppercase", color: "#525252", margin: 0 }}>Beleg / Receipt</p>
            </div>
            <div className="no-print"><PrintButton /></div>
          </div>

          {/* Card */}
          <div className="print-card" style={{ borderRadius: "22px", border: "1px solid rgba(255,255,255,0.08)", background: "#0c0c0c", padding: "32px" }}>

            {/* Order meta */}
            <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: "12px", marginBottom: "28px", paddingBottom: "28px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
              <div>
                <p style={{ fontSize: "11px", color: "#525252", textTransform: "uppercase", letterSpacing: "0.12em", margin: "0 0 4px" }}>Bestellnummer</p>
                <p style={{ fontSize: "20px", fontWeight: 600, color: "#fff", margin: 0, fontFamily: "'Cormorant Garamond', Georgia, serif" }}>{order.orderNumber}</p>
              </div>
              <div style={{ textAlign: "right" }}>
                <p style={{ fontSize: "11px", color: "#525252", textTransform: "uppercase", letterSpacing: "0.12em", margin: "0 0 4px" }}>Datum</p>
                <p style={{ fontSize: "15px", fontWeight: 500, color: "#e2ddd6", margin: 0 }}>
                  {order.createdAt.toLocaleDateString("de-AT", { day: "2-digit", month: "2-digit", year: "numeric" })}
                </p>
              </div>
            </div>

            {/* Delivery info */}
            {order.deliveryMode === "gps" && order.deliveryLat != null && order.deliveryLng != null ? (
              <div style={{ marginBottom: "28px", paddingBottom: "28px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                <p style={{ fontSize: "11px", color: "#525252", textTransform: "uppercase", letterSpacing: "0.12em", margin: "0 0 10px" }}>Lieferstandort (GPS)</p>
                <div style={{ fontSize: "14px", lineHeight: 1.7, color: "#9a9290" }}>
                  {order.shippingFullName && <div style={{ color: "#e2ddd6", fontWeight: 500 }}>{order.shippingFullName}</div>}
                  {order.shippingPhone && <div>{order.shippingPhone}</div>}
                  <a
                    href={`https://www.google.com/maps?q=${order.deliveryLat},${order.deliveryLng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: "#D99E4F", textDecoration: "underline", fontWeight: 500 }}
                  >
                    Standort auf Karte anzeigen
                  </a>
                </div>
              </div>
            ) : addressParts.length > 0 ? (
              <div style={{ marginBottom: "28px", paddingBottom: "28px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                <p style={{ fontSize: "11px", color: "#525252", textTransform: "uppercase", letterSpacing: "0.12em", margin: "0 0 10px" }}>Lieferadresse</p>
                <div style={{ fontSize: "14px", lineHeight: 1.7, color: "#9a9290" }}>
                  {order.shippingFullName && <div style={{ color: "#e2ddd6", fontWeight: 500 }}>{order.shippingFullName}</div>}
                  {addressParts.map((part, i) => <div key={i}>{part}</div>)}
                  {order.shippingPhone && <div>{order.shippingPhone}</div>}
                </div>
              </div>
            ) : null}

            {/* Items */}
            <div style={{ marginBottom: "28px" }}>
              <p style={{ fontSize: "11px", color: "#525252", textTransform: "uppercase", letterSpacing: "0.12em", margin: "0 0 14px" }}>Bestellte Artikel</p>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                    <th style={{ textAlign: "left", fontSize: "11px", color: "#525252", fontWeight: 500, padding: "0 0 10px", letterSpacing: "0.08em" }}>Artikel</th>
                    <th style={{ textAlign: "center", fontSize: "11px", color: "#525252", fontWeight: 500, padding: "0 0 10px", letterSpacing: "0.08em" }}>Menge</th>
                    <th style={{ textAlign: "right", fontSize: "11px", color: "#525252", fontWeight: 500, padding: "0 0 10px", letterSpacing: "0.08em" }}>Einzelpreis</th>
                    <th style={{ textAlign: "right", fontSize: "11px", color: "#525252", fontWeight: 500, padding: "0 0 10px", letterSpacing: "0.08em" }}>Gesamt</th>
                  </tr>
                </thead>
                <tbody>
                  {order.items.map((item) => (
                    <tr key={item.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                      <td style={{ padding: "12px 0", fontSize: "14px", color: "#e2ddd6" }}>{item.product.name}</td>
                      <td style={{ padding: "12px 0", fontSize: "14px", color: "#9a9290", textAlign: "center" }}>{item.quantity}</td>
                      <td style={{ padding: "12px 0", fontSize: "14px", color: "#9a9290", textAlign: "right" }}>{formatCentsAsEuro(item.unitPriceCents)}</td>
                      <td style={{ padding: "12px 0", fontSize: "14px", color: "#e2ddd6", textAlign: "right", fontWeight: 500 }}>{formatCentsAsEuro(item.lineTotalCents)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Total */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: "20px", borderTop: "1px solid rgba(255,255,255,0.08)", marginBottom: "28px" }}>
              <span style={{ fontSize: "15px", fontWeight: 600, color: "#e2ddd6" }}>Gesamtbetrag</span>
              <span className="print-gold" style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: "26px", fontWeight: 600, color: "#D99E4F" }}>
                {formatCentsAsEuro(order.totalAmountCents)}
              </span>
            </div>

            {/* VAT exemption note */}
            <div style={{ paddingTop: "20px", borderTop: "1px solid rgba(255,255,255,0.06)", fontSize: "12px", color: "#525252", lineHeight: 1.7 }}>
              Gemäß § 6 Abs. 1 Z 27 UStG wird keine Umsatzsteuer berechnet.
            </div>

          </div>
        </div>
      </div>
    </>
  );
}
