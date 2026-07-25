import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Team Maistro OS | Control operativo de obra",
  description:
    "Planeación de tareas, inventario, compras y recursos para proyectos de remodelación.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
