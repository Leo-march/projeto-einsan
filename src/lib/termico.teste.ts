import { describe, expect, it } from "vitest";
import { analisarRiscoTermico } from "./analise";
import { loteInvalidadoTermicamente, montarVisaoEstoque, reconstruirEstoque, validarNovaMovimentacao } from "./estoque";
import type { Bula, LogHardware, MovimentacaoEstoque, ParametrosCofre } from "@/types/dominio";

const bulas: Bula[] = [{ id_medicamento: "MED-001", nome: "Humira", temp_min_celsius: 2, temp_max_celsius: 8, alerta_exposicao_minutos: 30 }];
const parametros = {
  cofre_id: "COFRE-01",
  itens: [{ id_medicamento: "MED-001", custo_unitario_brl: 10, consumo_medio_diario: 1, prazo_reposicao_dias: 5, estoque_seguranca_dias: 2 }],
} as unknown as ParametrosCofre;

const leitura = (hora: string, t: number): LogHardware =>
  ({ id_evento: hora, cofre_id: "COFRE-01", timestamp: `2026-11-14T${hora}:00-03:00`, tipo: "LEITURA_TEMPERATURA", temperatura_celsius: t }) as LogHardware;

// Excursão de 14:10 a 15:00 (50 min > limite de 30 min)
const logs: LogHardware[] = [
  leitura("14:00", 5), leitura("14:10", 9), leitura("14:20", 11), leitura("14:30", 12),
  leitura("14:40", 12), leitura("14:50", 9), leitura("15:00", 6), leitura("15:05", 5),
];

const entrada = (lote: string, hora: string): MovimentacaoEstoque =>
  ({
    id_movimentacao: `MOV-${lote}-${hora}`, cofre_id: "COFRE-01", timestamp: `2026-11-14T${hora}:00-03:00`, tipo: "ENTRADA_COMPRA",
    id_medicamento: "MED-001", codigo_lote: lote, quantidade: 10, validade: "2027-12-31", origem_registro: "MANUAL",
  }) as MovimentacaoEstoque;

function status(movs: MovimentacaoEstoque[], refIso = "2026-11-14T15:05:00-03:00") {
  const ref = Date.parse(refIso);
  const { estoque } = reconstruirEstoque(movs, parametros, ref);
  const { avaliacoes } = analisarRiscoTermico(logs, bulas, estoque, ref);
  const visao = montarVisaoEstoque(estoque, bulas, avaliacoes, ref);
  return {
    avaliacoes,
    lotes: Object.fromEntries(visao.itens[0].lotes.map((l) => [l.codigo_lote, l.status])),
    recebimentos: visao.itens[0].lotes,
  };
}

describe("invalidação térmica por lote", () => {
  it("invalida lote que estava no cofre durante a excursão", () => {
    const r = status([entrada("ANTIGO", "10:00")]);
    expect(r.avaliacoes[0].status).toBe("LOTES_INVALIDADOS");
    expect(r.lotes.ANTIGO).toBe("INVALIDADO_TERMICO");
  });

  it("NÃO invalida lote que entrou depois do retorno à faixa", () => {
    const r = status([entrada("ANTIGO", "10:00"), entrada("NOVO", "15:05")]);
    expect(r.lotes.ANTIGO).toBe("INVALIDADO_TERMICO");
    expect(r.lotes.NOVO).toBe("OK");
  });

  it("separa recebimentos do mesmo código e mantém o novo saldo no prazo", () => {
    const antigo = entrada("REPETIDO", "10:00");
    const novo = entrada("REPETIDO", "15:05");
    const saidaDoNovo: MovimentacaoEstoque = {
      ...entrada("REPETIDO", "15:06"),
      tipo: "SAIDA_DISPENSACAO",
      id_recebimento: novo.id_movimentacao,
      timestamp: "2026-11-14T15:06:00-03:00",
      quantidade: 2,
      validade: undefined,
    };
    const r = status([antigo, novo, saidaDoNovo], "2026-11-14T15:06:00-03:00");
    const recebimentos = r.recebimentos.filter((l) => l.codigo_lote === "REPETIDO");

    expect(recebimentos).toHaveLength(2);
    expect(recebimentos.find((l) => l.id_recebimento === antigo.id_movimentacao)).toMatchObject({
      quantidade: 10,
      status: "INVALIDADO_TERMICO",
    });
    expect(recebimentos.find((l) => l.id_recebimento === novo.id_movimentacao)).toMatchObject({
      quantidade: 8,
      status: "OK",
    });
  });

  it("marca recebimento com validade passada como vencido, mesmo após a excursão", () => {
    const expirado = { ...entrada("EXPIRADO", "15:05"), validade: "2026-09-09" };
    const r = status([expirado]);

    expect(r.recebimentos[0]).toMatchObject({ status: "VENCIDO", validade: "2026-09-09" });
  });

  it("não marca como vencido um lote ainda válido durante o próprio dia de validade", () => {
    const venceHoje = { ...entrada("HOJE", "15:05"), validade: "2026-11-14" };

    expect(status([venceHoje]).recebimentos[0].status).toBe("VENCE_EM_30_DIAS");
  });

  it("exige o recebimento de origem ao registrar uma saída", () => {
    const recebimento = entrada("LOTE", "15:05");
    const { estoque } = reconstruirEstoque([recebimento], parametros, Date.parse("2026-11-14T15:05:00-03:00"));
    const semReferencia = validarNovaMovimentacao(
      { tipo: "SAIDA_DISPENSACAO", id_medicamento: "MED-001", codigo_lote: "LOTE", quantidade: 1 },
      parametros,
      estoque,
      new Date("2026-11-14T15:05:00-03:00")
    );
    const comReferencia = validarNovaMovimentacao(
      { tipo: "SAIDA_DISPENSACAO", id_medicamento: "MED-001", codigo_lote: "LOTE", quantidade: 1, id_recebimento: recebimento.id_movimentacao },
      parametros,
      estoque,
      new Date("2026-11-14T15:05:00-03:00")
    );

    expect(semReferencia).toMatchObject({ ok: false });
    expect(comReferencia).toMatchObject({ ok: true });
  });

  it("invalida lote que entrou durante a excursão", () => {
    expect(status([entrada("DURANTE", "14:30")]).lotes.DURANTE).toBe("INVALIDADO_TERMICO");
  });

  it("sem data de entrada, aplica o critério conservador", () => {
    const av = { status: "LOTES_INVALIDADOS" as const, excursao_em_andamento: false, fim_excursao: "2026-11-14T15:00:00-03:00" };
    expect(loteInvalidadoTermicamente(av, {})).toBe(true);
  });

  it("excursão em andamento invalida qualquer lote", () => {
    const av = { status: "LOTES_INVALIDADOS" as const, excursao_em_andamento: true, fim_excursao: null };
    expect(loteInvalidadoTermicamente(av, { primeira_entrada: "2030-01-01T00:00:00Z" })).toBe(true);
  });

  it("ignora leituras posteriores à data de referência", () => {
    const r = status([entrada("ANTIGO", "10:00")], "2026-11-14T14:00:00-03:00");
    expect(r.avaliacoes[0].minutos_fora_da_faixa).toBe(0);
    expect(r.lotes.ANTIGO).toBe("OK");
  });
});