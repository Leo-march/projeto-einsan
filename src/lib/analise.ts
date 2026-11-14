import type {
  AlertaMovimentacaoNaoIdentificada,
  AlertaRiscoTermico,
  AnaliseResponse,
  AvaliacaoTermica,
  Bula,
  DadosFornecedores,
  EstoqueCofre,
  LogHardware,
  Movimentacao,
  RecomendacaoCompra,
  Severidade,
  AcaoCompra,
} from "@/types/dominio";
import {
  FATOR_FAIXA_QUANTIDADE_MAXIMA,
  FATOR_FAIXA_QUANTIDADE_MINIMA,
  DIAS_ADIAMENTO_SIMULACAO,
  HORIZONTE_COBERTURA_DIAS,
  LIMIARES_URGENCIA,
  MARGEM_INCERTEZA_POR_DIVERGENCIA,
} from "@/lib/parametros";
import { escolherFornecedor } from "@/lib/fornecedores";
import { calcularConsumoEQualidade } from "@/lib/consumo";
import { calcularImpacto } from "@/lib/impacto";
import { reconstruirRastreabilidade } from "@/lib/rastreabilidade";

const MS_MIN = 60_000;
const MS_DIA = 86_400_000;

const arred = (n: number, casas = 1) => {
  const f = 10 ** casas;
  return Math.round(n * f) / f;
};

const soma = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

// ============================================================
// Regra 1: Risco Térmico
// ============================================================
export function analisarRiscoTermico(
  logs: LogHardware[],
  bulas: Bula[],
  estoque: EstoqueCofre,
  refMs: number
) {
  const leituras = logs
    .filter(
      (l) =>
        l.tipo === "LEITURA_TEMPERATURA" &&
        typeof l.temperatura_celsius === "number"
    )
    .map((l) => ({ ms: Date.parse(l.timestamp), temp: l.temperatura_celsius as number }))
    .sort((a, b) => a.ms - b.ms);

  const avaliacoes: AvaliacaoTermica[] = [];
  const alertas: AlertaRiscoTermico[] = [];

  for (const bula of bulas) {
    const fora = (t: number) => t < bula.temp_min_celsius || t > bula.temp_max_celsius;

    let totalMs = 0;
    let inicio: number | null = null;
    let ultimoRetorno: number | null = null;
    let emAndamento = false;

    // Cada leitura fora da faixa vale até a leitura seguinte (critério conservador).
    for (let i = 0; i < leituras.length; i++) {
      const atual = leituras[i];
      if (!fora(atual.temp)) continue;
      if (inicio === null) inicio = atual.ms;

      const prox = leituras[i + 1];
      if (prox) {
        totalMs += prox.ms - atual.ms;
        if (!fora(prox.temp)) ultimoRetorno = prox.ms;
      } else {
        emAndamento = true;
        totalMs += Math.max(0, refMs - atual.ms);
      }
    }

    const minutos = arred(totalMs / MS_MIN);
    const temps = leituras.map((l) => l.temp);
    const tMax = temps.length ? Math.max(...temps) : null;
    const tMin = temps.length ? Math.min(...temps) : null;

    const status: AvaliacaoTermica["status"] =
      minutos > bula.alerta_exposicao_minutos
        ? "LOTES_INVALIDADOS"
        : minutos > 0
        ? "EXCURSAO_TOLERADA"
        : "CONFORME";

    avaliacoes.push({
      id_medicamento: bula.id_medicamento,
      nome: bula.nome,
      faixa_bula_celsius: { min: bula.temp_min_celsius, max: bula.temp_max_celsius },
      limite_exposicao_minutos: bula.alerta_exposicao_minutos,
      minutos_fora_da_faixa: minutos,
      temperatura_maxima_registrada: tMax,
      temperatura_minima_registrada: tMin,
      inicio_excursao: inicio ? new Date(inicio).toISOString() : null,
      fim_excursao: !emAndamento && ultimoRetorno ? new Date(ultimoRetorno).toISOString() : null,
      excursao_em_andamento: emAndamento,
      status,
    });

    if (status === "LOTES_INVALIDADOS") {
      const lotes = estoque.itens.find((i) => i.id_medicamento === bula.id_medicamento)?.lotes ?? [];
      alertas.push({
        tipo: "RISCO_TERMICO",
        severidade: "CRITICA",
        id_medicamento: bula.id_medicamento,
        nome: bula.nome,
        minutos_fora_da_faixa: minutos,
        limite_exposicao_minutos: bula.alerta_exposicao_minutos,
        temperatura_maxima_registrada: tMax,
        lotes_invalidados: lotes.map((l) => l.codigo_lote),
        unidades_invalidadas: soma(lotes.map((l) => l.quantidade)),
        mensagem:
          `Lotes de ${bula.nome} invalidados: ${minutos} min fora da faixa ` +
          `${bula.temp_min_celsius}–${bula.temp_max_celsius}ºC (limite da bula: ` +
          `${bula.alerta_exposicao_minutos} min; pico de ${tMax}ºC).`,
      });
    }
  }

  return { avaliacoes, alertas };
}

// ============================================================
// Regra 2: Movimentação Não Identificada
// ============================================================
export function detectarMovimentacaoNaoIdentificada(logs: LogHardware[]) {
  const ordenados = [...logs].sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
  const alertas: AlertaMovimentacaoNaoIdentificada[] = [];

  let aberta: LogHardware | null = null;
  let scans = 0;
  let ciclos = 0;

  for (const ev of ordenados) {
    if (ev.tipo === "PORTA_ABERTA") {
      aberta = ev;
      scans = 0;
    } else if (ev.tipo === "LEITURA_SCANNER" && aberta) {
      scans++;
    } else if (ev.tipo === "PORTA_FECHADA" && aberta) {
      ciclos++;
      if (scans === 0) {
        const duracao = Math.round((Date.parse(ev.timestamp) - Date.parse(aberta.timestamp)) / 1000);
        alertas.push({
          tipo: "DIVERGENCIA_ESTOQUE",
          severidade: "ALTA",
          porta_aberta_em: aberta.timestamp,
          porta_fechada_em: ev.timestamp,
          duracao_segundos: duracao,
          usuario_biometria_id: aberta.usuario_biometria_id ?? null,
          mensagem:
            "Divergência de Estoque / Retirada não identificada: a porta foi aberta " +
            `e fechada (${Math.round(duracao / 60)} min) sem nenhuma leitura do scanner.`,
        });
      }
      aberta = null;
    }
  }

  return { alertas, ciclos, portaAbertaAgora: aberta !== null };
}

// ============================================================
// Regra 3: Motor de Recomendação (urgência x validade)
// ============================================================
const RANK: Record<Severidade, number> = { CRITICA: 0, ALTA: 1, MEDIA: 2, BAIXA: 3 };

export function gerarRecomendacoes(
  bulas: Bula[],
  estoque: EstoqueCofre,
  avaliacoes: AvaliacaoTermica[],
  totalDivergencias: number,
  refMs: number,
  dadosFornecedores: DadosFornecedores = { referencias_preco: [], fornecedores: [] },
  movimentacoes: Movimentacao[] = []
): RecomendacaoCompra[] {
  const recs: RecomendacaoCompra[] = [];
  const rastreabilidadePorMedicamento = reconstruirRastreabilidade(
    estoque,
    movimentacoes,
    avaliacoes,
    refMs,
    totalDivergencias * MARGEM_INCERTEZA_POR_DIVERGENCIA,
  );

  for (const item of estoque.itens) {
    const bula = bulas.find((b) => b.id_medicamento === item.id_medicamento);
    const nome = bula?.nome ?? item.id_medicamento;
    const invalidadoTermico =
      avaliacoes.find((a) => a.id_medicamento === item.id_medicamento)?.status === "LOTES_INVALIDADOS";
    const { consumo: consumoHistorico, qualidade: qualidadeDados } = calcularConsumoEQualidade(
      item.id_medicamento,
      estoque.cofre_id,
      movimentacoes,
      refMs,
      item.consumo_medio_diario,
      totalDivergencias + (rastreabilidadePorMedicamento[item.id_medicamento]?.divergencias_lote_abertas ?? 0),
    );
    const consumoUsado = consumoHistorico.consumo_usado;

    const bruto = soma(item.lotes.map((l) => l.quantidade));
    let invalidadas = 0;
    let vencidas = 0;
    const validos: { codigo_lote: string; quantidade: number; dias: number }[] = [];

    for (const lote of item.lotes) {
      if (invalidadoTermico) {
        invalidadas += lote.quantidade;
        continue;
      }
      const dias = Math.floor((Date.parse(`${lote.validade}T23:59:59-03:00`) - refMs) / MS_DIA);
      if (dias <= 0) vencidas += lote.quantidade;
      else validos.push({ codigo_lote: lote.codigo_lote, quantidade: lote.quantidade, dias });
    }

    // FEFO: o que não dá tempo de consumir antes de vencer não conta como estoque útil.
    validos.sort((a, b) => a.dias - b.dias);
    let consumidoLegado = 0;
    let usaveisLegado = 0;
    for (const lote of validos) {
      const capacidadeLegada = item.consumo_medio_diario > 0 ? item.consumo_medio_diario * lote.dias : Infinity;
      const disponivelLegado = Math.max(0, Math.floor(capacidadeLegada - consumidoLegado));
      const usavelLegado = Math.min(lote.quantidade, disponivelLegado);
      consumidoLegado += usavelLegado;
      usaveisLegado += usavelLegado;
    }
    const utilLegado = Math.max(0, usaveisLegado - totalDivergencias * MARGEM_INCERTEZA_POR_DIVERGENCIA);
    let consumidoAcum = 0;
    let usaveis = 0;
    let emRisco = 0;
    const lotesEmRisco: string[] = [];

    for (const l of validos) {
      const capacidade = consumoUsado > 0 ? consumoUsado * l.dias : Infinity;
      const disponivel = Math.max(0, Math.floor(capacidade - consumidoAcum));
      const usavel = Math.min(l.quantidade, disponivel);
      consumidoAcum += usavel;
      usaveis += usavel;
      if (usavel < l.quantidade) {
        emRisco += l.quantidade - usavel;
        lotesEmRisco.push(l.codigo_lote);
      }
    }

    const rastreabilidade = rastreabilidadePorMedicamento[item.id_medicamento];
    const margem = rastreabilidade?.margem_incerteza_unidades ?? totalDivergencias * MARGEM_INCERTEZA_POR_DIVERGENCIA;
    const util = Math.max(0, usaveis - margem);

    const cobertura = consumoUsado > 0 ? arred(util / consumoUsado) : null;
    const lead = item.prazo_reposicao_dias;

    let urgencia: Severidade = "BAIXA";
    if (cobertura !== null) {
      if (cobertura <= lead * LIMIARES_URGENCIA.critica) urgencia = "CRITICA";
      else if (cobertura <= lead * LIMIARES_URGENCIA.alta) urgencia = "ALTA";
      else if (cobertura <= lead * LIMIARES_URGENCIA.media) urgencia = "MEDIA";
    }

    const recomendar = urgencia !== "BAIXA";
    const diasAlvo = lead + HORIZONTE_COBERTURA_DIAS + item.estoque_seguranca_dias;
    const demandaAlvo = consumoUsado * diasAlvo;
    const quantidadeBase = recomendar ? Math.max(0, Math.ceil(demandaAlvo - util)) : 0;
    const quantidadeHistoricaMinima = recomendar
      ? Math.max(0, Math.ceil(consumoUsado * FATOR_FAIXA_QUANTIDADE_MINIMA * diasAlvo - util))
      : 0;
    const quantidadeHistoricaMaxima = recomendar
      ? Math.max(0, Math.ceil(consumoUsado * FATOR_FAIXA_QUANTIDADE_MAXIMA * diasAlvo - util))
      : 0;
    const faixaQuantidade = qualidadeDados.nivel_confianca === "BAIXO"
      ? {
          minimo: Math.min(quantidadeHistoricaMinima, quantidadeHistoricaMaxima),
          maximo: Math.max(quantidadeHistoricaMinima, quantidadeHistoricaMaxima),
          conservadora: Math.max(quantidadeHistoricaMinima, quantidadeHistoricaMaxima),
        }
      : null;
    const quantidade = faixaQuantidade?.conservadora ?? quantidadeBase;
    const quantidadeLegada = recomendar
      ? Math.max(0, Math.ceil(item.consumo_medio_diario * diasAlvo - utilLegado))
      : 0;
    const custoReferencia = quantidadeLegada * item.custo_unitario_brl;

    const acoes: Record<Severidade, AcaoCompra> = {
      CRITICA: "COMPRAR_IMEDIATAMENTE",
      ALTA: "COMPRAR_NO_CICLO_ATUAL",
      MEDIA: "PLANEJAR_REPOSICAO",
      BAIXA: "MONITORAR",
    };

    const justificativas: string[] = [];
    if (invalidadoTermico) justificativas.push(`${invalidadas} un. invalidadas por excursão térmica (regra da bula).`);
    if (vencidas > 0) justificativas.push(`${vencidas} un. com validade expirada.`);
    if (emRisco > 0)
      justificativas.push(`${emRisco} un. (${lotesEmRisco.join(", ")}) vencem antes de serem consumidas no ritmo atual.`);
    if (margem > 0) justificativas.push(`Margem de ${margem} un. por retirada não identificada (falha de bipagem).`);
    justificativas.push(
        cobertura === null
        ? "Sem histórico de consumo para estimar cobertura."
          : `Cobertura útil de ${cobertura} dia(s) vs. prazo de reposição de ${lead} dia(s), usando ${consumoUsado} un./dia.`,
      ...(consumoHistorico.justificativa_fallback ? [consumoHistorico.justificativa_fallback] : []),
    );

    recs.push({
      id_medicamento: item.id_medicamento,
      nome,
      urgencia,
      acao: acoes[urgencia],
      recomendar_compra: recomendar,
      quantidade_sugerida: quantidade,
      custo_estimado_brl: quantidade * item.custo_unitario_brl,
      validade_minima_exigida_dias: lead + HORIZONTE_COBERTURA_DIAS,
      cobertura_dias: cobertura,
      prazo_reposicao_dias: lead,
      estoque: {
        bruto,
        invalidado_termico: invalidadas,
        vencido: vencidas,
        em_risco_de_vencimento: emRisco,
        margem_incerteza_divergencia: margem,
        util,
      },
      lotes_em_risco_de_vencimento: lotesEmRisco,
      justificativas,
      custo_referencia_brl: custoReferencia,
      preco_referencia_brl: null,
      fonte_preco_referencia: null,
      fornecedor_recomendado: null,
      alternativas_fornecedor: [],
      fornecedores_excluidos: [],
      motivo_sem_fornecedor: null,
      justificativa_fornecedor: [],
      fatores_decisao: [],
      por_que_nao_o_mais_barato: null,
      justificativa_quantidade: [],
      consumo: consumoHistorico,
      qualidade_dados: qualidadeDados,
      faixa_quantidade: faixaQuantidade,
      rastreabilidade,
      impacto: {
        capital_imobilizado_brl: 0,
        capital_excedente_brl: 0,
        perdas_evitadas: { vencimento: { unidades: 0, valor_brl: 0 }, falta: { unidades: 0, valor_brl: 0 } },
        simulacao_30_dias: {
          sem_acao: { dias_sem_estoque: 0, unidades_sem_estoque: 0, unidades_vencidas: 0, capital_medio_parado_brl: 0 },
          com_recomendacao: { dias_sem_estoque: 0, unidades_sem_estoque: 0, unidades_vencidas: 0, capital_medio_parado_brl: 0 },
          pontos_diarios: [],
          premissas: [],
        },
      },
      previsao: {
        data_prevista_ruptura: null,
        data_limite_pedido: null,
        pedido_atrasado: false,
        dias_atraso: null,
        dias_sem_estoque_previstos: null,
        perda_prevista_por_vencimento: { unidades: emRisco, valor_brl: emRisco * item.custo_unitario_brl },
        perda_por_invalidacao_termica: { unidades: invalidadas, valor_brl: invalidadas * item.custo_unitario_brl },
        custo_de_esperar: { valor_brl: null, dias_sem_estoque: null, atraso_simulado_dias: DIAS_ADIAMENTO_SIMULACAO },
        premissas: [],
      },
    });
  }

  const ordenadas = recs.sort(
    (a, b) => RANK[a.urgencia] - RANK[b.urgencia] || b.custo_estimado_brl - a.custo_estimado_brl
  );

  return ordenadas.map((recomendacao) => {
    const item = estoque.itens.find((registro) => registro.id_medicamento === recomendacao.id_medicamento);
    if (!item) return recomendacao;
    const consumoHistorico = recomendacao.consumo;
    const qualidadeDados = recomendacao.qualidade_dados;
    const consumoUsado = consumoHistorico.consumo_usado;
    const faixaQuantidade = recomendacao.faixa_quantidade;
    const quantidadeBase = recomendacao.recomendar_compra
      ? Math.max(0, Math.ceil(consumoUsado * (recomendacao.prazo_reposicao_dias + HORIZONTE_COBERTURA_DIAS + item.estoque_seguranca_dias) - recomendacao.estoque.util))
      : 0;

    const referencia = dadosFornecedores.referencias_preco.find((registro) => registro.id_medicamento === recomendacao.id_medicamento);
    const selecao = recomendacao.recomendar_compra
      ? escolherFornecedor({
          id_medicamento: recomendacao.id_medicamento,
          urgencia: recomendacao.urgencia,
          quantidade_sugerida: recomendacao.quantidade_sugerida,
          validade_minima_exigida_dias: recomendacao.validade_minima_exigida_dias,
          cobertura_dias: recomendacao.cobertura_dias,
          prazo_reposicao_dias: recomendacao.prazo_reposicao_dias,
          estoque: recomendacao.estoque,
          consumo_medio_diario: consumoUsado,
          custo_referencia_brl: recomendacao.custo_referencia_brl,
          referenciaMs: refMs,
        }, dadosFornecedores)
      : {
          fornecedor_recomendado: null,
          alternativas_fornecedor: [],
          fornecedores_excluidos: [],
          motivo_sem_fornecedor: null,
          justificativa_fornecedor: [],
          fatores_decisao: [],
          por_que_nao_o_mais_barato: null,
          custo_estimado_brl: 0,
        };

    const diasCobertura = recomendacao.cobertura_dias;
    const dataRupturaMs = diasCobertura === null ? null : refMs + diasCobertura * MS_DIA;
    const dataLimiteMs = dataRupturaMs === null ? null : dataRupturaMs - recomendacao.prazo_reposicao_dias * MS_DIA;
    const diasAtraso = dataLimiteMs === null ? null : Math.max(0, Math.ceil((refMs - dataLimiteMs) / MS_DIA));
    const prazoSelecionado = selecao.fornecedor_recomendado?.prazo_entrega_dias ?? recomendacao.prazo_reposicao_dias;
    const diasSemEstoque = diasCobertura === null ? null : Math.max(0, prazoSelecionado - diasCobertura);
    const diasSemEstoqueEsperando = diasCobertura === null
      ? null
      : Math.max(0, DIAS_ADIAMENTO_SIMULACAO + recomendacao.prazo_reposicao_dias - diasCobertura);
    const unidadesSemEstoqueEsperando = diasSemEstoqueEsperando === null
      ? null
      : Math.ceil(consumoUsado * diasSemEstoqueEsperando);
    const quantidadeAlvo = consumoUsado * (
      recomendacao.prazo_reposicao_dias + HORIZONTE_COBERTURA_DIAS + item.estoque_seguranca_dias
    );
    const justificativaQuantidade = [
      `Consumo usado: ${consumoUsado} un./dia (${consumoHistorico.tendencia.toLowerCase().replace("_", " ")}).`,
      `Prazo de reposição: ${recomendacao.prazo_reposicao_dias} dias.`,
      `Horizonte de cobertura: ${HORIZONTE_COBERTURA_DIAS} dias.`,
      `Estoque de segurança: ${item.estoque_seguranca_dias} dias.`,
      `Estoque útil informado pelo cálculo FEFO: ${recomendacao.estoque.util} un.`,
      `Demanda alvo = ${consumoUsado} × (${recomendacao.prazo_reposicao_dias} + ${HORIZONTE_COBERTURA_DIAS} + ${item.estoque_seguranca_dias}) = ${arred(quantidadeAlvo)} un.`,
      `Quantidade base = max(0, ceil(${arred(quantidadeAlvo)} − ${recomendacao.estoque.util})) = ${quantidadeBase} un.`,
      ...(faixaQuantidade ? [`Confiança baixa: faixa de ${faixaQuantidade.minimo}–${faixaQuantidade.maximo} un.; foi usada a conservadora (${faixaQuantidade.conservadora} un.).`] : []),
    ];
    const previsao = {
      data_prevista_ruptura: dataRupturaMs === null ? null : new Date(dataRupturaMs).toISOString(),
      data_limite_pedido: dataLimiteMs === null ? null : new Date(dataLimiteMs).toISOString(),
      pedido_atrasado: dataLimiteMs !== null && dataLimiteMs < refMs,
      dias_atraso: diasAtraso,
      dias_sem_estoque_previstos: diasSemEstoque,
      perda_prevista_por_vencimento: recomendacao.previsao.perda_prevista_por_vencimento,
      perda_por_invalidacao_termica: recomendacao.previsao.perda_por_invalidacao_termica,
      custo_de_esperar: {
        valor_brl: unidadesSemEstoqueEsperando === null ? null : unidadesSemEstoqueEsperando * item.custo_unitario_brl,
        dias_sem_estoque: diasSemEstoqueEsperando,
        atraso_simulado_dias: DIAS_ADIAMENTO_SIMULACAO,
      },
      premissas: [
        `A previsão usa consumo ${consumoHistorico.usou_fallback ? "de fallback" : "calculado do histórico"} de ${consumoUsado} un./dia.`,
        "A data de ruptura usa a cobertura útil retornada pelo cálculo FEFO.",
        `Custo de esperar simula adiamento de ${DIAS_ADIAMENTO_SIMULACAO} dias e precifica unidades projetadas sem estoque pelo custo unitário do arquivo de estoque.`,
        "Perdas por vencimento e invalidação térmica usam os campos calculados pelo motor e custo unitário do arquivo de estoque.",
      ],
    };

    const enriquecida: RecomendacaoCompra = {
      ...recomendacao,
      custo_estimado_brl: selecao.custo_estimado_brl,
      preco_referencia_brl: referencia?.preco_referencia_brl ?? null,
      fonte_preco_referencia: referencia?.fonte ?? null,
      fornecedor_recomendado: selecao.fornecedor_recomendado,
      alternativas_fornecedor: selecao.alternativas_fornecedor,
      fornecedores_excluidos: selecao.fornecedores_excluidos,
      motivo_sem_fornecedor: selecao.motivo_sem_fornecedor,
      justificativa_fornecedor: selecao.justificativa_fornecedor,
      fatores_decisao: selecao.fatores_decisao,
      por_que_nao_o_mais_barato: selecao.por_que_nao_o_mais_barato,
      justificativa_quantidade: justificativaQuantidade,
      previsao,
      consumo: consumoHistorico,
      qualidade_dados: qualidadeDados,
      faixa_quantidade: faixaQuantidade,
      rastreabilidade: recomendacao.rastreabilidade,
    };
    return { ...enriquecida, impacto: calcularImpacto(enriquecida, item, consumoUsado, refMs) };
  });
}

// ============================================================
// Orquestração
// ============================================================
export function executarAnalise(
  bulas: Bula[],
  logs: LogHardware[],
  estoque: EstoqueCofre,
  refMs: number,
  dadosFornecedores: DadosFornecedores = { referencias_preco: [], fornecedores: [] },
  movimentacoes: Movimentacao[] = []
): AnaliseResponse {
  const termico = analisarRiscoTermico(logs, bulas, estoque, refMs);
  const mov = detectarMovimentacaoNaoIdentificada(logs);
  const recomendacoes = gerarRecomendacoes(bulas, estoque, termico.avaliacoes, mov.alertas.length, refMs, dadosFornecedores, movimentacoes);

  const lotesInvalidados = soma(termico.alertas.map((a) => a.lotes_invalidados.length));
  const unidadesInvalidadas = soma(termico.alertas.map((a) => a.unidades_invalidadas));
  const comCompra = recomendacoes.filter((r) => r.recomendar_compra);
  const totalAlertas = termico.alertas.length + mov.alertas.length;

  return {
    meta: {
      gerado_em: new Date().toISOString(),
      data_referencia: new Date(refMs).toISOString(),
      cofre_id: estoque.cofre_id,
      total_eventos_analisados: logs.length,
      ciclos_porta_analisados: mov.ciclos,
      porta_atualmente_aberta: mov.portaAbertaAgora,
      versao_regras: "poc-1.1",
    },
    resumo: {
      status_geral: termico.alertas.length > 0 ? "CRITICO" : totalAlertas > 0 || comCompra.length > 0 ? "ATENCAO" : "NORMAL",
      total_alertas: totalAlertas,
      lotes_invalidados: lotesInvalidados,
      unidades_invalidadas: unidadesInvalidadas,
      divergencias_estoque: mov.alertas.length,
      divergencias_lote: recomendacoes.reduce((total, recomendacao) => total + recomendacao.rastreabilidade.divergencias_lote_abertas, 0),
      saidas_sem_lote_nao_atribuidas: recomendacoes.reduce((total, recomendacao) => total + recomendacao.rastreabilidade.saidas_sem_lote_nao_atribuidas, 0),
      medicamentos_com_compra_recomendada: comCompra.length,
      custo_total_recomendado_brl: soma(comCompra.map((r) => r.custo_estimado_brl)),
      proxima_ruptura: recomendacoes
        .map((recomendacao) => recomendacao.previsao.data_prevista_ruptura)
        .filter((data): data is string => data !== null)
        .sort((left, right) => Date.parse(left) - Date.parse(right))[0] ?? null,
    },
    alertas: {
      risco_termico: termico.alertas,
      movimentacao_nao_identificada: mov.alertas,
    },
    avaliacoes_termicas: termico.avaliacoes,
    recomendacoes_compra: recomendacoes,
  };
}