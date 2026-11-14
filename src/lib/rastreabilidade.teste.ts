import { describe, expect, it } from "vitest";
import { reconstruirRastreabilidade } from "./rastreabilidade";
import type { EstoqueCofre, Movimentacao } from "@/types/dominio";

const estoque: EstoqueCofre = {
  cofre_id: "COFRE-01",
  itens: [{
    id_medicamento: "MED-TESTE",
    custo_unitario_brl: 100,
    consumo_medio_diario: 1,
    prazo_reposicao_dias: 2,
    estoque_seguranca_dias: 1,
    lotes: [{ codigo_lote: "LOT-1", id_recebimento: "REC-1", primeira_entrada: "2026-10-01T10:00:00Z", quantidade: 5, validade: "2027-01-01" }],
  }],
};

const movimentos: Movimentacao[] = [
  { id_movimento: "M-1", timestamp: "2026-10-01T10:00:00Z", cofre_id: "COFRE-01", tipo: "ENTRADA", id_medicamento: "MED-TESTE", codigo_lote: "LOT-1", quantidade: 10, origem_registro: "SCANNER", usuario_biometria_id: "USR-SIM-01" },
  { id_movimento: "M-2", timestamp: "2026-10-02T10:00:00Z", cofre_id: "COFRE-01", tipo: "SAIDA", id_medicamento: "MED-TESTE", codigo_lote: "LOT-1", quantidade: 4, origem_registro: "SCANNER", usuario_biometria_id: "USR-SIM-02" },
  { id_movimento: "M-3", timestamp: "2026-10-03T10:00:00Z", cofre_id: "COFRE-01", tipo: "TRANSFERENCIA", id_medicamento: "MED-TESTE", codigo_lote: "LOT-1", quantidade: 1, origem_registro: "MANUAL", usuario_biometria_id: "USR-SIM-02", sentido_transferencia: "SAIDA" },
  { id_movimento: "M-4", timestamp: "2026-10-04T10:00:00Z", cofre_id: "COFRE-01", tipo: "AJUSTE", id_medicamento: "MED-TESTE", codigo_lote: "LOT-1", quantidade: 0, origem_registro: "MANUAL", usuario_biometria_id: "USR-SIM-03" },
  { id_movimento: "M-5", timestamp: "2026-10-05T10:00:00Z", cofre_id: "COFRE-01", tipo: "SAIDA", id_medicamento: "MED-TESTE", codigo_lote: null, quantidade: 3, origem_registro: "SEM_LEITURA", usuario_biometria_id: "USR-SIM-04" },
];

describe("reconstruirRastreabilidade", () => {
  it("reconcilia o saldo por lote e adiciona saídas sem lote à incerteza", () => {
    const resultado = reconstruirRastreabilidade(estoque, movimentos, [], Date.parse("2026-11-14T12:00:00Z"), 1)["MED-TESTE"];

    expect(resultado.lotes[0].saldo_reconstruido).toBe(5);
    expect(resultado.lotes[0].divergencia_unidades).toBe(0);
    expect(resultado.saidas_sem_lote_nao_atribuidas).toBe(3);
    expect(resultado.margem_incerteza_unidades).toBe(3);
    expect(resultado.lotes[0].eventos.map((evento) => evento.tipo)).toContain("VALIDADE");
  });

  it("usa margem legada apenas quando não há dados de movimentação", () => {
    const resultado = reconstruirRastreabilidade(estoque, [], [], Date.parse("2026-11-14T12:00:00Z"), 2)["MED-TESTE"];

    expect(resultado.dados_lote_disponiveis).toBe(false);
    expect(resultado.margem_incerteza_unidades).toBe(2);
  });
});