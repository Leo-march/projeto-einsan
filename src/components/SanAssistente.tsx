'use client';

import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { usePathname } from 'next/navigation';
import { useStore } from '@/context/Store';
import { ChatSan } from '@/components/ChatSan';
import { SanIcone } from '@/components/SanIcone';
import { brl } from '@/utils/calculations';
import { alertasDaApi, statusLabel, urgLabel } from '@/utils/apiHelpers';
import type { AnaliseApi, EstoqueApi } from '@/types/api';
import styles from './SanAssistente.module.css';

const PERGUNTAS = {
  status: 'Qual o status geral?',
  alertas: 'Quais são os alertas?',
  compras: 'O que preciso comprar?',
  lotes: 'Algum lote vence logo?',
  estoque: 'Qual o valor em estoque?',
  fornecedores: 'Quais fornecedores estão sugeridos?',
};

const PAGINAS: Record<string, { titulo: string; intro: string; sugestoes: string[] }> = {
  '/': { titulo: 'Dashboard', intro: 'Aqui você acompanha o cofre, os alertas e as compras recomendadas.', sugestoes: [PERGUNTAS.status, PERGUNTAS.alertas, PERGUNTAS.compras] },
  '/estoque': { titulo: 'Estoque', intro: 'Posso ajudar a entender saldos, valores e lotes do cofre.', sugestoes: [PERGUNTAS.estoque, PERGUNTAS.lotes, PERGUNTAS.alertas] },
  '/medicamentos': { titulo: 'Medicamentos', intro: 'Posso ajudar com o que está no cofre e o que precisa de reposição.', sugestoes: [PERGUNTAS.estoque, PERGUNTAS.compras, PERGUNTAS.lotes] },
  '/movimentacoes': { titulo: 'Movimentações', intro: 'Posso ajudar a entender entradas, saídas e divergências.', sugestoes: ['Há divergências de estoque?', PERGUNTAS.alertas, PERGUNTAS.status] },
  '/previsao': { titulo: 'Previsão de demanda', intro: 'Posso ajudar a interpretar cobertura, consumo e urgência.', sugestoes: [PERGUNTAS.compras, PERGUNTAS.status, PERGUNTAS.lotes] },
  '/compras': { titulo: 'Recomendações de compra', intro: 'Posso ajudar a entender o que comprar, de quem e com que urgência.', sugestoes: [PERGUNTAS.compras, PERGUNTAS.fornecedores, PERGUNTAS.estoque] },
  '/fornecedores': { titulo: 'Fornecedores', intro: 'Posso ajudar a comparar os fornecedores sugeridos.', sugestoes: [PERGUNTAS.fornecedores, PERGUNTAS.compras, PERGUNTAS.status] },
  '/lotes': { titulo: 'Lotes e validades', intro: 'Posso ajudar com vencimentos e lotes invalidados.', sugestoes: [PERGUNTAS.lotes, PERGUNTAS.alertas, PERGUNTAS.estoque] },
  '/relatorios': { titulo: 'Relatórios', intro: 'Posso resumir a situação do cofre para você.', sugestoes: [PERGUNTAS.status, PERGUNTAS.compras, PERGUNTAS.estoque] },
  '/configuracoes': { titulo: 'Configurações', intro: 'Posso tirar dúvidas gerais sobre a plataforma e o cofre.', sugestoes: [PERGUNTAS.status, PERGUNTAS.alertas, PERGUNTAS.compras] },
};

const semAcento = (t: string) => t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const lista = (itens: string[]) => itens.map((i) => `• ${i}`).join('\n');

/** Respostas simuladas do San sobre a plataforma, montadas com os dados reais da análise e do estoque. */
function responderGeral(pergunta: string, analise: AnaliseApi | null, estoque: EstoqueApi | null, pagina: string): string {
  const q = semAcento(pergunta);
  if (/\b(oi|ola|bom dia|boa tarde|boa noite)\b/.test(q)) return `Olá! Estou na página de ${pagina}. Posso falar sobre status do cofre, alertas, compras, fornecedores, lotes e estoque.`;
  if (!analise) return 'Ainda estou carregando os dados do cofre. Tente de novo em alguns segundos.';

  const resumo = analise.resumo;
  const recs = analise.recomendacoes_compra.filter((r) => r.recomendar_compra !== false);

  if (/alert|critic|risco|problema/.test(q)) {
    const alertas = alertasDaApi(analise);
    if (!alertas.length) return 'Nenhum alerta ativo no momento.';
    return `Há ${alertas.length} alerta(s) ativo(s). Os mais graves:\n${lista(alertas.slice(0, 3).map((a) => `${a.grav} · ${a.med}: ${a.texto}`))}`;
  }
  if (/fornecedor/.test(q)) {
    const sugeridos = recs.filter((r) => r.fornecedor_recomendado).map((r) => `${r.nome}: ${r.fornecedor_recomendado!.nome} (${r.fornecedor_recomendado!.prazo_entrega_dias} dia(s), ${r.fornecedor_recomendado!.confiabilidade_entrega_pct}% no prazo)`);
    return sugeridos.length ? `Fornecedores sugeridos para cada compra:\n${lista(sugeridos)}` : 'Não há fornecedor sugerido agora, porque nenhuma compra está recomendada ou nenhum fornecedor está elegível.';
  }
  if (/compra|comprar|recomend|reposi|urgen/.test(q)) {
    if (!recs.length) return 'Nenhuma compra recomendada no momento.';
    return `Há ${recs.length} compra(s) recomendada(s), custo total de ${brl(resumo.custo_total_recomendado_brl)}:\n${lista(recs.map((r) => `${r.nome}: ${r.quantidade_sugerida} un. · urgência ${(urgLabel[r.urgencia] ?? r.urgencia).toLowerCase()}`))}`;
  }
  if (/venc|validade|lote/.test(q)) {
    const lotes = (estoque?.itens ?? []).flatMap((i) => i.lotes.filter((l) => l.status === 'VENCE_EM_30_DIAS').map((l) => `${i.nome}, lote ${l.codigo_lote}: vence em ${l.dias_para_vencer} dia(s)`));
    const invalidados = resumo.lotes_invalidados ? ` Também há ${resumo.lotes_invalidados} lote(s) invalidado(s) por excursão térmica.` : '';
    return lotes.length ? `Lotes que vencem em até 30 dias:\n${lista(lotes.slice(0, 5))}${invalidados}` : `Nenhum lote vence nos próximos 30 dias.${invalidados}`;
  }
  if (/termic|temperatura|invalid|frio/.test(q)) {
    return `São ${resumo.lotes_invalidados} lote(s) invalidado(s) por excursão térmica, somando ${resumo.unidades_invalidadas} unidade(s).`;
  }
  if (/diverg|retirad|porta/.test(q)) {
    return resumo.divergencias_estoque ? `Há ${resumo.divergencias_estoque} divergência(s) de estoque, que são retiradas não identificadas.` : 'Nenhuma divergência de estoque no momento.';
  }
  if (/estoque|valor|imobiliz|unidade|medicamento/.test(q)) {
    if (!estoque) return 'Os dados de estoque ainda estão carregando.';
    return `O cofre tem ${estoque.itens.length} medicamentos e ${estoque.totais.unidades} unidades, com ${brl(estoque.totais.valor_imobilizado_brl)} imobilizados. ${estoque.totais.lotes_em_alerta} lote(s) estão em alerta.`;
  }
  if (/status|situacao|geral|resumo|como esta/.test(q)) {
    return `O status geral do cofre é ${(statusLabel[resumo.status_geral] ?? resumo.status_geral).toLowerCase()}: ${resumo.total_alertas} alerta(s), ${resumo.lotes_invalidados} lote(s) invalidado(s) e ${resumo.medicamentos_com_compra_recomendada} compra(s) recomendada(s).`;
  }
  return 'Ainda estou aprendendo a responder isso. Posso falar sobre status geral, alertas, compras, fornecedores, lotes e valor em estoque.';
}

const CHAVE_POSICAO = 'san-posicao';
const MARGEM = 8;
const LIMITE_ARRASTO = 6;

type Posicao = { x: number; y: number };

/** Botão flutuante e arrastável com o pinguim San; abre um chat sobre o assunto da página atual. */
export function SanAssistente() {
  const path = usePathname();
  const { analise, estoque } = useStore();
  const [abertoEm, setAbertoEm] = useState<string | null>(null);
  const [pos, setPos] = useState<Posicao | null>(null);
  const [arrastando, setArrastando] = useState(false);
  const botao = useRef<HTMLButtonElement>(null);
  const arrasto = useRef<{ dx: number; dy: number; x0: number; y0: number; moveu: boolean } | null>(null);
  const ultima = useRef<Posicao | null>(null);
  const ignorarClique = useRef(false);

  const limitar = (x: number, y: number): Posicao => {
    const w = botao.current?.offsetWidth ?? 0;
    const h = botao.current?.offsetHeight ?? 0;
    return {
      x: Math.min(Math.max(MARGEM, x), Math.max(MARGEM, window.innerWidth - w - MARGEM)),
      y: Math.min(Math.max(MARGEM, y), Math.max(MARGEM, window.innerHeight - h - MARGEM)),
    };
  };
  const salvar = (p: Posicao) => { try { localStorage.setItem(CHAVE_POSICAO, JSON.stringify(p)); } catch {} };

  // Recupera a última posição escolhida e mantém o pinguim dentro da tela ao redimensionar.
  useEffect(() => {
    try {
      const j = JSON.parse(localStorage.getItem(CHAVE_POSICAO) || 'null') as Posicao | null;
      if (j && Number.isFinite(j.x) && Number.isFinite(j.y)) setPos(limitar(j.x, j.y));
    } catch {}
    const aoRedimensionar = () => setPos((atual) => (atual ? limitar(atual.x, atual.y) : atual));
    window.addEventListener('resize', aoRedimensionar);
    return () => window.removeEventListener('resize', aoRedimensionar);
  }, []);

  const aoPressionar = (e: PointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0) return;
    const r = e.currentTarget.getBoundingClientRect();
    arrasto.current = { dx: e.clientX - r.left, dy: e.clientY - r.top, x0: e.clientX, y0: e.clientY, moveu: false };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const aoMover = (e: PointerEvent<HTMLButtonElement>) => {
    const a = arrasto.current;
    if (!a) return;
    if (!a.moveu && Math.hypot(e.clientX - a.x0, e.clientY - a.y0) < LIMITE_ARRASTO) return;
    a.moveu = true;
    setArrastando(true);
    const nova = limitar(e.clientX - a.dx, e.clientY - a.dy);
    ultima.current = nova;
    setPos(nova);
  };
  const aoSoltar = (e: PointerEvent<HTMLButtonElement>) => {
    const a = arrasto.current;
    arrasto.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    if (!a?.moveu) return;
    setArrastando(false);
    if (ultima.current) salvar(ultima.current);
    ignorarClique.current = true; // o clique que vem logo após o arrasto não abre o chat
    setTimeout(() => { ignorarClique.current = false; }, 0);
  };
  const aoClicar = () => {
    if (ignorarClique.current) return;
    setAbertoEm(path);
  };
  // Acessibilidade: as setas movem o pinguim sem mouse.
  const aoTeclar = (e: KeyboardEvent<HTMLButtonElement>) => {
    const passo = e.shiftKey ? 80 : 24;
    const delta: Record<string, Posicao> = { ArrowLeft: { x: -passo, y: 0 }, ArrowRight: { x: passo, y: 0 }, ArrowUp: { x: 0, y: -passo }, ArrowDown: { x: 0, y: passo } };
    const d = delta[e.key];
    if (!d) return;
    e.preventDefault();
    const r = e.currentTarget.getBoundingClientRect();
    const nova = limitar((pos?.x ?? r.left) + d.x, (pos?.y ?? r.top) + d.y);
    setPos(nova);
    salvar(nova);
  };

  const chave = path === '/' ? '/' : Object.keys(PAGINAS).filter((k) => k !== '/' && path.startsWith(k)).sort((a, b) => b.length - a.length)[0] ?? '/';
  const pagina = PAGINAS[chave];
  const aberto = abertoEm === path;

  const cartoes = [
    { rotulo: 'Status geral', valor: analise ? statusLabel[analise.resumo.status_geral] ?? analise.resumo.status_geral : '…' },
    { rotulo: 'Alertas', valor: analise ? String(analise.resumo.total_alertas) : '…' },
    { rotulo: 'Compras', valor: analise ? String(analise.resumo.medicamentos_com_compra_recomendada) : '…' },
    { rotulo: 'Em estoque', valor: estoque ? brl(estoque.totais.valor_imobilizado_brl) : '…' },
  ];

  return (
    <>
      {!aberto && (
        <button
          ref={botao}
          type="button"
          className={`${styles.botao} ${arrastando ? styles.arrastando : ''} ${pos && pos.y < 90 ? styles.rotuloAbaixo : ''}`}
          style={pos ? { left: pos.x, top: pos.y, right: 'auto', bottom: 'auto' } : undefined}
          onPointerDown={aoPressionar}
          onPointerMove={aoMover}
          onPointerUp={aoSoltar}
          onPointerCancel={aoSoltar}
          onClick={aoClicar}
          onKeyDown={aoTeclar}
          aria-label="Conversar com o San. Arraste ou use as setas para mover."
        >
          <SanIcone size={116} />
          <span className={styles.rotulo}>Fale com o San<small>arraste para mover</small></span>
        </button>
      )}
      {aberto && (
        <ChatSan
          key={path}
          titulo={pagina.titulo}
          mensagemInicial={`Olá! Eu sou o San. ${pagina.intro} Como posso ajudar?`}
          resumo={cartoes}
          sugestoes={pagina.sugestoes}
          responder={(pergunta) => responderGeral(pergunta, analise, estoque, pagina.titulo)}
          onClose={() => setAbertoEm(null)}
        />
      )}
    </>
  );
}