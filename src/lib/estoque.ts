import type {
  AvaliacaoTermica,
  AvisoQualidade,
  Bula,
  EstoqueCofre,
  ItemEstoque,
  LogHardware,
  MovimentacaoComSaldo,
  MovimentacaoEstoque,
  ParametrosCofre,
  QualidadeDados,
  StatusLote,
  TipoMovimentacao,
  VisaoEstoque,
} from "@/types/dominio";

const MS_DIA = 86_400_000;
/** Janela usada para derivar o consumo a partir das dispensações */
export const JANELA_CONSUMO_DIAS = 30;

const SINAL: Record<TipoMovimentacao, 1 | -1> = {
  ENTRADA_COMPRA: 1,
  ENTRADA_TRANSFERENCIA: 1,
  SAIDA_DISPENSACAO: -1,
  SAIDA_TRANSFERENCIA: -1,
  SAIDA_DESCARTE: -1,
  AJUSTE_INVENTARIO: 1, // a quantidade já vem com sinal
};

const TIPOS = Object.keys(SINAL) as TipoMovimentacao[];
const ehEntrada = (t: TipoMovimentacao) => t === "ENTRADA_COMPRA" || t === "ENTRADA_TRANSFERENCIA";
const chaveLote = (m: { id_medicamento: string; codigo_lote: string }) => `${m.id_medicamento}|${m.codigo_lote}`;
const deltaMov = (m: MovimentacaoEstoque) => SINAL[m.tipo] * m.quantidade;
const soma = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const arred2 = (n: number) => Math.round(n * 100) / 100;
const fimDoDia = (validade: string) => Date.parse(`${validade}T23:59:59-03:00`);

// ============================================================
// Reconstrói o estoque por lote reproduzindo o livro de movimentações.
// O saldo NUNCA é um número digitado: é sempre a soma do histórico.
// ============================================================
export function reconstruirEstoque(
  movs: MovimentacaoEstoque[],
  parametros: ParametrosCofre,
  refMs: number
): { estoque: EstoqueCofre; qualidade: QualidadeDados } {
  const avisos: AvisoQualidade[] = [];
  const vistos = new Set<string>();
  const conhecidos = new Set(parametros.itens.map((p) => p.id_medicamento));
  const validas: { m: MovimentacaoEstoque; ms: number }[] = [];
  let ignoradas = 0;

  for (const m of movs) {
    if (vistos.has(m.id_movimentacao)) {
      ignoradas++;
      avisos.push({ codigo: "MOVIMENTACAO_DUPLICADA", severidade: "ATENCAO", mensagem: "Movimentação duplicada ignorada.", id_referencia: m.id_movimentacao });
      continue;
    }
    vistos.add(m.id_movimentacao);
    const ms = Date.parse(m.timestamp);
    if (Number.isNaN(ms)) {
      ignoradas++;
      avisos.push({ codigo: "TIMESTAMP_INVALIDO", severidade: "ATENCAO", mensagem: "Movimentação com data inválida ignorada.", id_referencia: m.id_movimentacao });
      continue;
    }
    if (ms > refMs) continue; // posterior à data de referência
    if (!conhecidos.has(m.id_medicamento)) {
      ignoradas++;
      avisos.push({ codigo: "MEDICAMENTO_DESCONHECIDO", severidade: "ATENCAO", mensagem: `Medicamento ${m.id_medicamento} sem parâmetros de reposição.`, id_referencia: m.id_movimentacao });
      continue;
    }
    validas.push({ m, ms });
  }
  validas.sort((a, b) => a.ms - b.ms);

  const lotes = new Map<string, { id_medicamento: string; codigo_lote: string; validade: string; saldo: number }>();
  const processadas: MovimentacaoEstoque[] = [];

  for (const { m } of validas) {
    const k = chaveLote(m);
    let lote = lotes.get(k);
    if (ehEntrada(m.tipo)) {
      if (!lote) {
        if (!m.validade) {
          ignoradas++;
          avisos.push({ codigo: "ENTRADA_SEM_VALIDADE", severidade: "ATENCAO", mensagem: `Entrada do lote ${m.codigo_lote} sem validade foi ignorada.`, id_referencia: m.id_movimentacao });
          continue;
        }
        lote = { id_medicamento: m.id_medicamento, codigo_lote: m.codigo_lote, validade: m.validade, saldo: 0 };
        lotes.set(k, lote);
      }
    } else if (!lote) {
      ignoradas++;
      avisos.push({ codigo: "LOTE_SEM_ENTRADA", severidade: "ATENCAO", mensagem: `Saída do lote ${m.codigo_lote} sem entrada registrada.`, id_referencia: m.id_movimentacao });
      continue;
    }
    lote.saldo += deltaMov(m);
    if (lote.saldo < 0) {
      avisos.push({ codigo: "SALDO_NEGATIVO", severidade: "ATENCAO", mensagem: `Saldo do lote ${m.codigo_lote} ficaria negativo; ajustado para 0. Há saída sem registro de entrada.`, id_referencia: m.id_movimentacao });
      lote.saldo = 0;
    }
    processadas.push(m);
  }

  // Consumo derivado SOMENTE de dispensações. Transferências, descartes e
  // ajustes não são demanda: separar isso evita ler movimentação atípica como consumo.
  const inicioJanela = refMs - JANELA_CONSUMO_DIAS * MS_DIA;
  const itens: ItemEstoque[] = parametros.itens.map((p) => {
    const doMed = processadas.filter((m) => m.id_medicamento === p.id_medicamento);
    const primeira = doMed.find((m) => ehEntrada(m.tipo));
    const diasHist = primeira ? (refMs - Date.parse(primeira.timestamp)) / MS_DIA : 0;
    const janela = Math.min(JANELA_CONSUMO_DIAS, Math.max(1, diasHist));
    const saidas = soma(
      doMed.filter((m) => m.tipo === "SAIDA_DISPENSACAO" && Date.parse(m.timestamp) >= inicioJanela).map((m) => m.quantidade)
    );
    if (primeira && diasHist < 14) {
      avisos.push({ codigo: "HISTORICO_CURTO", severidade: "INFO", mensagem: `${p.id_medicamento}: apenas ${Math.floor(diasHist)} dia(s) de histórico; o consumo estimado é pouco confiável.`, id_referencia: p.id_medicamento });
    }
    if (primeira && saidas === 0) {
      avisos.push({ codigo: "SEM_CONSUMO_NA_JANELA", severidade: "INFO", mensagem: `${p.id_medicamento}: nenhuma dispensação nos últimos ${JANELA_CONSUMO_DIAS} dias.`, id_referencia: p.id_medicamento });
    }
    return {
      ...p,
      consumo_medio_diario: arred2(saidas / janela),
      lotes: [...lotes.values()]
        .filter((l) => l.id_medicamento === p.id_medicamento && l.saldo > 0)
        .map((l) => ({ codigo_lote: l.codigo_lote, quantidade: l.saldo, validade: l.validade })),
    };
  });

  const manuais = processadas.filter((m) => m.origem_registro === "MANUAL").length;
  return {
    estoque: { cofre_id: parametros.cofre_id, itens },
    qualidade: {
      movimentacoes_processadas: processadas.length,
      movimentacoes_ignoradas: ignoradas,
      percentual_lancamento_manual: processadas.length ? Math.round((manuais / processadas.length) * 100) : 0,
      avisos,
    },
  };
}

// ============================================================
// Conciliação hardware x livro: bipagem sem baixa correspondente
// ============================================================
export function conciliarScanner(logs: LogHardware[], movs: MovimentacaoEstoque[]): AvisoQualidade[] {
  const baixas = new Set(movs.flatMap((m) => (m.ref_evento_hardware ? [m.ref_evento_hardware] : [])));
  return logs
    .filter((l) => l.tipo === "LEITURA_SCANNER" && !baixas.has(l.id_evento))
    .map((l) => ({
      codigo: "BIPAGEM_SEM_BAIXA" as const,
      severidade: "ATENCAO" as const,
      mensagem: `Leitura do scanner (${l.codigo_lote ?? "lote n/d"}) sem baixa correspondente no livro de estoque.`,
      id_referencia: l.id_evento,
    }));
}

// ============================================================
// Rastreabilidade: histórico com saldo do lote após cada movimento
// ============================================================
export function listarMovimentacoes(
  movs: MovimentacaoEstoque[],
  f: { id_medicamento?: string; codigo_lote?: string; tipo?: string; limite?: number } = {}
): MovimentacaoComSaldo[] {
  const saldos = new Map<string, number>();
  const comSaldo = movs
    .filter((m) => !Number.isNaN(Date.parse(m.timestamp)))
    .sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp))
    .map((m) => {
      const k = chaveLote(m);
      const s = Math.max(0, (saldos.get(k) ?? 0) + deltaMov(m));
      saldos.set(k, s);
      return { ...m, saldo_lote_apos: s };
    });

  return comSaldo
    .filter(
      (m) =>
        (!f.id_medicamento || m.id_medicamento === f.id_medicamento) &&
        (!f.codigo_lote || m.codigo_lote === f.codigo_lote) &&
        (!f.tipo || m.tipo === f.tipo)
    )
    .reverse() // mais recentes primeiro
    .slice(0, f.limite && f.limite > 0 ? f.limite : 100);
}

// ============================================================
// Visão de estoque para o front (saldo por lote + status)
// ============================================================
export function montarVisaoEstoque(
  estoque: EstoqueCofre,
  bulas: Bula[],
  avaliacoes: AvaliacaoTermica[],
  refMs: number
): VisaoEstoque {
  const itens = estoque.itens.map((item) => {
    const invalidado = avaliacoes.find((a) => a.id_medicamento === item.id_medicamento)?.status === "LOTES_INVALIDADOS";
    const lotes = item.lotes
      .map((l) => {
        const dias = Math.floor((fimDoDia(l.validade) - refMs) / MS_DIA);
        const status: StatusLote = invalidado ? "INVALIDADO_TERMICO" : dias <= 0 ? "VENCIDO" : dias <= 30 ? "VENCE_EM_30_DIAS" : "OK";
        return { codigo_lote: l.codigo_lote, quantidade: l.quantidade, validade: l.validade, dias_para_vencer: dias, status };
      })
      .sort((a, b) => a.dias_para_vencer - b.dias_para_vencer);
    const saldo = soma(lotes.map((l) => l.quantidade));
    return {
      id_medicamento: item.id_medicamento,
      nome: bulas.find((b) => b.id_medicamento === item.id_medicamento)?.nome ?? item.id_medicamento,
      saldo_registrado: saldo,
      valor_imobilizado_brl: saldo * item.custo_unitario_brl,
      consumo_medio_diario: item.consumo_medio_diario,
      lotes,
    };
  });
  return {
    itens,
    totais: {
      unidades: soma(itens.map((i) => i.saldo_registrado)),
      valor_imobilizado_brl: soma(itens.map((i) => i.valor_imobilizado_brl)),
      lotes_em_alerta: soma(itens.map((i) => i.lotes.filter((l) => l.status !== "OK").length)),
    },
  };
}

// ============================================================
// Validação de novo lançamento (usada pelo POST /api/movimentacoes)
// ============================================================
export function validarNovaMovimentacao(
  body: unknown,
  parametros: ParametrosCofre,
  estoqueTotal: EstoqueCofre,
  agora: Date
): { ok: true; movimentacao: MovimentacaoEstoque } | { ok: false; erros: string[] } {
  const b = (typeof body === "object" && body !== null ? body : {}) as Record<string, unknown>;
  const erros: string[] = [];

  const tipo = b.tipo as TipoMovimentacao;
  if (!TIPOS.includes(tipo)) erros.push(`tipo inválido. Use: ${TIPOS.join(", ")}.`);

  const id_medicamento = String(b.id_medicamento ?? "");
  if (!parametros.itens.some((p) => p.id_medicamento === id_medicamento)) erros.push("id_medicamento desconhecido.");

  const codigo_lote = String(b.codigo_lote ?? "").trim();
  if (!codigo_lote) erros.push("codigo_lote é obrigatório.");

  const quantidade = Number(b.quantidade);
  if (!Number.isInteger(quantidade) || quantidade === 0 || (tipo !== "AJUSTE_INVENTARIO" && quantidade < 0)) {
    erros.push("quantidade deve ser um inteiro positivo (ajuste de inventário aceita negativo).");
  }

  const loteAtual = estoqueTotal.itens.find((i) => i.id_medicamento === id_medicamento)?.lotes.find((l) => l.codigo_lote === codigo_lote);
  const validade = typeof b.validade === "string" ? b.validade : undefined;

  if (TIPOS.includes(tipo) && ehEntrada(tipo)) {
    if (!loteAtual && !(validade && /^\d{4}-\d{2}-\d{2}$/.test(validade) && !Number.isNaN(Date.parse(validade)))) {
      erros.push("validade (YYYY-MM-DD) é obrigatória na primeira entrada de um lote.");
    }
  } else if (TIPOS.includes(tipo) && Number.isInteger(quantidade)) {
    const retirada = tipo === "AJUSTE_INVENTARIO" ? (quantidade < 0 ? -quantidade : 0) : quantidade;
    if (retirada > 0 && (loteAtual?.quantidade ?? 0) < retirada) {
      erros.push(`saldo insuficiente no lote ${codigo_lote} (disponível: ${loteAtual?.quantidade ?? 0}).`);
    }
  }

  const timestamp = typeof b.timestamp === "string" && !Number.isNaN(Date.parse(b.timestamp)) ? b.timestamp : agora.toISOString();
  const origem = ["SCANNER", "MANUAL", "INTEGRACAO_NF"].includes(String(b.origem_registro)) ? (b.origem_registro as MovimentacaoEstoque["origem_registro"]) : "MANUAL";

  if (erros.length) return { ok: false, erros };

  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : undefined);
  return {
    ok: true,
    movimentacao: {
      id_movimentacao: `MOV-${agora.getTime()}`,
      cofre_id: parametros.cofre_id,
      timestamp,
      tipo,
      id_medicamento,
      codigo_lote,
      quantidade,
      validade,
      contraparte: str(b.contraparte),
      documento: str(b.documento),
      usuario_id: str(b.usuario_id),
      origem_registro: origem,
      ref_evento_hardware: str(b.ref_evento_hardware),
      observacao: str(b.observacao),
    },
  };
}