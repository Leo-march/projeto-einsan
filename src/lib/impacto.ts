import type { ImpactoItem, ItemEstoque, RecomendacaoCompra } from "@/types/dominio";
import { saidasPorDia } from "@/lib/projecao-inteira";

const MS_DIA = 86_400_000;
const JANELA_SIMULACAO_DIAS = 30;

type CenarioSimulado = {
  dias_sem_estoque: number;
  unidades_sem_estoque: number;
  unidades_vencidas: number;
  capital_medio_parado_brl: number;
  pontos: ImpactoItem["simulacao_30_dias"]["pontos_diarios"];
};

function simularCenario(
  estoqueUtil: number,
  consumoDiario: number,
  precoUnitario: number,
  quantidadeRecebida: number,
  diaEntrega: number,
  diasVencimento: number | null,
  unidadesVencimento: number,
  referenciaMs: number,
  cenarioComCompra: boolean,
): CenarioSimulado {
  let saldo = estoqueUtil;
  let diasSemEstoque = 0;
  let unidadesSemEstoque = 0;
  let somaCapitalParado = 0;
  const pontos: ImpactoItem["simulacao_30_dias"]["pontos_diarios"] = [];

  const consumoPorDia = saidasPorDia(consumoDiario, JANELA_SIMULACAO_DIAS);

  for (let dia = 1; dia <= JANELA_SIMULACAO_DIAS; dia += 1) {
    if (cenarioComCompra && dia === diaEntrega) saldo += quantidadeRecebida;
    const consumo = Math.max(0, consumoPorDia[dia - 1] ?? 0);
    const atendido = Math.min(saldo, consumo);
    const falta = Math.max(0, consumo - atendido);
    saldo = Math.max(0, saldo - atendido);
    if (falta > 0) diasSemEstoque += 1;
    unidadesSemEstoque += falta;
    somaCapitalParado += saldo * precoUnitario;

    const data = new Date(referenciaMs + dia * MS_DIA).toISOString();
    pontos.push({
      dia,
      data,
      estoque_sem_acao: cenarioComCompra ? 0 : saldo,
      estoque_com_recomendacao: cenarioComCompra ? saldo : 0,
      capital_sem_acao_brl: cenarioComCompra ? 0 : saldo * precoUnitario,
      capital_com_recomendacao_brl: cenarioComCompra ? saldo * precoUnitario : 0,
    });
  }

  const unidadesVencidas = diasVencimento !== null && diasVencimento <= JANELA_SIMULACAO_DIAS
    ? unidadesVencimento
    : 0;

  return {
    dias_sem_estoque: diasSemEstoque,
    unidades_sem_estoque: unidadesSemEstoque,
    unidades_vencidas: unidadesVencidas,
    capital_medio_parado_brl: somaCapitalParado / JANELA_SIMULACAO_DIAS,
    pontos,
  };
}

export function calcularImpacto(
  recomendacao: RecomendacaoCompra,
  item: ItemEstoque,
  consumoUsado: number,
  referenciaMs: number,
): ImpactoItem {
  const fornecedor = recomendacao.fornecedor_recomendado;
  const diasEntrega = fornecedor?.prazo_entrega_dias ?? item.prazo_reposicao_dias;
  const quantidadeRecebida = recomendacao.recomendar_compra ? fornecedor?.quantidade_pedida ?? 0 : 0;
  const riscoLotes = item.lotes.filter((lote) => recomendacao.lotes_em_risco_de_vencimento.includes(lote.codigo_lote));
  const diasVencimento = riscoLotes.length
    ? Math.min(...riscoLotes.map((lote) => Math.floor((Date.parse(`${lote.validade}T23:59:59-03:00`) - referenciaMs) / MS_DIA)))
    : null;
  const semAcao = simularCenario(
    recomendacao.estoque.util,
    consumoUsado,
    item.custo_unitario_brl,
    0,
    diasEntrega,
    diasVencimento,
    recomendacao.estoque.em_risco_de_vencimento,
    referenciaMs,
    false,
  );
  const comRecomendacao = simularCenario(
    recomendacao.estoque.util,
    consumoUsado,
    item.custo_unitario_brl,
    quantidadeRecebida,
    diasEntrega,
    diasVencimento,
    recomendacao.estoque.em_risco_de_vencimento,
    referenciaMs,
    true,
  );
  const diferencaFalta = Math.max(0, semAcao.dias_sem_estoque - comRecomendacao.dias_sem_estoque);
  const unidadesFaltaEvitadas = Math.max(0, semAcao.unidades_sem_estoque - comRecomendacao.unidades_sem_estoque);
  const unidadesVencidasEvitadas = Math.max(0, semAcao.unidades_vencidas - comRecomendacao.unidades_vencidas);
  const demandaAlvo = consumoUsado * (
    item.prazo_reposicao_dias + 30 + item.estoque_seguranca_dias
  );

  return {
    capital_imobilizado_brl: recomendacao.estoque.util * item.custo_unitario_brl,
    capital_excedente_brl: Math.max(0, recomendacao.estoque.util - demandaAlvo) * item.custo_unitario_brl,
    perdas_evitadas: {
      vencimento: { unidades: unidadesVencidasEvitadas, valor_brl: unidadesVencidasEvitadas * item.custo_unitario_brl },
      falta: { unidades: unidadesFaltaEvitadas, valor_brl: unidadesFaltaEvitadas * item.custo_unitario_brl },
    },
    simulacao_30_dias: {
      sem_acao: {
        dias_sem_estoque: semAcao.dias_sem_estoque,
        unidades_sem_estoque: semAcao.unidades_sem_estoque,
        unidades_vencidas: semAcao.unidades_vencidas,
        capital_medio_parado_brl: semAcao.capital_medio_parado_brl,
      },
      com_recomendacao: {
        dias_sem_estoque: comRecomendacao.dias_sem_estoque,
        unidades_sem_estoque: comRecomendacao.unidades_sem_estoque,
        unidades_vencidas: comRecomendacao.unidades_vencidas,
        capital_medio_parado_brl: comRecomendacao.capital_medio_parado_brl,
      },
      pontos_diarios: semAcao.pontos.map((ponto, indice) => ({
        ...ponto,
        estoque_com_recomendacao: comRecomendacao.pontos[indice].estoque_com_recomendacao,
        capital_com_recomendacao_brl: comRecomendacao.pontos[indice].capital_com_recomendacao_brl,
      })),
      premissas: [
        "A projeção começa no estoque útil calculado pelo motor FEFO.",
        `Consumo uniforme de ${consumoUsado} un./dia; não representa variabilidade diária futura.`,
        recomendacao.recomendar_compra
          ? `A compra recomendada é recebida no dia ${diasEntrega} e usa a quantidade ajustada de ${quantidadeRecebida} un.`
          : "Sem pedido recomendado, não há entrada de compra no cenário com recomendação.",
        "Unidades em risco de vencimento seguem a avaliação FEFO atual; não se presume uso após a validade.",
        "Capital médio parado é a média diária do saldo projetado multiplicado pelo custo unitário do arquivo de estoque.",
      ],
    },
  };
}