import type { Lote } from "./tipos";

export type LoteEmRisco = {
  lote: Lote;
  diasParaVencer: number;
  unidadesEmRisco: number;
};

export function simularFefo(lotes: Lote[], consumoSemanal: number, hoje: Date): LoteEmRisco[] {
  const horizonteDias = 84;
  const fim = new Date(hoje);
  fim.setUTCDate(fim.getUTCDate() + horizonteDias);
  let saldoPorLote = lotes.map((lote) => ({ lote, saldo: lote.qtd }));
  const risco: LoteEmRisco[] = [];

  for (let semana = 0; semana < 12; semana += 1) {
    const inicioSemana = new Date(hoje);
    inicioSemana.setUTCDate(inicioSemana.getUTCDate() + semana * 7);
    saldoPorLote = saldoPorLote.map((item) => {
      const validade = new Date(item.lote.validade);
      if (validade <= inicioSemana) {
        const diasParaVencer = Math.max(0, Math.ceil((validade.getTime() - hoje.getTime()) / 86400000));
        if (item.saldo > 0 && diasParaVencer >= 0 && validade <= fim) {
          risco.push({ lote: item.lote, diasParaVencer, unidadesEmRisco: item.saldo });
        }
        return { ...item, saldo: 0 };
      }
      return item;
    });

    let demandaRestante = Math.max(0, Math.round(consumoSemanal));
    const fefo = [...saldoPorLote].sort((left, right) => left.lote.validade.localeCompare(right.lote.validade));
    for (const item of fefo) {
      const consumidas = Math.min(item.saldo, demandaRestante);
      item.saldo -= consumidas;
      demandaRestante -= consumidas;
      if (demandaRestante <= 0) break;
    }
    saldoPorLote = fefo;
  }

  return risco.sort((left, right) => left.diasParaVencer - right.diasParaVencer);
}