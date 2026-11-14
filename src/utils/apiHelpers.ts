import type { AnaliseApi, UrgenciaApi } from '@/types/api';
import type { Tone } from '@/types';
export type Alerta = { med: string; texto: string; grav: 'Crítica' | 'Alta' | 'Média'; tone: Tone };

export const urgTone = (u: UrgenciaApi): Tone => ({ CRITICA: 'crit', ALTA: 'warn', MEDIA: 'warn', BAIXA: 'mute' } as Record<string, Tone>)[u] ?? 'mute';
export const urgLabel: Record<string, string> = { CRITICA: 'Crítica', ALTA: 'Alta', MEDIA: 'Média', BAIXA: 'Baixa' };
export const ACAO: Record<string, string> = { COMPRAR_IMEDIATAMENTE: 'Comprar imediatamente', COMPRAR_NO_CICLO_ATUAL: 'Comprar no ciclo atual', PLANEJAR_REPOSICAO: 'Planejar reposição', MONITORAR: 'Monitorar' };
export const statusTone = (s: string): Tone => (s === 'CRITICO' ? 'crit' : s === 'ATENCAO' ? 'warn' : 'ok');
export const statusLabel: Record<string, string> = { CRITICO: 'Crítico', ATENCAO: 'Atenção', NORMAL: 'Normal' };
export const dataHoraBR = (iso: string) => new Date(iso).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' });
const grav = (s: string): Alerta['grav'] => (s === 'CRITICA' ? 'Crítica' : s === 'ALTA' ? 'Alta' : 'Média');
const tone = (s: string): Tone => (s === 'CRITICA' ? 'crit' : s === 'ALTA' ? 'warn' : 'info');

export function alertasDaApi(a: AnaliseApi): Alerta[] {
  const t = a.alertas.risco_termico.map((x) => ({ med: x.nome, texto: x.mensagem, grav: grav(x.severidade), tone: tone(x.severidade) }));
  const m = a.alertas.movimentacao_nao_identificada.map((x) => ({ med: 'Retirada não identificada', texto: x.mensagem, grav: grav(x.severidade), tone: tone(x.severidade) }));
  const ord = { Crítica: 0, Alta: 1, Média: 2 };
  return [...t, ...m].sort((x, y) => ord[x.grav] - ord[y.grav]);
}

import type { StatusLoteApi, TipoMovApi } from '@/types/api';
export const loteTone: Record<StatusLoteApi, Tone> = { OK: 'ok', VENCE_EM_30_DIAS: 'warn', VENCIDO: 'crit', INVALIDADO_TERMICO: 'crit' };
export const loteLabel: Record<StatusLoteApi, string> = { OK: 'No prazo', VENCE_EM_30_DIAS: 'Vence em até 30 dias', VENCIDO: 'Vencido', INVALIDADO_TERMICO: 'Invalidado (térmico)' };
export const tipoMovLabel: Record<TipoMovApi, string> = { ENTRADA_COMPRA: 'Entrada (compra)', ENTRADA_TRANSFERENCIA: 'Entrada (transferência)', SAIDA_DISPENSACAO: 'Dispensação', SAIDA_TRANSFERENCIA: 'Saída (transferência)', SAIDA_DESCARTE: 'Descarte', AJUSTE_INVENTARIO: 'Ajuste de inventário' };
export const tipoMovTone: Record<TipoMovApi, Tone> = { ENTRADA_COMPRA: 'ok', ENTRADA_TRANSFERENCIA: 'ok', SAIDA_DISPENSACAO: 'info', SAIDA_TRANSFERENCIA: 'mute', SAIDA_DESCARTE: 'crit', AJUSTE_INVENTARIO: 'warn' };
/** Sinal exibido: entradas somam, saídas subtraem, ajuste mantém o sinal enviado. */
export const qtdComSinal = (tipo: TipoMovApi, q: number) => (tipo.startsWith('ENTRADA') ? `+${q}` : tipo.startsWith('SAIDA') ? `-${q}` : q > 0 ? `+${q}` : String(q));
export const dataApiBR = (iso: string) => new Date(iso.length > 10 ? iso : `${iso}T12:00:00-03:00`).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
