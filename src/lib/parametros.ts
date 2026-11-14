import type { Severidade } from "@/types/dominio";

/** Horizonte, em dias após a reposição, coberto pela compra recomendada. */
export const HORIZONTE_COBERTURA_DIAS = 30;

/** Margem legada aplicada por divergência até a reconciliação por lote da Etapa C. */
export const MARGEM_INCERTEZA_POR_DIVERGENCIA = 1;

/** Fatores do prazo de reposição que definem os limites de urgência do motor. */
export const LIMIARES_URGENCIA: Record<"critica" | "alta" | "media", number> = {
  critica: 1,
  alta: 2,
  media: 3,
};

/** Pesos hipotéticos em urgência alta/crítica: priorizam tempo de entrega. */
export const PESOS_FORNECEDOR_URGENTE = {
  preco: 0.2,
  prazo: 0.5,
  confiabilidade: 0.15,
  validade: 0.15,
} as const;

/** Pesos hipotéticos em urgência média/baixa: priorizam custo de aquisição. */
export const PESOS_FORNECEDOR_PLANEJADO = {
  preco: 0.45,
  prazo: 0.25,
  confiabilidade: 0.15,
  validade: 0.15,
} as const;

/** Custo de capital mensal hipotético usado para comparar pagamento a prazo. */
export const CUSTO_CAPITAL_MENSAL_PCT = 1.5;

/** Atraso de compra usado somente no cenário de custo de esperar. */
export const DIAS_ADIAMENTO_SIMULACAO = 7;

/** Janela curta usada para estimar a tendência de consumo. */
export const JANELA_CONSUMO_CURTA_DIAS = 7;

/** Janela longa usada para a média-base de consumo. */
export const JANELA_CONSUMO_LONGA_DIAS = 30;

/** Mínimo de saídas regulares para dispensar o fallback do estoque. */
export const MINIMO_SAIDAS_PARA_HISTORICO = 5;

/** Fator acima da mediana que sinaliza uma saída isolada atípica. */
export const FATOR_SAIDA_ATIPICA = 3;

/** Variação relativa acima da qual a tendência é classificada como alta. */
export const LIMIAR_TENDENCIA_CONSUMO_ALTA = 1.15;

/** Variação relativa abaixo da qual a tendência é classificada como baixa. */
export const LIMIAR_TENDENCIA_CONSUMO_BAIXA = 0.85;

/** Peso hipotético da taxa recente quando há tendência sustentada. */
export const PESO_CONSUMO_RECENTE = 0.7;

/** Fator inferior para a faixa de quantidade em confiança baixa. */
export const FATOR_FAIXA_QUANTIDADE_MINIMA = 0.8;

/** Fator superior para a faixa de quantidade em confiança baixa. */
export const FATOR_FAIXA_QUANTIDADE_MAXIMA = 1.2;

/** Abaixo deste percentual de saídas identificadas a confiança é baixa. */
export const LIMIAR_CONFIANCA_BAIXA_PCT = 95;

/** Converte taxa percentual mensal para o fator de valor presente diário. */
export function getPesosFornecedor(urgencia: Severidade) {
  return urgencia === "CRITICA" || urgencia === "ALTA"
    ? PESOS_FORNECEDOR_URGENTE
    : PESOS_FORNECEDOR_PLANEJADO;
}