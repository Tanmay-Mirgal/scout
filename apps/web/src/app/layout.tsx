import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SCOUT",
  description:
    "Open-Source Multi-Agent Research & Intelligence Platform — Ask. Investigate. Verify. Understand.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
