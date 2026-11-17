import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Geografía de la dependencia",
  description:
    "Mapa interactivo de México sobre el peso del capital extranjero, el reparto del valor y las condiciones de trabajo, con datos públicos.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es-MX">
      <body>{children}</body>
    </html>
  );
}
