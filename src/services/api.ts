import type { AnaliseApi } from '@/types/api';

export async function buscarAnalise(dataReferencia?: string): Promise<AnaliseApi> {
  const qs = dataReferencia ? `?data_referencia=${encodeURIComponent(dataReferencia)}` : '';
  const res = await fetch(`/api/analise${qs}`, { cache: 'no-store' });
  if (!res.ok) {
    let msg = `Erro ${res.status}`;
    try { msg = (await res.json()).erro ?? msg; } catch {}
    throw new Error(msg);
  }
  return (await res.json()) as AnaliseApi;
}
