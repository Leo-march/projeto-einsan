'use client';

import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Package,
  Pill,
  ArrowLeftRight,
  LineChart,
  ShoppingCart,
  Truck,
  CalendarClock,
  FileBarChart,
  Settings,
  Bell,
  Menu,
} from 'lucide-react';
import { useStore } from '@/context/Store';
import { Badge, SearchBox } from '@/components/ui';
import { alertasDaApi } from '@/utils/apiHelpers';
import { SanAssistente } from '@/components/SanAssistente';
import { CofreIcone } from '@/components/CofreIcone';

const NAV = [
  ['/', 'Dashboard', LayoutDashboard],
  ['/estoque', 'Estoque', Package],
  ['/medicamentos', 'Medicamentos', Pill],
  ['/movimentacoes', 'Movimentações', ArrowLeftRight],
  ['/previsao', 'Previsão de demanda', LineChart],
  ['/compras', 'Recomendações de compra', ShoppingCart],
  ['/fornecedores', 'Fornecedores', Truck],
  ['/lotes', 'Lotes e validades', CalendarClock],
  ['/relatorios', 'Relatórios', FileBarChart],
  ['/configuracoes', 'Configurações', Settings],
] as const;

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const path = usePathname();
  const { msg, analise } = useStore();

  const [open, setOpen] = useState(false);
  const [compacto, setCompacto] = useState(false);
  const [bell, setBell] = useState(false);
  const [q, setQ] = useState('');

  const alertas = analise ? alertasDaApi(analise) : [];
  const cofre = analise?.meta.cofre_id ?? 'Cofre';

  const atual = NAV.find(([h]) =>
    h === '/' ? path === '/' : path.startsWith(h)
  );

  return (
    <div className={`shell ${compacto ? 'compact' : ''}`}>
      <aside className={`side ${open ? 'open' : ''}`} id="sidebar-navigation">
        <div className="brand">
          <CofreIcone size={30} />
          <b>SAN</b>
          <small>Inteligência de estoque</small>
        </div>

        <nav>
          {NAV.map(([h, l, I]) => (
            <Link
              key={h}
              href={h}
              onClick={() => setOpen(false)}
              className={atual?.[0] === h ? 'on' : ''}
              title={compacto ? l : undefined}
              aria-label={compacto ? l : undefined}
            >
              <I size={18} />
              <span>{l}</span>
            </Link>
          ))}
        </nav>

        <div className="user">
          <div className="avatar">CI</div>
          <div>
            <b>{cofre}</b>
            <span>Cofre inteligente</span>
          </div>
        </div>
      </aside>

      {open && <div className="scrim" onClick={() => setOpen(false)} />}

      <div className="main">
        <header className="top">
          <button
            className="icon-btn menu"
            aria-label="Alternar menu"
            onClick={() =>
              window.matchMedia('(max-width: 960px)').matches
                ? setOpen(true)
                : setCompacto((c) => !c)
            }
          >
            <Menu size={20} />
          </button>

          <h1>{atual?.[1] ?? 'San'}</h1>

          <form
            className="grow"
            onSubmit={(e) => {
              e.preventDefault();
              location.href = `/estoque?q=${encodeURIComponent(q)}`;
            }}
          >
            <SearchBox
              value={q}
              onChange={setQ}
              placeholder="Buscar medicamento no estoque"
            />
          </form>

          <div className="rel">
            <button
              className="icon-btn"
              aria-label="Notificações"
              onClick={() => setBell(!bell)}
            >
              <Bell size={20} />
              {alertas.length > 0 && <i className="dot">{alertas.length}</i>}
            </button>

            {bell && (
              <div className="pop">
                {alertas.slice(0, 5).map((a, i) => (
                  <div key={i}>
                    <Badge tone={a.tone}>{a.grav}</Badge>
                    <b>{a.med}</b>
                    <p>{a.texto}</p>
                  </div>
                ))}
                <Link href="/" onClick={() => setBell(false)}>
                  Ver todos no dashboard
                </Link>
              </div>
            )}
          </div>

          <div className="who">
            <div className="avatar">CI</div>
            <div>
              <b>{cofre}</b>
              <span>
                {analise
                  ? `Ref. ${new Date(analise.meta.data_referencia).toLocaleDateString(
                      'pt-BR',
                      { timeZone: 'America/Sao_Paulo' }
                    )}`
                  : 'Carregando…'}
              </span>
            </div>
          </div>
        </header>

        <main className="page">{children}</main>
      </div>

      <SanAssistente />

      {msg && <div className="toast" role="status">{msg}</div>}
    </div>
  );
}