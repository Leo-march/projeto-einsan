import type { Estabelecimento, Lote } from "./tipos";
import type { ResultadoPrevisao } from "./previsao";

export type ResultadoReposicao = {
  saldoAtual: number;
  estoqueSeguranca: number;
  pontoReposicao: number;
  quantidadeSugerida: number;
  coberturaSemanas: number;
};

export function calcularReposicao(
  lotes: Lote[],
  previsao: ResultadoPrevisao,
  estabelecimento: Estabelecimento,
): ResultadoReposicao {
  const saldoAtual = lotes.reduce((total, lote) => total + lote.qtd, 0);
  const { z, semanasRevisao } = estabelecimento.perfil;
  const estoqueSeguranca = Math.ceil(z * previsao.desvioPadrao * Math.sqrt(semanasRevisao));
  const pontoReposicao = Math.ceil(previsao.mediaSemanal * semanasRevisao + estoqueSeguranca);
  const estoqueAlvo = Math.ceil(previsao.mediaSemanal * (semanasRevisao + 2) + estoqueSeguranca);

  return {
    saldoAtual,
    estoqueSeguranca,
    pontoReposicao,
    quantidadeSugerida: Math.max(0, estoqueAlvo - saldoAtual),
    coberturaSemanas: previsao.mediaSemanal === 0 ? 0 : saldoAtual / previsao.mediaSemanal,
  };
}