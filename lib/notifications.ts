import { getResend } from "./resend";
import { appConfig } from "./app-config";
import {
  buildBigDayAlertEmail,
  buildReleaseNotificationEmail,
} from "./email/restaurant-notification";
import { buildDayBeforeReminderEmail } from "./email/day-before-reminder";
import { buildComplaintNotificationEmail } from "./email/complaint-notification";
import { buildComplaintConfirmationEmail } from "./email/complaint-confirmation";

const FROM = process.env.RESEND_FROM ?? "onboarding@resend.dev";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

// Notify restaurant when a scheduled order is released into the active queue
export async function notifyRestaurantOrderReleased(order: {
  id: string;
  orderNumber: string;
  scheduledFor: Date;
  totalAmountCents: number;
  shippingFullName: string | null;
  shippingPhone: string | null;
  shippingAddressLine1: string | null;
  shippingCity: string | null;
  deliveryMode: string | null;
  deliveryLat: number | null;
  deliveryLng: number | null;
  items: Array<{ quantity: number; product: { name: string } }>;
}): Promise<void> {
  const email = await appConfig.restaurantNotificationEmail();
  if (!email) return;

  try {
    const { subject, html } = buildReleaseNotificationEmail(
      order,
      `${APP_URL}/admin/restaurant`,
    );
    await getResend().emails.send({ from: FROM, to: email, subject, html });
  } catch (err) {
    console.error("[notifications] Failed to send release notification:", err);
  }
}

// Send big-day alert email (called by day-before-reminders cron)
export async function notifyRestaurantBigDay(alert: {
  date: Date;
  orderCount: number;
  orders: Array<{
    orderNumber: string;
    scheduledFor: Date;
    totalAmountCents: number;
    items: Array<{ quantity: number; product: { name: string } }>;
  }>;
}): Promise<void> {
  const email = await appConfig.restaurantNotificationEmail();
  if (!email) return;

  try {
    const { subject, html } = buildBigDayAlertEmail({
      ...alert,
      adminUrl: `${APP_URL}/admin/restaurant`,
    });
    await getResend().emails.send({ from: FROM, to: email, subject, html });
  } catch (err) {
    console.error("[notifications] Failed to send big-day alert:", err);
  }
}

// Send escalation reminder for unacknowledged big days (20:00 cron)
export async function notifyRestaurantBigDayEscalation(alert: {
  date: Date;
  orderCount: number;
  totalItems: number;
  orders: Array<{
    orderNumber: string;
    scheduledFor: Date;
    totalAmountCents: number;
    items: Array<{ quantity: number; product: { name: string } }>;
  }>;
}): Promise<void> {
  const email = await appConfig.restaurantNotificationEmail();
  if (!email) return;

  try {
    const { subject, html } = buildDayBeforeReminderEmail({
      ...alert,
      adminUrl: `${APP_URL}/admin/restaurant`,
      isEscalation: true,
    });
    await getResend().emails.send({ from: FROM, to: email, subject, html });
  } catch (err) {
    console.error("[notifications] Failed to send escalation:", err);
  }
}

type ComplaintPayload = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  category: string;
  subject: string;
  message: string;
  orderNumber: string | null;
  createdAt: Date;
};

// Notify restaurant when a complaint is submitted
export async function notifyRestaurantComplaint(
  complaint: ComplaintPayload,
): Promise<void> {
  const email = await appConfig.restaurantNotificationEmail();
  if (!email) return;

  try {
    const { subject, html } = buildComplaintNotificationEmail(complaint, `${APP_URL}/admin`);
    await getResend().emails.send({ from: FROM, to: email, subject, html });
  } catch (err) {
    console.error("[notifications] Failed to send complaint notification:", err);
  }
}

// Send acknowledgement email to the customer who submitted the complaint
export async function notifyCustomerComplaintReceived(
  complaint: ComplaintPayload,
): Promise<void> {
  try {
    const { subject, html } = buildComplaintConfirmationEmail(complaint);
    await getResend().emails.send({ from: FROM, to: complaint.email, subject, html });
  } catch (err) {
    console.error("[notifications] Failed to send complaint confirmation:", err);
  }
}
