import {
  CUSTO_CAPITAL_MENSAL_PCT,
  getPesosFornecedor,
} from "./parametros";
import { formatarBRL } from "./formato";
import type {
  AlternativaFornecedor,
  DadosFornecedores,
  FatorDecisao,
  Fornecedor,
  FornecedorExcluido,
  FornecedorRecomendado,
  RecomendacaoCompra,
} from "@/types/dominio";

type Contexto = Pick<
  RecomendacaoCompra,
  | "id_medicamento"
  | "urgencia"
  | "quantidade_sugerida"
  | "validade_minima_exigida_dias"
  | "cobertura_dias"
  | "prazo_reposicao_dias"
  | "estoque"
>
  & {
    consumo_medio_diario: number;
    custo_referencia_brl: number;
    referenciaMs: number;
  };

type Candidato = {
  fornecedor: Fornecedor;
  oferta: Fornecedor["ofertas"][number];
  quantidade: number;
  excessoMinimo: number;
  precoEfetivoUnitario: number;
  pagamento: "A_VISTA" | "A_PRAZO";
  custoTotal: number;
  diasSemEstoque: number;
  atrasoVsReposicao: number;
  pontuacoes: Record<"preco" | "prazo" | "confiabilidade" | "validade", number>;
  score: number;
};

export type SelecaoFornecedor = {
  fornecedor_recomendado: FornecedorRecomendado | null;
  alternativas_fornecedor: AlternativaFornecedor[];
  fornecedores_excluidos: FornecedorExcluido[];
  motivo_sem_fornecedor: string | null;
  justificativa_fornecedor: string[];
  fatores_decisao: FatorDecisao[];
  por_que_nao_o_mais_barato: string | null;
  custo_estimado_brl: number;
};

const arredondarMoeda = (valor: number): number => Math.round((valor + Number.EPSILON) * 100) / 100;

function pontuar(candidatos: Candidato[], contexto: Contexto): Candidato[] {
  const pesos = getPesosFornecedor(contexto.urgencia);
  const menorPreco = Math.min(...candidatos.map((candidato) => candidato.precoEfetivoUnitario));
  const menorPrazo = Math.min(...candidatos.map((candidato) => candidato.oferta.prazo_entrega_dias));
  const prazosValidade = candidatos.map((candidato) => candidato.oferta.validade_minima_garantida_dias);
  const menorValidade = Math.min(...prazosValidade);
  const maiorValidade = Math.max(...prazosValidade);
  const somaPesos = pesos.preco + pesos.prazo + pesos.confiabilidade + pesos.validade;

  return candidatos
    .map((candidato) => {
      const prazo = candidato.oferta.prazo_entrega_dias;
      const diasSemEstoque = contexto.cobertura_dias === null
        ? 0
        : Math.max(0, prazo - contexto.cobertura_dias);
      const atrasoVsPrazoReposicao = Math.max(0, prazo - contexto.prazo_reposicao_dias);
      const prazoNormalizado = (menorPrazo / prazo)
        / (1 + diasSemEstoque / Math.max(1, contexto.prazo_reposicao_dias))
        / (1 + atrasoVsPrazoReposicao / Math.max(1, contexto.prazo_reposicao_dias));
      const validadeNormalizada = maiorValidade === menorValidade
        ? 1
        : (candidato.oferta.validade_minima_garantida_dias - menorValidade) / (maiorValidade - menorValidade);
      const pontuacoes = {
        preco: menorPreco / candidato.precoEfetivoUnitario,
        prazo: prazoNormalizado,
        confiabilidade: candidato.fornecedor.confiabilidade_entrega_pct / 100,
        validade: validadeNormalizada,
      };
      const score = (
        pontuacoes.preco * pesos.preco +
        pontuacoes.prazo * pesos.prazo +
        pontuacoes.confiabilidade * pesos.confiabilidade +
        pontuacoes.validade * pesos.validade
      ) / somaPesos;

      return { ...candidato, diasSemEstoque, pontuacoes, score };
    })
    .sort((left, right) => right.score - left.score || left.custoTotal - right.custoTotal);
}

function montarCandidato(
  fornecedor: Fornecedor,
  oferta: Fornecedor["ofertas"][number],
  contexto: Contexto,
): Candidato {
  const quantidade = Math.max(contexto.quantidade_sugerida, oferta.quantidade_minima_pedido);
  const precoAVista = oferta.preco_unitario_brl * (1 - oferta.condicoes_pagamento.desconto_a_vista_pct / 100);
  const fatorValorPresente = 1 + (CUSTO_CAPITAL_MENSAL_PCT / 100) * (oferta.condicoes_pagamento.prazo_dias / 30);
  const precoAPrazo = oferta.preco_unitario_brl / fatorValorPresente;
  const pagamento = precoAVista <= precoAPrazo ? "A_VISTA" : "A_PRAZO";
  const precoEfetivoUnitario = arredondarMoeda(Math.min(precoAVista, precoAPrazo));
  const custoTotal = arredondarMoeda(precoEfetivoUnitario * quantidade);
  const diasSemEstoque = contexto.cobertura_dias === null
    ? 0
    : Math.max(0, oferta.prazo_entrega_dias - contexto.cobertura_dias);

  return {
    fornecedor,
    oferta,
    quantidade,
    excessoMinimo: quantidade - contexto.quantidade_sugerida,
    precoEfetivoUnitario,
    pagamento,
    custoTotal,
    diasSemEstoque,
    atrasoVsReposicao: Math.max(0, oferta.prazo_entrega_dias - contexto.prazo_reposicao_dias),
    pontuacoes: { preco: 0, prazo: 0, confiabilidade: 0, validade: 0 },
    score: 0,
  };
}

function paraSaida(candidato: Candidato, referencia: number | null, contexto: Contexto): FornecedorRecomendado {
  return {
    id_fornecedor: candidato.fornecedor.id_fornecedor,
    nome: candidato.fornecedor.nome,
    simulado: true,
    preco_unitario_brl: candidato.oferta.preco_unitario_brl,
    preco_efetivo_unitario_brl: candidato.precoEfetivoUnitario,
    prazo_entrega_dias: candidato.oferta.prazo_entrega_dias,
    cadeia_fria_certificada: candidato.fornecedor.cadeia_fria_certificada,
    confiabilidade_entrega_pct: candidato.fornecedor.confiabilidade_entrega_pct,
    validade_minima_garantida_dias: candidato.oferta.validade_minima_garantida_dias,
    quantidade_pedida: candidato.quantidade,
    excesso_por_minimo_pedido: candidato.excessoMinimo,
    disponibilidade: candidato.oferta.disponibilidade,
    condicoes_pagamento: candidato.oferta.condicoes_pagamento,
    pagamento_escolhido: candidato.pagamento,
    custo_estimado_total_brl: candidato.custoTotal,
    dias_sem_estoque_previstos: candidato.diasSemEstoque,
    atraso_vs_prazo_reposicao_dias: candidato.atrasoVsReposicao,
    diferenca_vs_preco_referencia_brl: referencia === null ? null : arredondarMoeda((candidato.precoEfetivoUnitario - referencia) * candidato.quantidade),
  };
}

function montarFatores(candidato: Candidato, contexto: Contexto): FatorDecisao[] {
  const pesos = getPesosFornecedor(contexto.urgencia);
  const fatores: FatorDecisao[] = [
    {
      fator: "preco",
      peso_pct: pesos.preco * 100,
      valor: `${formatarBRL(candidato.precoEfetivoUnitario)}/un. efetivo`,
      pontuacao_normalizada: candidato.pontuacoes.preco,
      contribuicao: candidato.pontuacoes.preco * pesos.preco,
      efeito: "Menor preço efetivo aumenta a pontuação.",
    },
    {
      fator: "prazo",
      peso_pct: pesos.prazo * 100,
      valor: `${candidato.oferta.prazo_entrega_dias} dias vs. prazo do estoque de ${contexto.prazo_reposicao_dias}; ${candidato.atrasoVsReposicao} dias além do prazo e ${candidato.diasSemEstoque} dias sem cobertura`,
      pontuacao_normalizada: candidato.pontuacoes.prazo,
      contribuicao: candidato.pontuacoes.prazo * pesos.prazo,
      efeito: candidato.atrasoVsReposicao > 0
        ? `Prazo excede a reposição interna em ${candidato.atrasoVsReposicao} dias; atraso e eventual falta reduzem a pontuação.`
        : candidato.diasSemEstoque > 0
          ? `Prazo está dentro do lead interno, mas excede a cobertura em ${candidato.diasSemEstoque} dias.`
          : "Entrega dentro do prazo interno e da cobertura calculada.",
    },
    {
      fator: "confiabilidade",
      peso_pct: pesos.confiabilidade * 100,
      valor: `${candidato.fornecedor.confiabilidade_entrega_pct}% de entregas no prazo`,
      pontuacao_normalizada: candidato.pontuacoes.confiabilidade,
      contribuicao: candidato.pontuacoes.confiabilidade * pesos.confiabilidade,
      efeito: "Maior confiabilidade aumenta a pontuação.",
    },
    {
      fator: "validade",
      peso_pct: pesos.validade * 100,
      valor: `${candidato.oferta.validade_minima_garantida_dias} dias garantidos; mínimo ${contexto.validade_minima_exigida_dias}`,
      pontuacao_normalizada: candidato.pontuacoes.validade,
      contribuicao: candidato.pontuacoes.validade * pesos.validade,
      efeito: "Validade residual maior entre as opções elegíveis aumenta a pontuação.",
    },
  ];

  return fatores;
}

function justificativas(candidato: Candidato, contexto: Contexto): string[] {
  const oferta = candidato.oferta;
  return [
    `Entrega em ${oferta.prazo_entrega_dias} dias (prazo de reposição: ${contexto.prazo_reposicao_dias}).`,
    `Garante ${oferta.validade_minima_garantida_dias} dias de validade (mínimo: ${contexto.validade_minima_exigida_dias}).`,
    `Cadeia fria certificada: ${candidato.fornecedor.cadeia_fria_certificada ? "sim" : "não"}.`,
    `Confiabilidade simulada: ${candidato.fornecedor.confiabilidade_entrega_pct}% de entregas no prazo.`,
    `Preço efetivo: ${formatarBRL(candidato.precoEfetivoUnitario)}/un.; pagamento ${candidato.pagamento === "A_VISTA" ? `à vista com ${oferta.condicoes_pagamento.desconto_a_vista_pct}% de desconto` : `em ${oferta.condicoes_pagamento.prazo_dias} dias`}.`,
    ...(candidato.excessoMinimo > 0 ? [`Pedido mínimo ajusta ${contexto.quantidade_sugerida} para ${candidato.quantidade} unidades (excesso: ${candidato.excessoMinimo}).`] : []),
    ...(candidato.diasSemEstoque > 0 ? [`A entrega após a cobertura prevê ${candidato.diasSemEstoque} dias sem estoque.`] : []),
  ];
}

export function escolherFornecedor(contexto: Contexto, dados: DadosFornecedores): SelecaoFornecedor {
  const referencia = dados.referencias_preco.find((item) => item.id_medicamento === contexto.id_medicamento);
  const ofertas: { fornecedor: Fornecedor; oferta: Fornecedor["ofertas"][number] }[] = [];
  const excluidos: FornecedorExcluido[] = [];

  for (const fornecedor of dados.fornecedores) {
    const oferta = fornecedor.ofertas.find((item) => item.id_medicamento === contexto.id_medicamento);
    if (!oferta) {
      excluidos.push({ id_fornecedor: fornecedor.id_fornecedor, nome: fornecedor.nome, motivo: `Sem oferta para ${contexto.id_medicamento}.` });
      continue;
    }
    if (!fornecedor.cadeia_fria_certificada) {
      excluidos.push({ id_fornecedor: fornecedor.id_fornecedor, nome: fornecedor.nome, motivo: "Cadeia fria não certificada." });
      continue;
    }
    if (oferta.validade_minima_garantida_dias < contexto.validade_minima_exigida_dias) {
      excluidos.push({
        id_fornecedor: fornecedor.id_fornecedor,
        nome: fornecedor.nome,
        motivo: `Validade garantida de ${oferta.validade_minima_garantida_dias} dias abaixo do mínimo de ${contexto.validade_minima_exigida_dias}.`,
      });
      continue;
    }

    const quantidadeNecessaria = Math.max(contexto.quantidade_sugerida, oferta.quantidade_minima_pedido);
    if (oferta.disponibilidade < quantidadeNecessaria) {
      excluidos.push({
        id_fornecedor: fornecedor.id_fornecedor,
        nome: fornecedor.nome,
        motivo: `Disponibilidade de ${oferta.disponibilidade} un. abaixo do pedido ajustado de ${quantidadeNecessaria} un.`,
      });
      continue;
    }
    ofertas.push({ fornecedor, oferta });
  }

  if (!ofertas.length) {
    return {
      fornecedor_recomendado: null,
      alternativas_fornecedor: [],
      fornecedores_excluidos: excluidos,
      motivo_sem_fornecedor: excluidos.length
        ? excluidos.map((fornecedorExcluido) => `${fornecedorExcluido.nome}: ${fornecedorExcluido.motivo}`).join(" ")
        : `Nenhum fornecedor possui oferta para ${contexto.id_medicamento}.`,
      justificativa_fornecedor: [],
      fatores_decisao: [],
      por_que_nao_o_mais_barato: null,
      custo_estimado_brl: 0,
    };
  }

  const candidatos = pontuar(ofertas.map(({ fornecedor, oferta }) => montarCandidato(fornecedor, oferta, contexto)), contexto);
  const escolhido = candidatos[0];
  const escolhidoSaida = paraSaida(escolhido, referencia?.preco_referencia_brl ?? null, contexto);
  const alternativas = candidatos.slice(1, 3).map((candidato) => ({
    ...paraSaida(candidato, referencia?.preco_referencia_brl ?? null, contexto),
    diferenca_preco_vs_recomendado_brl: arredondarMoeda(candidato.custoTotal - escolhido.custoTotal),
    diferenca_prazo_vs_recomendado_dias: candidato.oferta.prazo_entrega_dias - escolhido.oferta.prazo_entrega_dias,
  }));
  const maisBarato = [...candidatos].sort((left, right) => left.custoTotal - right.custoTotal)[0];
  const porQueNaoMaisBarato = maisBarato.fornecedor.id_fornecedor === escolhido.fornecedor.id_fornecedor
    ? null
    : `${maisBarato.fornecedor.nome} custa ${formatarBRL(escolhido.custoTotal - maisBarato.custoTotal)} menos, mas entrega em ${maisBarato.oferta.prazo_entrega_dias} dias, ${maisBarato.atrasoVsReposicao} dia(s) além do prazo interno de ${contexto.prazo_reposicao_dias} (${maisBarato.diasSemEstoque} dia(s) sem cobertura); a opção escolhida entrega em ${escolhido.oferta.prazo_entrega_dias} dias (${escolhido.diasSemEstoque} dia(s) sem cobertura).`;

  return {
    fornecedor_recomendado: escolhidoSaida,
    alternativas_fornecedor: alternativas,
    fornecedores_excluidos: excluidos,
    motivo_sem_fornecedor: null,
    justificativa_fornecedor: justificativas(escolhido, contexto),
    fatores_decisao: montarFatores(escolhido, contexto),
    por_que_nao_o_mais_barato: porQueNaoMaisBarato,
    custo_estimado_brl: escolhido.custoTotal,
  };
}