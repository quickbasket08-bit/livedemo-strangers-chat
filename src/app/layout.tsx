import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Strangers — talk to someone new",
  description: "Anonymous username-only text & video chat with a random stranger.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col">{children}</body>
    </html>
  );
}
