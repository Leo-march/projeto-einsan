import type { AnaliseApi, EstoqueApi, MovimentacaoApi } from '@/types/api';

// Tudo aqui é calculado a partir do que a API devolve (estoque, análise e livro de movimentações). Nada é fictício.
const TZ = 'America/Sao_Paulo';
export const diaSP = (iso: string) => new Date(iso).toLocaleDateString('sv-SE', { timeZone: TZ }); // YYYY-MM-DD
const ehEntrada = (t: string) => t.startsWith('ENTRADA');
const ehSaida = (t: string) => t.startsWith('SAIDA');
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const rotuloMes = (chave: string) => { const [a, m] = chave.split('-'); return `${MESES[+m - 1]}/${a.slice(2)}`; };

/** Custo unitário por medicamento, inferido: valor imobilizado ÷ saldo (ou custo ÷ quantidade da recomendação). */
export function custoUnitario(e: EstoqueApi | null, a: AnaliseApi | null): Record<string, number> {
  const out: Record<string, number> = {};
  e?.itens.forEach((i) => { if (i.saldo_registrado > 0) out[i.id_medicamento] = i.valor_imobilizado_brl / i.saldo_registrado; });
  a?.recomendacoes_compra.forEach((r) => { if (out[r.id_medicamento] === undefined && r.quantidade_sugerida > 0) out[r.id_medicamento] = r.custo_estimado_brl / r.quantidade_sugerida; });
  return out;
}

export type PontoMes = { chave: string; mes: string; consumo: number; entradas: number; saidas: number; valorCompras: number; valorPerdas: number };
export function serieMensal(movs: MovimentacaoApi[], custo: Record<string, number>): PontoMes[] {
  const m = new Map<string, PontoMes>();
  for (const x of movs) {
    const chave = diaSP(x.timestamp).slice(0, 7);
    let p = m.get(chave);
    if (!p) { p = { chave, mes: rotuloMes(chave), consumo: 0, entradas: 0, saidas: 0, valorCompras: 0, valorPerdas: 0 }; m.set(chave, p); }
    const q = Math.abs(x.quantidade), c = custo[x.id_medicamento] ?? 0;
    if (ehEntrada(x.tipo)) { p.entradas += q; if (x.tipo === 'ENTRADA_COMPRA') p.valorCompras += q * c; }
    else if (ehSaida(x.tipo)) { p.saidas += q; if (x.tipo === 'SAIDA_DISPENSACAO') p.consumo += q; if (x.tipo === 'SAIDA_DESCARTE') p.valorPerdas += q * c; }
  }
  return [...m.values()].sort((a, b) => a.chave.localeCompare(b.chave));
}

/** Total dispensado por medicamento em todo o histórico. */
export function consumoPorMed(movs: MovimentacaoApi[]): Record<string, number> {
  const o: Record<string, number> = {};
  movs.filter((x) => x.tipo === 'SAIDA_DISPENSACAO').forEach((x) => { o[x.id_medicamento] = (o[x.id_medicamento] ?? 0) + Math.abs(x.quantidade); });
  return o;
}

export type Compra = { timestamp: string; id_medicamento: string; fornecedor: string; documento: string; qtd: number; total: number };
export function compras(movs: MovimentacaoApi[], custo: Record<string, number>): Compra[] {
  return movs.filter((x) => x.tipo === 'ENTRADA_COMPRA').map((x) => ({ timestamp: x.timestamp, id_medicamento: x.id_medicamento, fornecedor: x.contraparte ?? 'Não informado', documento: x.documento ?? '-', qtd: x.quantidade, total: x.quantidade * (custo[x.id_medicamento] ?? 0) }))
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

export type FornecedorLivro = { nome: string; entradas: number; unidades: number; total: number; ultima: string; meds: string[] };
/** Fornecedores = contrapartes das entradas de compra. A API não tem preço, prazo nem pontualidade por fornecedor. */
export function fornecedores(movs: MovimentacaoApi[], custo: Record<string, number>, idMed?: string): FornecedorLivro[] {
  const m = new Map<string, FornecedorLivro>();
  for (const c of compras(movs, custo).filter((x) => !idMed || x.id_medicamento === idMed)) {
    const f = m.get(c.fornecedor) ?? { nome: c.fornecedor, entradas: 0, unidades: 0, total: 0, ultima: c.timestamp, meds: [] };
    f.entradas += 1; f.unidades += c.qtd; f.total += c.total;
    if (c.timestamp > f.ultima) f.ultima = c.timestamp;
    if (!f.meds.includes(c.id_medicamento)) f.meds.push(c.id_medicamento);
    m.set(c.fornecedor, f);
  }
  return [...m.values()].sort((a, b) => b.total - a.total);
}

/** Dispensações por dia nos últimos `dias` dias até a data de referência. */
export function consumoDiario(movs: MovimentacaoApi[], idMed: string, refIso: string, dias = 30): { d: string; real: number }[] {
  const por: Record<string, number> = {};
  movs.filter((x) => x.id_medicamento === idMed && x.tipo === 'SAIDA_DISPENSACAO').forEach((x) => { const k = diaSP(x.timestamp); por[k] = (por[k] ?? 0) + Math.abs(x.quantidade); });
  const ref = new Date(refIso).getTime();
  return Array.from({ length: dias }, (_, n) => { const k = diaSP(new Date(ref - (dias - 1 - n) * 864e5).toISOString()); return { d: `${k.slice(8, 10)}/${k.slice(5, 7)}`, real: por[k] ?? 0 }; });
}
