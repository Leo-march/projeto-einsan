const MS_DIA = 86_400_000;

export type LoteProjecao = {
  codigo_lote: string;
  quantidade: number;
  validade: string;
};

export type DiaProjecao = {
  dia: number;
  data: string;
  saida: number;
  estoque_restante: number;
  unidades_vencidas: number;
  saidas_total?: number;
};

function parseValidade(validade: string): number {
  return Date.parse(`${validade}T23:59:59-03:00`);
}

export function saidasPorDia(c: number, dias: number, residuoInicial = 0): number[] {
  const totalDias = Math.max(0, Math.trunc(dias));
  if (!Number.isFinite(c) || c <= 0) {
    return Array.from({ length: totalDias }, () => 0);
  }

  let residual = Number.isFinite(residuoInicial) ? residuoInicial : 0;
  const saidas: number[] = [];

  for (let dia = 0; dia < totalDias; dia += 1) {
    residual += c;
    const saida = Math.floor(residual + 1e-9);
    residual -= saida;
    saidas.push(saida);
  }

  return saidas;
}

export function diaDaRuptura(estoque: number, c: number): number | null {
  if (!Number.isFinite(estoque) || estoque <= 0) return null;
  if (!Number.isFinite(c) || c <= 0) return null;
  return Math.ceil(estoque / c - 1e-9);
}

export function projetarEstoque(estoqueInicial: number, c: number, dias: number): { saidas: number[]; estoque: number[] } {
  const saidas = saidasPorDia(c, dias);
  let saldo = Number.isFinite(estoqueInicial) ? Math.max(0, Math.trunc(estoqueInicial)) : 0;
  const estoque: number[] = [];

  for (const saida of saidas) {
    saldo = Math.max(0, saldo - saida);
    estoque.push(saldo);
  }

  return { saidas, estoque };
}

export function simularEstoque(
  lotes: LoteProjecao[],
  c: number,
  dias: number,
  refMs = Date.now(),
  residuoInicial = 0,
): DiaProjecao[] & {
  atual: DiaProjecao;
  estoque_final: number;
  saidas_total: number;
  unidades_vencidas_total: number;
} {
  const fila = [...lotes]
    .map((lote) => ({
      codigo_lote: lote.codigo_lote,
      quantidade: Number.isFinite(lote.quantidade) ? Math.max(0, Math.trunc(lote.quantidade)) : 0,
      validadeMs: parseValidade(lote.validade),
    }))
    .filter((lote) => lote.quantidade > 0)
    .sort((a, b) => a.validadeMs - b.validadeMs);

  const saidas = saidasPorDia(c, dias, residuoInicial);
  const cronograma: DiaProjecao[] = [];
  let estoque = fila.reduce((soma, lote) => soma + lote.quantidade, 0);
  let totalSaidas = 0;
  let totalVencidas = 0;

  for (let dia = 1; dia <= saidas.length; dia += 1) {
    const dataMs = refMs + dia * MS_DIA;
    const data = new Date(dataMs).toISOString();
    const fimDoDiaMs = dataMs + MS_DIA - 1;

    for (let i = fila.length - 1; i >= 0; i -= 1) {
      const lote = fila[i];
      if (lote.validadeMs <= fimDoDiaMs) {
        totalVencidas += lote.quantidade;
        estoque = Math.max(0, estoque - lote.quantidade);
        fila.splice(i, 1);
      }
    }

    const saidaDia = saidas[dia - 1] ?? 0;
    let restanteDia = saidaDia;
    for (const lote of fila) {
      if (restanteDia <= 0) break;
      const consumir = Math.min(restanteDia, lote.quantidade);
      lote.quantidade -= consumir;
      restanteDia -= consumir;
      estoque = Math.max(0, estoque - consumir);
      totalSaidas += consumir;
    }

    for (let i = fila.length - 1; i >= 0; i -= 1) {
      if (fila[i].quantidade <= 0) fila.splice(i, 1);
    }

    const ponto: DiaProjecao = {
      dia,
      data,
      saida: saidaDia,
      estoque_restante: Math.max(0, estoque),
      unidades_vencidas: totalVencidas,
    };
    ponto.saidas_total = totalSaidas;
    cronograma.push(ponto);
  }

  const resultado = cronograma as DiaProjecao[] & {
    atual: DiaProjecao;
    estoque_final: number;
    saidas_total: number;
    unidades_vencidas_total: number;
  };

  resultado.atual = cronograma[cronograma.length - 1] ?? {
    dia: 0,
    data: new Date(refMs).toISOString(),
    saida: 0,
    estoque_restante: Math.max(0, estoque),
    unidades_vencidas: totalVencidas,
    saidas_total: totalSaidas,
  };
  resultado.estoque_final = Math.max(0, estoque);
  resultado.saidas_total = totalSaidas;
  resultado.unidades_vencidas_total = totalVencidas;

  return resultado;
}
