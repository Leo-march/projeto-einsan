import type { EventoCofre } from "./tipos";

export function calcularConfiancaSaldo(loteId: string, eventos: EventoCofre[]): number {
  const movimentos = eventos.filter((evento) =>
    ["entrada", "retirada", "transferencia", "dispensacao"].includes(evento.tipo),
  );
  const vinculadosAoLote = movimentos.filter((evento) => evento.loteId === loteId).length;
  const movimentosSemLote = movimentos.filter((evento) => evento.loteId === null).length;
  const totalAvaliado = vinculadosAoLote + movimentosSemLote;
  return totalAvaliado === 0 ? 100 : Math.round((vinculadosAoLote / totalAvaliado) * 100);
}