'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
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
  Search,
  Snowflake,
  ThermometerSnowflake,
} from 'lucide-react';
import { useStore } from '@/context/Store';
import { Badge } from '@/components/ui';
import { alertasDaApi, statusLabel, statusTone } from '@/utils/apiHelpers';
import { SanAssistente } from '@/components/SanAssistente';
import { SanIcone } from '@/components/SanIcone';
import { Paleta, type ItemPaleta } from '@/components/layout/Paleta';
import { Neve } from '@/components/layout/Neve';

/**
 * Navegação em três níveis, no espírito dos grandes buscadores:
 *  1. a barra de busca central (atalho "/" ou Ctrl/⌘+K) vai a qualquer seção ou medicamento;
 *  2. as abas sob a barra levam às seções do dia a dia;
 *  3. o lançador (grade 3×3) mostra todas as seções com descrição.
 * As teclas 1–9 e 0 também saltam entre as seções.
 */
const NAV = [
  { href: '/', curto: 'Painel', titulo: 'Dashboard', desc: 'Situação térmica e de estoque do cofre em uma única leitura.', Icone: LayoutDashboard },
  { href: '/estoque', curto: 'Estoque', titulo: 'Estoque', desc: 'Saldos, valores e situação de cada recebimento.', Icone: Package },
  { href: '/medicamentos', curto: 'Medicamentos', titulo: 'Medicamentos', desc: 'Cadastro do cofre com cobertura, custo e urgência.', Icone: Pill },
  { href: '/movimentacoes', curto: 'Movimentações', titulo: 'Movimentações', desc: 'Livro de entradas, saídas, descartes e ajustes.', Icone: ArrowLeftRight },
  { href: '/previsao', curto: 'Previsão', titulo: 'Previsão de demanda', desc: 'Consumo histórico, projeção de saldo e ruptura estimada.', Icone: LineChart },
  { href: '/compras', curto: 'Compras', titulo: 'Recomendações de compra', desc: 'O que comprar, em que quantidade e com qual fornecedor.', Icone: ShoppingCart },
  { href: '/fornecedores', curto: 'Fornecedores', titulo: 'Fornecedores', desc: 'Catálogo de reposição e histórico de entradas por fornecedor.', Icone: Truck },
  { href: '/lotes', curto: 'Lotes', titulo: 'Lotes e validades', desc: 'Vencimentos e lotes invalidados por excursão térmica.', Icone: CalendarClock },
  { href: '/relatorios', curto: 'Relatórios', titulo: 'Relatórios', desc: 'Séries mensais, perdas e histórico de compras para exportação.', Icone: FileBarChart },
  { href: '/configuracoes', curto: 'Configurações', titulo: 'Configurações', desc: 'Data de referência e qualidade dos dados.', Icone: Settings },
] as const;

const ATALHOS_INICIO = [
  { href: '/compras', rotulo: 'Compras recomendadas', Icone: ShoppingCart },
  { href: '/lotes', rotulo: 'Lotes e validades', Icone: CalendarClock },
  { href: '/previsao', rotulo: 'Previsão de demanda', Icone: LineChart },
  { href: '/estoque', rotulo: 'Estoque', Icone: Package },
] as const;

const tecla = (i: number) => String((i + 1) % 10);

const digitando = (el: EventTarget | null) => {
  const n = el as HTMLElement | null;
  return !!n && (n.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(n.tagName));
};

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const { msg, analise, estoque } = useStore();

  const [bell, setBell] = useState(false);
  const [grade, setGrade] = useState(false);
  const [paleta, setPaleta] = useState(false);
  const [neve, setNeve] = useState(true);
  const relBell = useRef<HTMLDivElement>(null);
  const relGrade = useRef<HTMLDivElement>(null);
  const abas = useRef<HTMLElement>(null);

  const alertas = analise ? alertasDaApi(analise) : [];
  const cofre = analise?.meta.cofre_id ?? 'Cofre';
  const status = analise?.resumo.status_geral;

  const indice = NAV.findIndex((n) => (n.href === '/' ? path === '/' : path.startsWith(n.href)));
  const atual = indice >= 0 ? NAV[indice] : undefined;
  const inicio = path === '/';

  const ir = useCallback((href: string) => {
    setPaleta(false);
    setBell(false);
    setGrade(false);
    router.push(href);
  }, [router]);

  const buscar = useCallback((consulta: string) => {
    location.href = `/estoque?q=${encodeURIComponent(consulta)}`;
  }, []);

  // Lembra se a pessoa desligou a neve.
  useEffect(() => {
    try { if (localStorage.getItem('san-neve') === '0') setNeve(false); } catch {}
  }, []);
  const alternarNeve = () => {
    setNeve((v) => {
      try { localStorage.setItem('san-neve', v ? '0' : '1'); } catch {}
      return !v;
    });
  };

  // Atalhos: "/" ou Ctrl/⌘+K abrem a busca; 1–9 e 0 saltam entre as seções.
  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaleta((v) => !v);
        return;
      }
      if (e.ctrlKey || e.metaKey || e.altKey || digitando(e.target)) return;
      if (document.querySelector('[role="dialog"]')) return;
      if (e.key === '/') {
        e.preventDefault();
        setPaleta(true);
        return;
      }
      if (/^[0-9]$/.test(e.key)) {
        const alvo = NAV[(Number(e.key) + 9) % 10];
        if (alvo) router.push(alvo.href);
      }
    };
    window.addEventListener('keydown', aoTeclar);
    return () => window.removeEventListener('keydown', aoTeclar);
  }, [router]);

  // Fecha os painéis flutuantes ao clicar fora ou com Esc.
  useEffect(() => {
    if (!bell && !grade) return;
    const fora = (e: MouseEvent) => {
      if (!relBell.current?.contains(e.target as Node)) setBell(false);
      if (!relGrade.current?.contains(e.target as Node)) setGrade(false);
    };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') { setBell(false); setGrade(false); } };
    document.addEventListener('mousedown', fora);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', fora); document.removeEventListener('keydown', esc); };
  }, [bell, grade]);

  // Em telas estreitas as abas rolam: mantém a seção atual à vista.
  useEffect(() => {
    abas.current?.querySelector<HTMLElement>('a.on')?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
  }, [path]);

  const itensPaleta = useMemo<ItemPaleta[]>(() => [
    ...NAV.map((n, i) => ({ id: n.href, grupo: 'Seções', rotulo: n.titulo, detalhe: n.desc, tecla: tecla(i), acao: () => ir(n.href) })),
    ...(estoque?.itens ?? []).map((m) => ({ id: m.id_medicamento, grupo: 'Medicamentos', rotulo: m.nome, detalhe: m.id_medicamento, acao: () => buscar(m.nome) })),
  ], [estoque, ir, buscar]);

  const totalAlertas = analise?.resumo.total_alertas ?? 0;
  const compras = analise?.resumo.medicamentos_com_compra_recomendada ?? 0;
  const tituloInicio = !analise
    ? 'Carregando o cofre…'
    : totalAlertas > 0
      ? `${totalAlertas} ${totalAlertas === 1 ? 'alerta pede' : 'alertas pedem'} atenção no cofre ${cofre}`
      : status === 'NORMAL'
        ? `Tudo em ordem no cofre ${cofre}`
        : `Cofre ${cofre}: ${(statusLabel[status ?? ''] ?? '').toLowerCase()}`;
  const dataRef = analise
    ? new Date(analise.meta.data_referencia).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })
    : '';

  return (
    <div className="shell">
      <header className="top">
        <Link href="/" className="brand" aria-label="San, início">
          <SanIcone size={44} />
          <span className="brand-t">
            <b>San</b>
            <small>estoque refrigerado</small>
          </span>
        </Link>

        <button className="omni" onClick={() => setPaleta(true)} aria-label="Buscar medicamento ou ir para uma seção">
          <Search size={20} />
          <span>Buscar medicamento ou ir para uma seção</span>
          <kbd className="hint">/</kbd>
        </button>

        <div className="top-right">
          {status && (
            <span className={`status-led ${statusTone(status)}`} role="status">
              <i />
              {statusLabel[status] ?? status}
            </span>
          )}

          <button
            className="icon-btn"
            aria-label="Neve"
            aria-pressed={neve}
            title={neve ? 'Desligar a neve' : 'Ligar a neve'}
            onClick={alternarNeve}
          >
            <Snowflake size={21} />
          </button>

          <div className="rel" ref={relBell}>
            <button
              className="icon-btn"
              aria-label={`Alertas${alertas.length ? `: ${alertas.length} ativos` : ''}`}
              aria-expanded={bell}
              onClick={() => { setBell(!bell); setGrade(false); }}
            >
              <Bell size={22} />
              {alertas.length > 0 && <i className="dot">{alertas.length}</i>}
            </button>

            {bell && (
              <div className="pop" role="region" aria-label="Alertas ativos">
                {alertas.slice(0, 5).map((a, i) => (
                  <div key={i}>
                    <Badge tone={a.tone}>{a.grav}</Badge>
                    <b>{a.med}</b>
                    <p>{a.texto}</p>
                  </div>
                ))}
                {!alertas.length && <div><p>Nenhum alerta ativo.</p></div>}
                <Link href="/" onClick={() => setBell(false)}>
                  Ver todos no dashboard
                </Link>
              </div>
            )}
          </div>

          <div className="rel" ref={relGrade}>
            <button
              className="icon-btn"
              aria-label="Todas as seções"
              aria-expanded={grade}
              onClick={() => { setGrade(!grade); setBell(false); }}
            >
              <span className="waffle" aria-hidden="true">
                {Array.from({ length: 9 }, (_, k) => <i key={k} />)}
              </span>
            </button>

            {grade && (
              <nav className="launcher" aria-label="Todas as seções">
                <div className="launcher-g">
                  {NAV.map((n) => (
                    <Link
                      key={n.href}
                      href={n.href}
                      className={n.href === atual?.href ? 'on' : ''}
                      onClick={() => setGrade(false)}
                    >
                      <span className="ic"><n.Icone size={22} /></span>
                      {n.titulo}
                    </Link>
                  ))}
                </div>
              </nav>
            )}
          </div>

          <div className="avatar" title={`${cofre}${dataRef ? ` · ref. ${dataRef}` : ''}`}>CI</div>
        </div>
      </header>

      <nav className="tabs" aria-label="Seções" ref={abas}>
        {NAV.map((n, i) => (
          <Link
            key={n.href}
            href={n.href}
            className={i === indice ? 'on' : ''}
            aria-current={i === indice ? 'page' : undefined}
            title={`${n.titulo} · tecla ${tecla(i)}`}
          >
            {n.curto}
          </Link>
        ))}
      </nav>

      <main className="page">
        {inicio ? (
          <section className="hero" aria-label="Resumo do cofre">
            <div className="hero-ice"><SanIcone size={132} /></div>
            <h1>{tituloInicio}</h1>
            {analise && (
              <p>
                Referência {dataRef} · {compras} {compras === 1 ? 'compra recomendada' : 'compras recomendadas'}
              </p>
            )}
            <span className="faixa"><ThermometerSnowflake size={16} />Conservação refrigerada · 2–8 °C</span>
            <button className="hero-search" onClick={() => setPaleta(true)} aria-label="Buscar medicamento ou ir para uma seção">
              <Search size={20} />
              <span>Busque um medicamento ou vá para uma seção</span>
              <kbd>/</kbd>
            </button>
            <div className="chips">
              {ATALHOS_INICIO.map(({ href, rotulo, Icone }) => (
                <Link key={href} href={href}><Icone size={16} />{rotulo}</Link>
              ))}
            </div>
          </section>
        ) : (
          <div className="pagehead">
            <h1>{atual?.titulo ?? 'San'}</h1>
            {atual && <p>{atual.desc}</p>}
          </div>
        )}
        {children}
      </main>

      <Neve ativa={neve} />

      <SanAssistente />

      {paleta && <Paleta itens={itensPaleta} onBuscar={buscar} onFechar={() => setPaleta(false)} />}

      {msg && <div className="toast" role="status">{msg}</div>}
    </div>
  );
}