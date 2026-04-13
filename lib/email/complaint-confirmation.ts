const CATEGORY_LABELS: Record<string, string> = {
  LATE_DELIVERY: "Late Delivery",
  WRONG_ORDER: "Wrong Order",
  QUALITY: "Quality Issue",
  OTHER: "Other",
};

type ComplaintConfirmation = {
  name: string;
  category: string;
  subject: string;
  orderNumber: string | null;
};

export function buildComplaintConfirmationEmail(
  complaint: ComplaintConfirmation,
): { subject: string; html: string } {
  const categoryLabel = CATEGORY_LABELS[complaint.category] ?? complaint.category;
  const subject = `We received your complaint — ${complaint.subject}`;

  const orderRow = complaint.orderNumber
    ? `<tr>
        <td style="padding:10px 14px;border-bottom:1px solid #eee;font-size:12px;color:#888;text-transform:uppercase;letter-spacing:0.1em;width:140px;">Order</td>
        <td style="padding:10px 14px;border-bottom:1px solid #eee;font-size:14px;font-weight:600;">${complaint.orderNumber}</td>
       </tr>`
    : "";

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="margin:0;padding:0;background:#f4f1ee;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;color:#1a1a1a;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f1ee;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

          <!-- Header -->
          <tr>
            <td style="background:#0c0c0c;border-radius:16px 16px 0 0;padding:32px 36px;">
              <div style="font-size:28px;font-weight:700;color:#D99E4F;letter-spacing:0.04em;font-style:italic;">Biteva</div>
              <div style="font-size:11px;color:#525252;letter-spacing:0.2em;text-transform:uppercase;margin-top:4px;">Fine Dining</div>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="background:#ffffff;padding:36px;">

              <h1 style="font-size:22px;font-weight:700;margin:0 0 4px;">We received your complaint</h1>
              <p style="font-size:14px;color:#666;margin:0 0 24px;">Thank you for reaching out, ${complaint.name}. We take all feedback seriously and will get back to you as soon as possible.</p>

              <h2 style="font-size:16px;margin:0 0 12px;">Your submission</h2>
              <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e8e8e8;border-radius:10px;overflow:hidden;margin-bottom:28px;">
                <tbody>
                  <tr>
                    <td style="padding:10px 14px;border-bottom:1px solid #eee;font-size:12px;color:#888;text-transform:uppercase;letter-spacing:0.1em;width:140px;">Category</td>
                    <td style="padding:10px 14px;border-bottom:1px solid #eee;font-size:14px;">${categoryLabel}</td>
                  </tr>
                  <tr>
                    <td style="padding:10px 14px;${complaint.orderNumber ? "border-bottom:1px solid #eee;" : ""}font-size:12px;color:#888;text-transform:uppercase;letter-spacing:0.1em;">Subject</td>
                    <td style="padding:10px 14px;${complaint.orderNumber ? "border-bottom:1px solid #eee;" : ""}font-size:14px;font-weight:600;">${complaint.subject}</td>
                  </tr>
                  ${orderRow}
                </tbody>
              </table>

              <div style="background:#f9f9f9;border-radius:10px;padding:20px;margin-bottom:28px;font-size:14px;color:#555;line-height:1.6;">
                Our team will review your complaint and respond to your email address within 1–2 business days.
              </div>

              <div style="border-top:1px solid #eee;padding-top:20px;font-size:12px;color:#999;line-height:1.6;">
                If you have an urgent matter, you can also reach us at <a href="mailto:hello@biteva.at" style="color:#D99E4F;">hello@biteva.at</a>.
              </div>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f4f1ee;border-radius:0 0 16px 16px;padding:20px 36px;text-align:center;font-size:12px;color:#aaa;">
              Biteva Fine Dining · Wien, Österreich
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject, html };
}
