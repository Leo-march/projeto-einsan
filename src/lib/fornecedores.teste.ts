import { describe, expect, it } from "vitest";
import { escolherFornecedor } from "./fornecedores";
import type { DadosFornecedores, Fornecedor, OfertaFornecedor } from "@/types/dominio";

const contexto = {
  id_medicamento: "MED-003",
  urgencia: "MEDIA" as const,
  quantidade_sugerida: 13,
  validade_minima_exigida_dias: 35,
  cobertura_dias: 14,
  prazo_reposicao_dias: 5,
  estoque: {
    bruto: 8,
    invalidado_termico: 0,
    vencido: 0,
    em_risco_de_vencimento: 0,
    margem_incerteza_divergencia: 1,
    util: 7,
  },
  consumo_medio_diario: 0.5,
  custo_referencia_brl: 182000,
  referenciaMs: Date.parse("2026-11-14T18:05:00.000Z"),
};

function oferta(preco: number, prazo: number, validade: number, minimo = 1): OfertaFornecedor {
  return {
    id_medicamento: "MED-003",
    preco_unitario_brl: preco,
    prazo_entrega_dias: prazo,
    validade_minima_garantida_dias: validade,
    quantidade_minima_pedido: minimo,
    disponibilidade: 40,
    condicoes_pagamento: { prazo_dias: 0, desconto_a_vista_pct: 0 },
  };
}

function fornecedor(id: string, nome: string, options: {
  cold?: boolean;
  reliability?: number;
  offer?: OfertaFornecedor;
} = {}): Fornecedor {
  return {
    id_fornecedor: id,
    nome,
    cadeia_fria_certificada: options.cold ?? true,
    confiabilidade_entrega_pct: options.reliability ?? 95,
    simulado: true,
    ofertas: options.offer ? [options.offer] : [],
  };
}

describe("escolherFornecedor", () => {
  it("prioriza o prazo na urgência média quando o fornecedor mais barato excede o lead", () => {
    const dados: DadosFornecedores = {
      referencias_preco: [{ id_medicamento: "MED-003", preco_referencia_brl: 14000, fonte: "BPS histórico" }],
      fornecedores: [
        fornecedor("FAST", "Distribuidora Rápida (simulada)", { reliability: 98, offer: oferta(15600, 2, 100) }),
        fornecedor("CHEAP", "Distribuidora Econômica (simulada)", { reliability: 93, offer: oferta(14000, 8, 45) }),
      ],
    };
    const resultado = escolherFornecedor(contexto, dados);

    expect(resultado.fornecedor_recomendado?.id_fornecedor).toBe("FAST");
    expect(resultado.alternativas_fornecedor[0].id_fornecedor).toBe("CHEAP");
    expect(resultado.alternativas_fornecedor[0].atraso_vs_prazo_reposicao_dias).toBe(3);
    expect(resultado.alternativas_fornecedor[0].dias_sem_estoque_previstos).toBe(0);
    expect(resultado.por_que_nao_o_mais_barato).toContain("3 dia(s) além do prazo interno de 5");
  });

  it("retorna null quando todos os candidatos violam critério eliminatório", () => {
    const dados: DadosFornecedores = {
      referencias_preco: [],
      fornecedores: [
        fornecedor("NO-COLD", "Distribuidora sem cadeia (simulada)", { cold: false, offer: oferta(100, 1, 100) }),
      ],
    };
    const resultado = escolherFornecedor(contexto, dados);

    expect(resultado.fornecedor_recomendado).toBeNull();
    expect(resultado.custo_estimado_brl).toBe(0);
    expect(resultado.motivo_sem_fornecedor?.toLowerCase()).toContain("cadeia fria não certificada");
    expect(resultado.fornecedores_excluidos).toEqual([
      { id_fornecedor: "NO-COLD", nome: "Distribuidora sem cadeia (simulada)", motivo: "Cadeia fria não certificada." },
    ]);
  });

  it("ajusta o pedido ao mínimo e sinaliza o excedente", () => {
    const dados: DadosFornecedores = {
      referencias_preco: [],
      fornecedores: [fornecedor("MOQ", "Distribuidora Mínimo (simulada)", { offer: oferta(15000, 2, 90, 15) })],
    };
    const resultado = escolherFornecedor(contexto, dados);

    expect(resultado.fornecedor_recomendado?.quantidade_pedida).toBe(15);
    expect(resultado.fornecedor_recomendado?.excesso_por_minimo_pedido).toBe(2);
    expect(resultado.justificativa_fornecedor.join(" ")).toContain("excesso: 2");
  });
});