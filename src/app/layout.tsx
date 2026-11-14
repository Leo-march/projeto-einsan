import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Medical Security x Bulário Anvisa",
  description: "Análise operacional de eventos térmicos, movimentação e recomendações de estoque.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
