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
const validadeValida = (validade: unknown): validade is string =>
  typeof validade === "string" &&
  /^\d{4}-\d{2}-\d{2}$/.test(validade) &&
  !Number.isNaN(Date.parse(`${validade}T00:00:00Z`)) &&
  new Date(`${validade}T00:00:00Z`).toISOString().slice(0, 10) === validade;
type LoteReconstruido = {
  id_medicamento: string;
  codigo_lote: string;
  id_recebimento: string;
  validade: string;
  saldo: number;
  entrada_ms: number;
};

// ============================================================
// Invalidação térmica POR LOTE.
// A excursão invalida apenas os lotes que estavam no cofre enquanto ela
// acontecia. Lote que entrou depois do retorno à faixa não foi exposto.
// ============================================================
export function loteInvalidadoTermicamente(
  avaliacao: Pick<AvaliacaoTermica, "status" | "excursao_em_andamento" | "fim_excursao"> | undefined,
  lote: { primeira_entrada?: string }
): boolean {
  if (!avaliacao || avaliacao.status !== "LOTES_INVALIDADOS") return false;
  if (avaliacao.excursao_em_andamento || !avaliacao.fim_excursao) return true;
  if (!lote.primeira_entrada) return true; // sem data de entrada: critério conservador
  return Date.parse(lote.primeira_entrada) <= Date.parse(avaliacao.fim_excursao);
}

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

  const lotes = new Map<string, LoteReconstruido>();
  const lotesPorCodigo = new Map<string, LoteReconstruido[]>();
  const processadas: MovimentacaoEstoque[] = [];

  for (const { m, ms } of validas) {
    const k = chaveLote(m);
    if (ehEntrada(m.tipo)) {
      if (!validadeValida(m.validade)) {
        ignoradas++;
        avisos.push({ codigo: "ENTRADA_SEM_VALIDADE", severidade: "ATENCAO", mensagem: `Entrada do lote ${m.codigo_lote} sem validade válida foi ignorada.`, id_referencia: m.id_movimentacao });
        continue;
      }
      const lote: LoteReconstruido = {
        id_medicamento: m.id_medicamento,
        codigo_lote: m.codigo_lote,
        id_recebimento: m.id_movimentacao,
        validade: m.validade,
        saldo: m.quantidade,
        entrada_ms: ms,
      };
      lotes.set(`${k}|${lote.id_recebimento}`, lote);
      const doCodigo = lotesPorCodigo.get(k) ?? [];
      doCodigo.push(lote);
      lotesPorCodigo.set(k, doCodigo);
    } else {
      const doCodigo = lotesPorCodigo.get(k) ?? [];
      const delta = deltaMov(m);
      const referenciado = m.id_recebimento
        ? doCodigo.find((l) => l.id_recebimento === m.id_recebimento)
        : undefined;
      const candidatos = referenciado
        ? [referenciado]
        : (delta > 0 ? doCodigo : doCodigo.filter((l) => l.saldo > 0)).sort((a, b) => a.entrada_ms - b.entrada_ms);

      if (!candidatos.length || (m.id_recebimento && !referenciado)) {
        ignoradas++;
        avisos.push({ codigo: "LOTE_SEM_ENTRADA", severidade: "ATENCAO", mensagem: `Saída do lote ${m.codigo_lote} sem recebimento correspondente.`, id_referencia: m.id_movimentacao });
        continue;
      }

      if (delta > 0) {
        const lote = referenciado ?? (candidatos.length === 1 ? candidatos[0] : undefined);
        if (!lote) {
          ignoradas++;
          avisos.push({ codigo: "LOTE_SEM_ENTRADA", severidade: "ATENCAO", mensagem: `Ajuste do lote ${m.codigo_lote} precisa identificar o recebimento.`, id_referencia: m.id_movimentacao });
          continue;
        }
        lote.saldo += delta;
      } else if (delta < 0) {
        let restante = -delta;
        for (const lote of candidatos) {
          const retirada = Math.min(lote.saldo, restante);
          lote.saldo -= retirada;
          restante -= retirada;
          if (restante <= 0) break;
        }
        if (restante > 0) {
          avisos.push({ codigo: "SALDO_NEGATIVO", severidade: "ATENCAO", mensagem: `Saldo do lote ${m.codigo_lote} ficaria negativo; ajustado para 0. Há saída sem registro de entrada.`, id_referencia: m.id_movimentacao });
        }
      }
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
    const diasComMovimento = new Set(
      doMed
        .filter((m) => m.tipo === "SAIDA_DISPENSACAO" && Date.parse(m.timestamp) >= inicioJanela)
        .map((m) => new Date(Date.parse(m.timestamp)).toISOString().slice(0, 10))
    ).size;
    if (primeira && diasHist < 14) {
      avisos.push({ codigo: "HISTORICO_CURTO", severidade: "INFO", mensagem: `${p.id_medicamento}: apenas ${Math.floor(diasHist)} dia(s) de histórico; o consumo estimado é pouco confiável.`, id_referencia: p.id_medicamento });
    }
    if (primeira && saidas === 0) {
      avisos.push({ codigo: "SEM_CONSUMO_NA_JANELA", severidade: "INFO", mensagem: `${p.id_medicamento}: nenhuma dispensação nos últimos ${JANELA_CONSUMO_DIAS} dias.`, id_referencia: p.id_medicamento });
    }
    return {
      ...p,
      consumo_medio_diario: Math.max(0, diasComMovimento > 0 ? Math.round(saidas / diasComMovimento) : 0),
      lotes: [...lotes.values()]
        .filter((l) => l.id_medicamento === p.id_medicamento && l.saldo > 0)
        .map((l) => ({
          codigo_lote: l.codigo_lote,
          id_recebimento: l.id_recebimento,
          quantidade: l.saldo,
          validade: l.validade,
          primeira_entrada: new Date(l.entrada_ms).toISOString(),
        })),
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
    const avaliacao = avaliacoes.find((a) => a.id_medicamento === item.id_medicamento);
    const lotes = item.lotes
      .map((l) => {
        const invalidado = loteInvalidadoTermicamente(avaliacao, l);
        const validadeFinal = fimDoDia(l.validade);
        const dias = Math.floor((validadeFinal - refMs) / MS_DIA);
        const status: StatusLote = invalidado ? "INVALIDADO_TERMICO" : validadeFinal < refMs ? "VENCIDO" : dias <= 30 ? "VENCE_EM_30_DIAS" : "OK";
        return {
          codigo_lote: l.codigo_lote,
          id_recebimento: l.id_recebimento,
          primeira_entrada: l.primeira_entrada,
          quantidade: l.quantidade,
          validade: l.validade,
          dias_para_vencer: dias,
          status,
        };
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

  const lotesDoCodigo = estoqueTotal.itens.find((i) => i.id_medicamento === id_medicamento)?.lotes.filter((l) => l.codigo_lote === codigo_lote) ?? [];
  const id_recebimento = typeof b.id_recebimento === "string" ? b.id_recebimento.trim() : "";
  const loteAtual = lotesDoCodigo.find((l) => l.id_recebimento === id_recebimento);
  const validade = typeof b.validade === "string" ? b.validade : undefined;
  const timestamp = typeof b.timestamp === "string" && !Number.isNaN(Date.parse(b.timestamp)) ? b.timestamp : agora.toISOString();

  if (TIPOS.includes(tipo) && ehEntrada(tipo)) {
    if (!validadeValida(validade)) {
      erros.push("validade válida (YYYY-MM-DD) é obrigatória em cada entrada.");
    }
  } else if (TIPOS.includes(tipo) && Number.isInteger(quantidade)) {
    if (!id_recebimento) erros.push("id_recebimento é obrigatório para identificar o saldo de origem.");
    if (id_recebimento && !loteAtual) erros.push("recebimento não encontrado para o lote informado.");
    if (loteAtual && Date.parse(timestamp) < Date.parse(loteAtual.primeira_entrada)) {
      erros.push("timestamp da movimentação não pode ser anterior ao recebimento de origem.");
    }
    const retirada = tipo === "AJUSTE_INVENTARIO" ? (quantidade < 0 ? -quantidade : 0) : quantidade;
    if (retirada > 0 && (loteAtual?.quantidade ?? 0) < retirada) {
      erros.push(`saldo insuficiente no lote ${codigo_lote} (disponível: ${loteAtual?.quantidade ?? 0}).`);
    }
  }

  const origem = ["SCANNER", "MANUAL", "INTEGRACAO_NF"].includes(String(b.origem_registro)) ? (b.origem_registro as MovimentacaoEstoque["origem_registro"]) : "MANUAL";

  if (erros.length) return { ok: false, erros };

  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : undefined);
  const id_movimentacao = `MOV-${agora.getTime()}`;
  return {
    ok: true,
    movimentacao: {
      id_movimentacao,
      cofre_id: parametros.cofre_id,
      timestamp,
      tipo,
      id_medicamento,
      codigo_lote,
      id_recebimento: ehEntrada(tipo) ? id_movimentacao : id_recebimento,
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