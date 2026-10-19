import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Benevolent Fund Platform",
  description: "Blockchain-Based Transparent Benevolent Fund Management System with Real-Time Donor Impact Visibility",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
