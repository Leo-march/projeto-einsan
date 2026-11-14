import type { AnaliseApi, EstoqueApi, FiltrosMov, MovimentacaoApi, NovaMovimentacao } from '@/types/api';

/** Erro da API com status HTTP e a lista `detalhes[]` (400 de validação). */
export class ApiError extends Error {
  constructor(msg: string, public status: number, public detalhes: string[] = []) { super(msg); }
}

async function ler<T>(res: Response): Promise<T> {
  let payload: unknown = null;
  try { payload = await res.json(); } catch {}
  if (!res.ok) {
    const p = (payload ?? {}) as { erro?: string; detalhes?: unknown };
    throw new ApiError(p.erro ?? `Erro ${res.status}`, res.status, Array.isArray(p.detalhes) ? p.detalhes.map(String) : []);
  }
  return payload as T;
}

const refQs = (dataReferencia?: string) => (dataReferencia ? `?data_referencia=${encodeURIComponent(dataReferencia)}` : '');

export async function buscarAnalise(dataReferencia?: string): Promise<AnaliseApi> {
  return ler(await fetch(`/api/analise${refQs(dataReferencia)}`, { cache: 'no-store' }));
}

export async function buscarEstoque(dataReferencia?: string): Promise<EstoqueApi> {
  return ler(await fetch(`/api/estoque${refQs(dataReferencia)}`, { cache: 'no-store' }));
}

export async function buscarMovimentacoes(f: FiltrosMov = {}): Promise<{ total: number; movimentacoes: MovimentacaoApi[] }> {
  const q = new URLSearchParams();
  if (f.id_medicamento) q.set('id_medicamento', f.id_medicamento);
  if (f.codigo_lote) q.set('codigo_lote', f.codigo_lote);
  if (f.tipo) q.set('tipo', f.tipo);
  if (f.limite) q.set('limite', String(f.limite));
  const qs = q.toString();
  return ler(await fetch(`/api/movimentacoes${qs ? `?${qs}` : ''}`, { cache: 'no-store' }));
}

/** Sem retry automático: o POST não é idempotente. */
export async function registrarMovimentacao(body: NovaMovimentacao) {
  const res = await fetch('/api/movimentacoes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  return ler<{ movimentacao: MovimentacaoApi; recomendacao_atualizada: AnaliseApi['recomendacoes_compra'][number] | null; resumo: AnaliseApi['resumo'] }>(res);
}
