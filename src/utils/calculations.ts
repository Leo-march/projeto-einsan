import type { Med, Lote, Forn, Rec, Tone, Prev } from '@/types';
import { tendencia, fornecedores, previsoes } from '@/data/mockData';

export const HOJE = new Date('2026-11-14T12:00:00');
export const iso = (d: Date) => d.toISOString().slice(0, 10);
export const addDias = (n: number) => new Date(HOJE.getTime() + n * 864e5);
export const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
export const dataBR = (s: string) => new Date(s.length > 10 ? s : s + 'T12:00:00').toLocaleDateString('pt-BR');
export const diasPara = (s: string) => Math.round((new Date(s + 'T12:00:00').getTime() - HOJE.getTime()) / 864e5);

export type Sit = 'Normal' | 'Baixo' | 'Crítico';
export const situacao = (m: Med): Sit => (m.estoque <= m.seg ? 'Crítico' : m.estoque <= m.min ? 'Baixo' : 'Normal');
export const sitTone = (s: string): Tone => ({ Normal: 'ok', Baixo: 'warn', Crítico: 'crit', Vencido: 'crit', Próximo: 'warn' } as Record<string, Tone>)[s] ?? 'mute';
export const cobertura = (m: Med) => (m.consumo ? m.estoque / m.consumo : 999);
export const sitLote = (val: string) => { const d = diasPara(val); return d < 0 ? 'Vencido' : d <= 30 ? 'Crítico' : d <= 60 ? 'Próximo' : 'Normal'; };
export const proxVal = (medId: string, ls: Lote[]) => ls.filter((l) => l.medId === medId).map((l) => l.val).sort()[0];

/** Fallback quando um medicamento cadastrado no frontend não possui previsão gerada pelo pandas. */
export const previsaoDe = (m: Med): Prev[] =>
  previsoes[m.id] ?? Array.from({ length: 30 }, (_, i) => ({ d: addDias(i + 1).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }), real: null, prev: m.consumo, estoque: Math.max(0, Math.round(m.estoque - m.consumo * (i + 1))), seg: m.seg }));

/** Recomendação demonstrativa (regra simples de ponto de pedido), não um modelo de IA treinado. */
export function recomendar(m: Med, forn: Forn[] = fornecedores): Rec | null {
  const t = tendencia[m.id] ?? 0, f = 1 + t / 200;
  const diasRuptura = Math.max(0, (m.estoque - m.seg) / (m.consumo || 1));
  const folga = diasRuptura - m.prazo;
  if (folga > 14) return null;
  const qtd = Math.ceil(m.consumo * f * (m.prazo + 30) + m.seg - m.estoque);
  if (qtd <= 0) return null;
  const urgente = folga <= 0;
  const ops = forn.map((x) => ({ x, i: x.itens.find((i) => i.medId === m.id) })).filter((o) => o.i && o.i.disp !== 'Baixa');
  ops.sort((a, b) => (urgente ? a.i!.prazo - b.i!.prazo : a.i!.preco - b.i!.preco));
  const best = ops[0];
  const fornId = best?.x.id ?? forn[0]?.id ?? '';
  return {
    medId: m.id, urgente, qtd, diasRuptura: Math.round(diasRuptura), prev30: Math.round(m.consumo * 30 * f), fornId,
    dataCompra: iso(addDias(Math.max(0, Math.floor(folga)))),
    justificativa: `Com consumo médio de ${m.consumo}/dia (tendência ${t >= 0 ? '+' : ''}${t}%), o estoque acima da reserva de segurança dura cerca de ${Math.round(diasRuptura)} dias, e o prazo de reposição é de ${m.prazo}. ${urgente ? 'O pedido deve ser feito agora, priorizando o menor prazo de entrega.' : 'Há folga para priorizar o menor preço.'}`,
  };
}

export type Alerta = { med: string; texto: string; grav: 'Crítica' | 'Alta' | 'Média'; tone: Tone };
export function gerarAlertas(meds: Med[], ls: Lote[], ajustes: { medId: string; qtd: number }[]): Alerta[] {
  const out: Alerta[] = [];
  meds.forEach((m) => {
    if (situacao(m) === 'Crítico') out.push({ med: m.nome, texto: `Estoque crítico: ${m.estoque} ${m.un}(s), abaixo da reserva de segurança (${m.seg}).`, grav: 'Crítica', tone: 'crit' });
    else if (recomendar(m)) out.push({ med: m.nome, texto: `Necessidade de reposição: cobertura de ${Math.round(cobertura(m))} dias para prazo de ${m.prazo}.`, grav: 'Média', tone: 'warn' });
    if ((tendencia[m.id] ?? 0) >= 10) out.push({ med: m.nome, texto: `Consumo ${tendencia[m.id]}% acima do período anterior.`, grav: 'Alta', tone: 'warn' });
  });
  ls.filter((l) => diasPara(l.val) <= 30).forEach((l) => {
    const m = meds.find((x) => x.id === l.medId); if (!m) return;
    const d = diasPara(l.val);
    out.push({ med: m.nome, texto: d < 0 ? `Lote ${l.lote} vencido há ${-d} dias (${l.qtd} un.).` : `Lote ${l.lote} vence em ${d} dias (${l.qtd} un.).`, grav: d < 0 ? 'Crítica' : 'Alta', tone: d < 0 ? 'crit' : 'warn' });
  });
  const aj = ajustes[0]; const m = aj && meds.find((x) => x.id === aj.medId);
  if (m) out.push({ med: m.nome, texto: `Possível inconsistência: ajuste manual de ${aj.qtd} un. sem justificativa registrada.`, grav: 'Média', tone: 'info' });
  const ord = { Crítica: 0, Alta: 1, Média: 2 };
  return out.sort((a, b) => ord[a.grav] - ord[b.grav]);
}
