import type { Metadata } from "next";
import "./globals.css";
import { PostHogProvider } from "./providers/PostHogProvider";

export const metadata: Metadata = {
  title: "Biteva",
  description: "Biteva storefront",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <PostHogProvider>{children}</PostHogProvider>
      </body>
    </html>
  );
}
