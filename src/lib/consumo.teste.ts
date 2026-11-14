import { describe, expect, it } from "vitest";
import { calcularConsumoEQualidade } from "./consumo";
import type { Movimentacao } from "@/types/dominio";

const referenciaMs = Date.parse("2026-11-14T18:05:00.000Z");
const MS_DIA = 86_400_000;

function saida(id: string, diasAtras: number, quantidade: number, codigoLote: string | null): Movimentacao {
  return {
    id_movimento: id,
    timestamp: new Date(referenciaMs - diasAtras * MS_DIA).toISOString(),
    cofre_id: "COFRE-01",
    tipo: "SAIDA",
    id_medicamento: "MED-TESTE",
    codigo_lote: codigoLote,
    quantidade,
    origem_registro: codigoLote === null ? "SEM_LEITURA" : "SCANNER",
    usuario_biometria_id: "USR-SIM-01",
  };
}

describe("calcularConsumoEQualidade", () => {
  it("usa fallback e reporta consumo zero quando não há saídas", () => {
    const resultado = calcularConsumoEQualidade("MED-TESTE", "COFRE-01", [], referenciaMs, 0, 0);

    expect(resultado.consumo.consumo_usado).toBe(0);
    expect(resultado.consumo.usou_fallback).toBe(true);
    expect(resultado.consumo.tendencia).toBe("SEM_HISTORICO");
    expect(resultado.qualidade.nivel_confianca).toBe("BAIXO");
  });

  it("usa o fallback quando o histórico tem poucas saídas", () => {
    const movimentos = [saida("S-1", 3, 1, "L-1"), saida("S-2", 8, 1, "L-1"), saida("S-3", 14, 1, "L-1")];
    const resultado = calcularConsumoEQualidade("MED-TESTE", "COFRE-01", movimentos, referenciaMs, 0.4, 0);

    expect(resultado.consumo.consumo_usado).toBe(0.4);
    expect(resultado.consumo.usou_fallback).toBe(true);
    expect(resultado.consumo.justificativa_fallback).toContain("3 saídas regulares");
  });

  it("exclui um pico isolado da projeção e reduz confiança para saída sem lote", () => {
    const movimentos = [
      saida("S-1", 25, 1, "L-1"),
      saida("S-2", 20, 1, "L-1"),
      saida("S-3", 17, 1, "L-1"),
      saida("S-4", 12, 1, "L-1"),
      saida("S-5", 5, 1, "L-1"),
      saida("S-6", 2, 1, "L-1"),
      saida("S-7-PICO", 1, 8, null),
    ];
    const resultado = calcularConsumoEQualidade("MED-TESTE", "COFRE-01", movimentos, referenciaMs, 0.5, 1);

    expect(resultado.consumo.consumo_7d).toBe(10);
    expect(resultado.consumo.consumo_30d).toBe(14);
    expect(resultado.consumo.atipicos_detectados.map((item) => item.id_movimento)).toEqual(["S-7-PICO"]);
    expect(resultado.consumo.consumo_usado).toBeCloseTo(0.26, 5);
    expect(resultado.qualidade.percentual_saidas_lote_identificado).toBe(86);
    expect(resultado.qualidade.nivel_confianca).toBe("BAIXO");
    expect(resultado.qualidade.divergencias_abertas).toBe(1);
  });
});