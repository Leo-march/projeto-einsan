import { CUSTO_CAPITAL_MENSAL_PCT } from "./parametros";
import type { DadosFornecedores, Fornecedor, OfertaFornecedor } from "@/types/dominio";

/**
 * Catálogo SIMULADO de fornecedores da PoC (não vem da API nem de data/).
 * Alimenta o motor de reposição (`escolherFornecedor`) e a página /fornecedores.
 * Para adicionar um fornecedor, inclua um item em PERFIS.
 */

const MEDICAMENTOS: { id: string; precoBase: number }[] = [
  { id: "MED-001", precoBase: 3600 },
  { id: "MED-002", precoBase: 5500 },
  { id: "MED-003", precoBase: 14000 },
  { id: "MED-004", precoBase: 18500 },
  { id: "MED-005", precoBase: 2100 },
];

type Perfil = {
  id: string;
  nome: string;
  cadeiaFria: boolean;
  confiabilidade: number;
  /** Multiplicador sobre o preço base do medicamento. */
  fator: number;
  prazoDias: number;
  /** Sobrescreve o prazo para medicamentos específicos. */
  prazoPorMed?: Record<string, number>;
  validadeDias: number;
  pedidoMinimo: number;
  descontoAVistaPct: number;
  /** Prazo de pagamento em dias (0 = só à vista). */
  pagamentoDias: number;
  /** Medicamentos que o fornecedor NÃO oferece. */
  sem?: string[];
};

const PERFIS: Perfil[] = [
  { id: "FOR-001", nome: "ColdChain Med Brasil", cadeiaFria: true, confiabilidade: 97, fator: 1.15, prazoDias: 2, prazoPorMed: { "MED-001": 1, "MED-004": 3 }, validadeDias: 200, pedidoMinimo: 1, descontoAVistaPct: 0, pagamentoDias: 15 },
  { id: "FOR-002", nome: "BioLog Distribuição", cadeiaFria: true, confiabilidade: 93, fator: 0.95, prazoDias: 3, validadeDias: 220, pedidoMinimo: 4, descontoAVistaPct: 3, pagamentoDias: 0 },
  { id: "FOR-003", nome: "Vitta Pharma Hospitalar", cadeiaFria: true, confiabilidade: 94, fator: 0.84, prazoDias: 3, validadeDias: 260, pedidoMinimo: 6, descontoAVistaPct: 2, pagamentoDias: 30, sem: ["MED-004"] },
  { id: "FOR-004", nome: "Pronta Saúde Distribuidora", cadeiaFria: true, confiabilidade: 95, fator: 1.18, prazoDias: 2, validadeDias: 230, pedidoMinimo: 2, descontoAVistaPct: 1, pagamentoDias: 21 },
  { id: "FOR-005", nome: "EconoMed Atacado", cadeiaFria: false, confiabilidade: 85, fator: 0.8, prazoDias: 3, validadeDias: 150, pedidoMinimo: 1, descontoAVistaPct: 0, pagamentoDias: 0 },
];

function montarFornecedor(perfil: Perfil): Fornecedor {
  const ofertas: OfertaFornecedor[] = MEDICAMENTOS
    .filter((med) => !perfil.sem?.includes(med.id))
    .map((med) => ({
      id_medicamento: med.id,
      preco_unitario_brl: Math.round(med.precoBase * perfil.fator),
      prazo_entrega_dias: perfil.prazoPorMed?.[med.id] ?? perfil.prazoDias,
      validade_minima_garantida_dias: perfil.validadeDias,
      quantidade_minima_pedido: perfil.pedidoMinimo,
      disponibilidade: 200,
      condicoes_pagamento: { prazo_dias: perfil.pagamentoDias, desconto_a_vista_pct: perfil.descontoAVistaPct },
    }));
  return {
    id_fornecedor: perfil.id,
    nome: perfil.nome,
    cadeia_fria_certificada: perfil.cadeiaFria,
    confiabilidade_entrega_pct: perfil.confiabilidade,
    simulado: true,
    ofertas,
  };
}

export const DADOS_FORNECEDORES: DadosFornecedores = {
  referencias_preco: MEDICAMENTOS.map((med) => ({
    id_medicamento: med.id,
    preco_referencia_brl: med.precoBase,
    fonte: "Referência simulada (PoC)",
  })),
  fornecedores: PERFIS.map(montarFornecedor),
};

/** Histórico simulado de pedidos já feitos: fornecedor → medicamento → nº de compras. */
export const COMPRAS_ANTERIORES_SIMULADAS: Record<string, Record<string, number>> = {
  "FOR-001": { "MED-001": 5, "MED-002": 2, "MED-004": 1 },
  "FOR-002": { "MED-001": 2, "MED-003": 7, "MED-005": 4 },
  "FOR-003": { "MED-002": 6, "MED-003": 3, "MED-005": 5 },
  "FOR-004": { "MED-001": 1, "MED-004": 6, "MED-003": 1 },
  "FOR-005": { "MED-005": 1 },
};

/** Preço por unidade já considerando o melhor entre pagar à vista (com desconto) ou a prazo. */
export function precoEfetivo(oferta: OfertaFornecedor): number {
  const aVista = oferta.preco_unitario_brl * (1 - oferta.condicoes_pagamento.desconto_a_vista_pct / 100);
  const aPrazo = oferta.preco_unitario_brl / (1 + (CUSTO_CAPITAL_MENSAL_PCT / 100) * (oferta.condicoes_pagamento.prazo_dias / 30));
  return Math.round(Math.min(aVista, aPrazo) * 100) / 100;
}

export type SeloFornecedor = "Menor custo" | "Entrega mais rápida" | "Mais confiável" | "Mais comprado por você";

export type LinhaFornecedor = {
  fornecedor: Fornecedor;
  oferta: OfertaFornecedor;
  precoEfetivo: number;
  comprasAnteriores: number;
  selos: SeloFornecedor[];
};

/** Ofertas de um medicamento com os selos calculados. Só fornecedores com cadeia fria disputam os selos. */
export function ofertasDoMedicamento(idMedicamento: string, dados: DadosFornecedores = DADOS_FORNECEDORES): LinhaFornecedor[] {
  const linhas = dados.fornecedores.flatMap((fornecedor) => {
    const oferta = fornecedor.ofertas.find((item) => item.id_medicamento === idMedicamento);
    return oferta
      ? [{
          fornecedor,
          oferta,
          precoEfetivo: precoEfetivo(oferta),
          comprasAnteriores: COMPRAS_ANTERIORES_SIMULADAS[fornecedor.id_fornecedor]?.[idMedicamento] ?? 0,
          selos: [] as SeloFornecedor[],
        }]
      : [];
  });
  const elegiveis = linhas.filter((linha) => linha.fornecedor.cadeia_fria_certificada);
  const vencedor = (chave: (linha: LinhaFornecedor) => number, melhorEhMenor: boolean): LinhaFornecedor | undefined =>
    [...elegiveis].sort((a, b) => (melhorEhMenor ? chave(a) - chave(b) : chave(b) - chave(a)))[0];

  vencedor((l) => l.precoEfetivo, true)?.selos.push("Menor custo");
  vencedor((l) => l.oferta.prazo_entrega_dias, true)?.selos.push("Entrega mais rápida");
  vencedor((l) => l.fornecedor.confiabilidade_entrega_pct, false)?.selos.push("Mais confiável");
  const maisComprado = vencedor((l) => l.comprasAnteriores, false);
  if (maisComprado && maisComprado.comprasAnteriores > 0) maisComprado.selos.push("Mais comprado por você");
  return linhas;
}