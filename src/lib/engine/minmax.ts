import type { Estabelecimento, Lote } from "./tipos";

export function calcularMinMax(lotes: Lote[], estabelecimento: Estabelecimento): number {
  const saldo = lotes.reduce((total, lote) => total + lote.qtd, 0);
  const { min, max } = estabelecimento.perfil;
  return saldo <= min ? Math.max(0, max - saldo) : 0;
}