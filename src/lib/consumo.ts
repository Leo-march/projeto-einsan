import type { ConsumoHistorico, Movimentacao, QualidadeConsumo } from "@/types/dominio";
import {
  FATOR_SAIDA_ATIPICA,
  JANELA_CONSUMO_CURTA_DIAS,
  JANELA_CONSUMO_LONGA_DIAS,
  LIMIAR_CONFIANCA_BAIXA_PCT,
  LIMIAR_TENDENCIA_CONSUMO_ALTA,
  LIMIAR_TENDENCIA_CONSUMO_BAIXA,
  MINIMO_SAIDAS_PARA_HISTORICO,
  PESO_CONSUMO_RECENTE,
} from "./parametros";

const MS_DIA = 86_400_000;

const TIPOS_CONSUMO = new Set(["SAIDA", "DISPENSACAO"]);

function mediana(valores: number[]): number {
  if (valores.length === 0) return 0;
  const ordenados = [...valores].sort((a, b) => a - b);
  const meio = Math.floor(ordenados.length / 2);
  return ordenados.length % 2 === 0
    ? (ordenados[meio - 1] + ordenados[meio]) / 2
    : ordenados[meio];
}

function total(valores: Movimentacao[]): number {
  return valores.reduce((soma, item) => soma + item.quantidade, 0);
}

export function calcularConsumoEQualidade(
  medicamentoId: string,
  cofreId: string,
  movimentacoes: Movimentacao[],
  referenciaMs: number,
  consumoFallback: number,
  divergenciasAbertas: number,
): { consumo: ConsumoHistorico; qualidade: QualidadeConsumo } {
  const movimentosMedicamento = movimentacoes
    .filter((movimento) => movimento.id_medicamento === medicamentoId && movimento.cofre_id === cofreId)
    .filter((movimento) => Date.parse(movimento.timestamp) <= referenciaMs);
  const saidas = movimentosMedicamento.filter((movimento) => TIPOS_CONSUMO.has(movimento.tipo));
  const inicio30 = referenciaMs - JANELA_CONSUMO_LONGA_DIAS * MS_DIA;
  const inicio7 = referenciaMs - JANELA_CONSUMO_CURTA_DIAS * MS_DIA;
  const saidas30 = saidas.filter((movimento) => Date.parse(movimento.timestamp) >= inicio30);
  const saidas7 = saidas30.filter((movimento) => Date.parse(movimento.timestamp) >= inicio7);
  const quantidades30 = saidas30.map((movimento) => movimento.quantidade);
  const medianaSaidas = mediana(quantidades30);
  const limiteAtipico = Math.max(medianaSaidas * FATOR_SAIDA_ATIPICA, consumoFallback * FATOR_SAIDA_ATIPICA, FATOR_SAIDA_ATIPICA);
  const atipicos = saidas30.filter((movimento) => movimento.quantidade > limiteAtipico);
  const idsAtipicos = new Set(atipicos.map((movimento) => movimento.id_movimento));
  const regulares30 = saidas30.filter((movimento) => !idsAtipicos.has(movimento.id_movimento));
  const regulares7 = saidas7.filter((movimento) => !idsAtipicos.has(movimento.id_movimento));
  const eventosAntigos = saidas
    .map((movimento) => Date.parse(movimento.timestamp))
    .filter((timestamp) => !Number.isNaN(timestamp));
  const diasHistorico = eventosAntigos.length === 0
    ? 0
    : Math.max(0, Math.floor((referenciaMs - Math.min(...eventosAntigos)) / MS_DIA));
  const consumo30Regular = total(regulares30);
  const consumo7Regular = total(regulares7);
  const taxa30 = consumo30Regular / JANELA_CONSUMO_LONGA_DIAS;
  const taxa7 = consumo7Regular / JANELA_CONSUMO_CURTA_DIAS;
  const usouFallback = regulares30.length < MINIMO_SAIDAS_PARA_HISTORICO;
  let tendencia: ConsumoHistorico["tendencia"] = "SEM_HISTORICO";
  let consumoUsado = consumoFallback;

  if (!usouFallback) {
    if (taxa7 > taxa30 * LIMIAR_TENDENCIA_CONSUMO_ALTA) {
      tendencia = "EM_ALTA";
      consumoUsado = taxa7 * PESO_CONSUMO_RECENTE + taxa30 * (1 - PESO_CONSUMO_RECENTE);
    } else if (taxa7 < taxa30 * LIMIAR_TENDENCIA_CONSUMO_BAIXA) {
      tendencia = "EM_BAIXA";
      consumoUsado = taxa7 * PESO_CONSUMO_RECENTE + taxa30 * (1 - PESO_CONSUMO_RECENTE);
    } else {
      tendencia = "ESTAVEL";
      consumoUsado = taxa30;
    }
  }

  const percentualIdentificado = saidas30.length === 0
    ? 0
    : Math.round((saidas30.filter((movimento) => movimento.codigo_lote !== null).length / saidas30.length) * 100);
  const movimentacoesManuais = movimentosMedicamento.filter(
    (movimento) => Date.parse(movimento.timestamp) >= inicio30 && movimento.origem_registro !== "SCANNER",
  ).length;
  let nivelConfianca: QualidadeConsumo["nivel_confianca"];
  if (saidas30.length === 0 || percentualIdentificado < LIMIAR_CONFIANCA_BAIXA_PCT || diasHistorico < 14) {
    nivelConfianca = "BAIXO";
  } else if (percentualIdentificado < 100 || diasHistorico < JANELA_CONSUMO_LONGA_DIAS || movimentacoesManuais > 0 || divergenciasAbertas > 0) {
    nivelConfianca = "MEDIO";
  } else {
    nivelConfianca = "ALTO";
  }

  const motivosConfianca: string[] = [];
  if (saidas30.length === 0) motivosConfianca.push("nenhuma saída ou dispensação na janela de 30 dias");
  if (percentualIdentificado < 100) motivosConfianca.push(`${100 - percentualIdentificado}% das saídas sem lote identificado`);
  if (diasHistorico < JANELA_CONSUMO_LONGA_DIAS) motivosConfianca.push(`apenas ${diasHistorico} dias de histórico disponível`);
  if (movimentacoesManuais > 0) motivosConfianca.push(`${movimentacoesManuais} movimentação(ões) manual(is) ou sem leitura`);
  if (divergenciasAbertas > 0) motivosConfianca.push(`${divergenciasAbertas} divergência(s) aberta(s)`);

  return {
    consumo: {
      consumo_usado: consumoUsado,
      consumo_7d: total(saidas7),
      consumo_30d: total(saidas30),
      tendencia,
      atipicos_detectados: atipicos.map((movimento) => ({
        id_movimento: movimento.id_movimento,
        timestamp: movimento.timestamp,
        quantidade: movimento.quantidade,
        motivo: `Saída de ${movimento.quantidade} un. acima de 3× a mediana observada (${medianaSaidas} un.).`,
      })),
      usou_fallback: usouFallback,
      justificativa_fallback: usouFallback
        ? `Apenas ${regulares30.length} saídas regulares em 30 dias; foi usado consumo_medio_diario (${consumoFallback} un./dia).`
        : null,
    },
    qualidade: {
      percentual_saidas_lote_identificado: percentualIdentificado,
      dias_historico: diasHistorico,
      movimentacoes_manuais_ou_sem_leitura: movimentacoesManuais,
      divergencias_abertas: divergenciasAbertas,
      nivel_confianca: nivelConfianca,
      motivo_confianca: motivosConfianca.length ? motivosConfianca.join("; ") : "Histórico completo, identificado e sem divergências abertas.",
    },
  };
}
