import type { Metadata } from 'next';
import { IBM_Plex_Sans } from 'next/font/google';
import './globals.css';
import { StoreProvider } from '@/context/Store';
import DashboardLayout from '@/components/layout/DashboardLayout';

const font = IBM_Plex_Sans({ subsets: ['latin'], weight: ['400', '500', '600', '700'] });
export const metadata: Metadata = { title: 'Einsan | Inteligência de estoque refrigerado', description: 'Plataforma de previsão de demanda e compras de medicamentos de alto custo.' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR"><body className={font.className}><StoreProvider><DashboardLayout>{children}</DashboardLayout></StoreProvider></body></html>
  );
}
