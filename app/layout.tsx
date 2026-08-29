import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BENCH Physical Computing Agent",
  description: "A multi-agent AI workbench for beginner physical-computing builds."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
