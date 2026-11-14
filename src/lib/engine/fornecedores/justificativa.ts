import type { Fornecedor } from "../tipos";

export function criarJustificativa(fornecedor: Fornecedor): string[] {
  return [
    `Preço unitário de R$ ${fornecedor.precoUnitario.toLocaleString("pt-BR")}`,
    `prazo de ${fornecedor.prazoDias} dias`,
    `confiabilidade histórica simulada de ${fornecedor.confiabilidade}%`,
    `lote mínimo de ${fornecedor.loteMinimo} unidades`,
  ];
}