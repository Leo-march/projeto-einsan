import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Einsan | Inteligência de estoque",
  description: "Protótipo demonstrativo de previsão e reposição de estoque.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
