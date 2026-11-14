import { describe, expect, it } from "vitest";
import { avaliarFornecedores } from "./fornecedores";
import type { Fornecedor, Pesos } from "./tipos";

const pesos: Pesos = { preco: 35, prazo: 25, confiabilidade: 25, loteMinimo: 15 };
const fornecedores: Fornecedor[] = [
  { id: "FOR-A", nome: "Distribuidora Alfa", precoUnitario: 1280, prazoDias: 5, confiabilidade: 94, loteMinimo: 24 },
  { id: "FOR-B", nome: "Distribuidora Beta", precoUnitario: 1195, prazoDias: 9, confiabilidade: 91, loteMinimo: 48 },
  { id: "FOR-C", nome: "Distribuidora Gama", precoUnitario: 1370, prazoDias: 3, confiabilidade: 98, loteMinimo: 72 },
  { id: "FOR-D", nome: "Distribuidora Delta", precoUnitario: 1160, prazoDias: 18, confiabilidade: 82, loteMinimo: 96 },
];

describe("avaliarFornecedores: comportamento atual", () => {
  it("preserva pontuações, ordem e exclusão da semente", () => {
    const resultado = avaliarFornecedores(fornecedores, pesos);

    expect(resultado.map((item) => [item.fornecedor.nome, item.pontuacao, item.excluido])).toEqual([
      ["Distribuidora Beta", 77, false],
      ["Distribuidora Alfa", 75, false],
      ["Distribuidora Gama", 54, false],
      ["Distribuidora Delta", 56, true],
    ]);
    expect(resultado[3].motivoExclusao).toBe("Prazo de 18 dias excede a premissa de 14 dias.");
  });

  it("preserva os textos atuais de justificativa e motivo de exclusão", () => {
    const resultado = avaliarFornecedores(fornecedores, pesos);

    expect(resultado[0].justificativa).toEqual([
      "Preço unitário de R$ 1.195",
      "prazo de 9 dias",
      "confiabilidade histórica simulada de 91%",
      "lote mínimo de 48 unidades",
    ]);
    expect(resultado[3].motivoExclusao).toBe("Prazo de 18 dias excede a premissa de 14 dias.");
  });

  it("mantém elegível o prazo exatamente igual ao limite e exclui o prazo superior", () => {
    const fornecedores: Fornecedor[] = [
      { id: "A", nome: "No limite", precoUnitario: 100, prazoDias: 14, confiabilidade: 90, loteMinimo: 1 },
      { id: "B", nome: "Acima do limite", precoUnitario: 90, prazoDias: 15, confiabilidade: 99, loteMinimo: 1 },
    ];
    const pesos = { preco: 1, prazo: 1, confiabilidade: 1, loteMinimo: 1 };
    const resultado = avaliarFornecedores(fornecedores, pesos, 14);

    expect(resultado.map((item) => [item.fornecedor.nome, item.excluido])).toEqual([
      ["No limite", false],
      ["Acima do limite", true],
    ]);
    expect(resultado[1].motivoExclusao).toBe("Prazo de 15 dias excede a premissa de 14 dias.");
  });

  it("normaliza critérios empatados para 100 e retorna lista vazia sem opções", () => {
    const fornecedor: Fornecedor = {
      id: "A",
      nome: "Única",
      precoUnitario: 100,
      prazoDias: 5,
      confiabilidade: 100,
      loteMinimo: 10,
    };
    const pesos = { preco: 1, prazo: 1, confiabilidade: 1, loteMinimo: 1 };

    expect(avaliarFornecedores([fornecedor], pesos)[0].pontuacao).toBe(100);
    expect(avaliarFornecedores([], pesos)).toEqual([]);
  });
});