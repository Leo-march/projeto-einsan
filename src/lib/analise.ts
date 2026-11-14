import type {
  AlertaMovimentacaoNaoIdentificada,
  AlertaRiscoTermico,
  AnaliseResponse,
  AvaliacaoTermica,
  Bula,
  EstoqueCofre,
  LogHardware,
  RecomendacaoCompra,
  Severidade,
  AcaoCompra,
  MovimentacaoEstoque,
  ParametrosCofre,
} from "@/types/dominio";
import { conciliarScanner, reconstruirEstoque } from "@/lib/estoque";

// ---------- Parâmetros do motor (ajustáveis na PoC) ----------
const MS_MIN = 60_000;
const MS_DIA = 86_400_000;
/** Por quantos dias a compra deve cobrir a demanda após a chegada do pedido */
const HORIZONTE_COBERTURA_DIAS = 30;
/** Unidades presumidamente retiradas sem bipagem, por divergência detectada */
const MARGEM_INCERTEZA_POR_DIVERGENCIA = 1;

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
// Regra 2: Movimentação Não Identificada (conciliada com o livro de estoque)
// ============================================================
/** Saída lançada manualmente até X min após o fechamento "regulariza" o ciclo */
const TOLERANCIA_REGULARIZACAO_MS = 30 * MS_MIN;

export function detectarMovimentacaoNaoIdentificada(logs: LogHardware[], movs: MovimentacaoEstoque[] = []) {
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
        const abertaMs = Date.parse(aberta.timestamp);
        const fechadaMs = Date.parse(ev.timestamp);
        const duracao = Math.round((fechadaMs - abertaMs) / 1000);
        const regularizada = movs.some((m) => {
          const t = Date.parse(m.timestamp);
          return m.origem_registro === "MANUAL" && m.tipo.startsWith("SAIDA") && t >= abertaMs && t <= fechadaMs + TOLERANCIA_REGULARIZACAO_MS;
        });
        alertas.push({
          tipo: "DIVERGENCIA_ESTOQUE",
          severidade: "ALTA",
          porta_aberta_em: aberta.timestamp,
          porta_fechada_em: ev.timestamp,
          duracao_segundos: duracao,
          usuario_biometria_id: aberta.usuario_biometria_id ?? null,
          regularizada_por_lancamento_manual: regularizada,
          mensagem: regularizada
            ? "Porta aberta e fechada sem leitura do scanner, mas há saída lançada manualmente no período. Conferir o lote informado."
            : "Divergência de Estoque / Retirada não identificada: a porta foi aberta " +
              `e fechada (${Math.round(duracao / 60)} min) sem nenhuma leitura do scanner e sem baixa no livro de estoque.`,
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
  refMs: number
): RecomendacaoCompra[] {
  const recs: RecomendacaoCompra[] = [];

  for (const item of estoque.itens) {
    const bula = bulas.find((b) => b.id_medicamento === item.id_medicamento);
    const nome = bula?.nome ?? item.id_medicamento;
    const invalidadoTermico =
      avaliacoes.find((a) => a.id_medicamento === item.id_medicamento)?.status === "LOTES_INVALIDADOS";

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
    let consumidoAcum = 0;
    let usaveis = 0;
    let emRisco = 0;
    const lotesEmRisco: string[] = [];

    for (const l of validos) {
      const capacidade = item.consumo_medio_diario > 0 ? item.consumo_medio_diario * l.dias : Infinity;
      const disponivel = Math.max(0, Math.floor(capacidade - consumidoAcum));
      const usavel = Math.min(l.quantidade, disponivel);
      consumidoAcum += usavel;
      usaveis += usavel;
      if (usavel < l.quantidade) {
        emRisco += l.quantidade - usavel;
        lotesEmRisco.push(l.codigo_lote);
      }
    }

    const margem = totalDivergencias * MARGEM_INCERTEZA_POR_DIVERGENCIA;
    const util = Math.max(0, usaveis - margem);

    const consumo = item.consumo_medio_diario;
    const cobertura = consumo > 0 ? arred(util / consumo) : null;
    const lead = item.prazo_reposicao_dias;

    let urgencia: Severidade = "BAIXA";
    if (cobertura !== null) {
      if (cobertura <= lead) urgencia = "CRITICA";
      else if (cobertura <= lead * 2) urgencia = "ALTA";
      else if (cobertura <= lead * 3) urgencia = "MEDIA";
    }

    const recomendar = urgencia !== "BAIXA";
    const demandaAlvo = consumo * (lead + HORIZONTE_COBERTURA_DIAS + item.estoque_seguranca_dias);
    const quantidade = recomendar ? Math.max(0, Math.ceil(demandaAlvo - util)) : 0;

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
        : `Cobertura útil de ${cobertura} dia(s) vs. prazo de reposição de ${lead} dia(s).`
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
    });
  }

  return recs.sort(
    (a, b) => RANK[a.urgencia] - RANK[b.urgencia] || b.custo_estimado_brl - a.custo_estimado_brl
  );
}

// ============================================================
// Orquestração
// ============================================================
export function executarAnalise(
  bulas: Bula[],
  logs: LogHardware[],
  movs: MovimentacaoEstoque[],
  parametros: ParametrosCofre,
  refMs: number
): AnaliseResponse {
  // O estoque é reconstruído do livro de movimentações (entradas, saídas, transferências).
  const { estoque, qualidade } = reconstruirEstoque(movs, parametros, refMs);
  const termico = analisarRiscoTermico(logs, bulas, estoque, refMs);
  const mov = detectarMovimentacaoNaoIdentificada(logs, movs);
  // Só divergências NÃO regularizadas reduzem o estoque útil.
  const divergenciasAbertas = mov.alertas.filter((a) => !a.regularizada_por_lancamento_manual).length;
  const recomendacoes = gerarRecomendacoes(bulas, estoque, termico.avaliacoes, divergenciasAbertas, refMs);
  qualidade.avisos.push(...conciliarScanner(logs, movs));

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
      medicamentos_com_compra_recomendada: comCompra.length,
      custo_total_recomendado_brl: soma(comCompra.map((r) => r.custo_estimado_brl)),
    },
    alertas: {
      risco_termico: termico.alertas,
      movimentacao_nao_identificada: mov.alertas,
    },
    avaliacoes_termicas: termico.avaliacoes,
    recomendacoes_compra: recomendacoes,
    qualidade_dados: qualidade,
  };
}