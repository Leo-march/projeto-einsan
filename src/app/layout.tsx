import type { Metadata } from 'next';
import { Figtree } from 'next/font/google';
import './globals.css';
import { StoreProvider } from '@/context/Store';
import DashboardLayout from '@/components/layout/DashboardLayout';

const ui = Figtree({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--font-ui', display: 'swap' });

export const metadata: Metadata = { title: 'San | Inteligência de estoque refrigerado', description: 'Plataforma de previsão de demanda e compras de medicamentos de alto custo.' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={ui.variable}>
      <body><StoreProvider><DashboardLayout>{children}</DashboardLayout></StoreProvider></body>
    </html>
  );
}