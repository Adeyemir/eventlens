import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "EventLens — See the whole trade",
  description:
    "Explore how a perpetual position and a prediction contract behave together across BTC price scenarios.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
