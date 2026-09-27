import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Site VIP — One login. One clear number.",
  description: "Know what came in, what went out, and what is left.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
