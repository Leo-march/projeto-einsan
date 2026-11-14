import type { AnaliseApi, UrgenciaApi } from '@/types/api';
import type { Tone } from '@/types';
import type { Alerta } from '@/utils/calculations';

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
