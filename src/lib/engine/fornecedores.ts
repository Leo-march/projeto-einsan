import type { Fornecedor, Pesos } from "./tipos";

export type FornecedorAvaliado = {
  fornecedor: Fornecedor;
  pontuacao: number;
  excluido: boolean;
  motivoExclusao: string | null;
  justificativa: string[];
};

function normalizar(valor: number, minimo: number, maximo: number, menorMelhor: boolean): number {
  if (maximo === minimo) return 100;
  const proporcao = (valor - minimo) / (maximo - minimo);
  return Math.round((menorMelhor ? 1 - proporcao : proporcao) * 100);
}

export function avaliarFornecedores(fornecedores: Fornecedor[], pesos: Pesos, prazoMaximo = 14): FornecedorAvaliado[] {
  const precos = fornecedores.map((item) => item.precoUnitario);
  const prazos = fornecedores.map((item) => item.prazoDias);
  const minimos = fornecedores.map((item) => item.loteMinimo);
  const maximos = [Math.max(...precos), Math.max(...prazos), Math.max(...minimos)];
  const minimosValores = [Math.min(...precos), Math.min(...prazos), Math.min(...minimos)];

  return fornecedores
    .map((fornecedor) => {
      const criterios = {
        preco: normalizar(fornecedor.precoUnitario, minimosValores[0], maximos[0], true),
        prazo: normalizar(fornecedor.prazoDias, minimosValores[1], maximos[1], true),
        confiabilidade: fornecedor.confiabilidade,
        loteMinimo: normalizar(fornecedor.loteMinimo, minimosValores[2], maximos[2], true),
      };
      const somaPesos = pesos.preco + pesos.prazo + pesos.confiabilidade + pesos.loteMinimo || 1;
      const pontuacao = Math.round(
        (criterios.preco * pesos.preco +
          criterios.prazo * pesos.prazo +
          criterios.confiabilidade * pesos.confiabilidade +
          criterios.loteMinimo * pesos.loteMinimo) /
          somaPesos,
      );
      const excluido = fornecedor.prazoDias > prazoMaximo;
      return {
        fornecedor,
        pontuacao,
        excluido,
        motivoExclusao: excluido ? `Prazo de ${fornecedor.prazoDias} dias excede a premissa de ${prazoMaximo} dias.` : null,
        justificativa: [
          `Preço unitário de R$ ${fornecedor.precoUnitario.toLocaleString("pt-BR")}`,
          `prazo de ${fornecedor.prazoDias} dias`,
          `confiabilidade histórica simulada de ${fornecedor.confiabilidade}%`,
          `lote mínimo de ${fornecedor.loteMinimo} unidades`,
        ],
      };
    })
    .sort((left, right) => Number(left.excluido) - Number(right.excluido) || right.pontuacao - left.pontuacao);
}