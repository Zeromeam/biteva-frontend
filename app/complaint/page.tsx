import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { ComplaintForm } from "@/components/complaint-form";

type PageProps = {
  searchParams: Promise<{ orderNumber?: string }>;
};

export default async function ComplaintPage({ searchParams }: PageProps) {
  const { orderNumber } = await searchParams;

  let initialName = "";
  let initialEmail = "";

  // Pre-fill name & email if a valid order number was provided
  if (orderNumber) {
    const order = await prisma.order.findUnique({
      where: { orderNumber },
      select: { shippingFullName: true, shippingEmail: true },
    });
    if (order) {
      initialName = order.shippingFullName ?? "";
      initialEmail = order.shippingEmail ?? "";
    }
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,600;1,600&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600&display=swap');
        *, *::before, *::after { box-sizing: border-box; }
        body { margin: 0; padding: 0; background: #080808; }
      `}</style>

      <div style={{ minHeight: "100vh", background: "#080808", color: "#e2ddd6", fontFamily: "'DM Sans', system-ui, sans-serif", padding: "48px 24px 80px" }}>
        <div style={{ maxWidth: "600px", margin: "0 auto" }}>

          {/* Header */}
          <div style={{ marginBottom: "36px" }}>
            <Link href="/" style={{ textDecoration: "none" }}>
              <p style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: "30px", fontWeight: 600, fontStyle: "italic", color: "#D99E4F", margin: "0 0 4px" }}>Biteva</p>
            </Link>
            <p style={{ fontSize: "11px", letterSpacing: "0.2em", textTransform: "uppercase", color: "#525252", margin: "0 0 24px" }}>Submit a Complaint</p>
            <h1 style={{ fontSize: "22px", fontWeight: 600, color: "#e2ddd6", margin: "0 0 8px" }}>
              {orderNumber ? `Complaint for order ${orderNumber}` : "Submit a Complaint"}
            </h1>
            <p style={{ fontSize: "14px", color: "#9a9290", margin: 0 }}>
              We&apos;re sorry to hear something went wrong. Please describe the issue and we&apos;ll get back to you within 1–2 business days.
            </p>
          </div>

          {/* Card */}
          <div style={{ borderRadius: "22px", border: "1px solid rgba(255,255,255,0.08)", background: "#0c0c0c", padding: "32px" }}>
            <ComplaintForm
              initialOrderNumber={orderNumber}
              initialName={initialName}
              initialEmail={initialEmail}
            />
          </div>

          {/* Back link */}
          {orderNumber && (
            <div style={{ marginTop: "24px", textAlign: "center" }}>
              <Link href={`/orders/${orderNumber}`} style={{ fontSize: "13px", color: "#525252", textDecoration: "underline" }}>
                Back to receipt
              </Link>
            </div>
          )}

        </div>
      </div>
    </>
  );
}
