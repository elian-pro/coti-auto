import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Coti Auto · Zebra Dashboard",
  description: "Dashboard para generar cotizaciones automáticas a partir de juntas de Drive.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
