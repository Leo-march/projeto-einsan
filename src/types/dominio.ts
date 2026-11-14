// ============================================================
// Tipagens de domínio: Medical Security x Bulário Anvisa (PoC)
// ============================================================

// ---------- Entradas (simulam o "banco de dados") ----------

export interface Bula {
  id_medicamento: string;
  nome: string;
  temp_min_celsius: number;
  temp_max_celsius: number;
  /** Tempo máximo acumulado fora da faixa antes de invalidar o lote */
  alerta_exposicao_minutos: number;
}

export type TipoEvento =
  | "PORTA_ABERTA"
  | "PORTA_FECHADA"
  | "LEITURA_TEMPERATURA"
  | "LEITURA_SCANNER";

export interface LogHardware {
  id_evento: string;
  cofre_id: string;
  /** ISO 8601 com fuso, ex.: 2026-11-14T14:00:00-03:00 */
  timestamp: string;
  tipo: TipoEvento;
  temperatura_celsius?: number;
  usuario_biometria_id?: string;
  /** Presentes apenas em LEITURA_SCANNER */
  id_medicamento?: string;
  codigo_lote?: string;
}

export interface LoteEstoque {
  codigo_lote: string;
  quantidade: number;
  /** YYYY-MM-DD */
  validade: string;
}

export interface ItemEstoque {
  id_medicamento: string;
  custo_unitario_brl: number;
  consumo_medio_diario: number;
  prazo_reposicao_dias: number;
  estoque_seguranca_dias: number;
  lotes: LoteEstoque[];
}

export interface EstoqueCofre {
  cofre_id: string;
  itens: ItemEstoque[];
}

export interface CondicoesPagamento {
  prazo_dias: number;
  desconto_a_vista_pct: number;
}

export interface OfertaFornecedor {
  id_medicamento: string;
  preco_unitario_brl: number;
  prazo_entrega_dias: number;
  validade_minima_garantida_dias: number;
  quantidade_minima_pedido: number;
  disponibilidade: number;
  condicoes_pagamento: CondicoesPagamento;
}

export interface Fornecedor {
  id_fornecedor: string;
  nome: string;
  cadeia_fria_certificada: boolean;
  confiabilidade_entrega_pct: number;
  simulado: true;
  ofertas: OfertaFornecedor[];
}

export interface ReferenciaPreco {
  id_medicamento: string;
  preco_referencia_brl: number;
  fonte: string;
}

export interface DadosFornecedores {
  referencias_preco: ReferenciaPreco[];
  fornecedores: Fornecedor[];
}

export type TipoMovimentoLegado = "ENTRADA" | "SAIDA" | "DISPENSACAO" | "TRANSFERENCIA" | "AJUSTE";
export type OrigemMovimentacao = "SCANNER" | "MANUAL" | "SEM_LEITURA";

export interface Movimentacao {
  id_movimento: string;
  timestamp: string;
  cofre_id: string;
  tipo: TipoMovimentoLegado;
  id_medicamento: string;
  codigo_lote: string | null;
  quantidade: number;
  origem_registro: OrigemMovimentacao;
  usuario_biometria_id: string;
  id_transferencia?: string;
  cofre_par?: string;
  sentido_transferencia?: "SAIDA" | "ENTRADA";
}

// ---------- Saídas (contrato consumido pelo front-end) ----------

export type Severidade = "CRITICA" | "ALTA" | "MEDIA" | "BAIXA";

export interface AvaliacaoTermica {
  id_medicamento: string;
  nome: string;
  faixa_bula_celsius: { min: number; max: number };
  limite_exposicao_minutos: number;
  minutos_fora_da_faixa: number;
  temperatura_maxima_registrada: number | null;
  temperatura_minima_registrada: number | null;
  inicio_excursao: string | null;
  fim_excursao: string | null;
  excursao_em_andamento: boolean;
  status: "CONFORME" | "EXCURSAO_TOLERADA" | "LOTES_INVALIDADOS";
}

export interface AlertaRiscoTermico {
  tipo: "RISCO_TERMICO";
  severidade: "CRITICA";
  id_medicamento: string;
  nome: string;
  minutos_fora_da_faixa: number;
  limite_exposicao_minutos: number;
  temperatura_maxima_registrada: number | null;
  lotes_invalidados: string[];
  unidades_invalidadas: number;
  mensagem: string;
}

export interface AlertaMovimentacaoNaoIdentificada {
  tipo: "DIVERGENCIA_ESTOQUE";
  severidade: "ALTA";
  porta_aberta_em: string;
  porta_fechada_em: string;
  duracao_segundos: number;
  usuario_biometria_id: string | null;
  /** true quando houve saída lançada manualmente no mesmo intervalo (ainda vale a conferência) */
  regularizada_por_lancamento_manual: boolean;
  mensagem: string;
}

export type AcaoCompra =
  | "COMPRAR_IMEDIATAMENTE"
  | "COMPRAR_NO_CICLO_ATUAL"
  | "PLANEJAR_REPOSICAO"
  | "MONITORAR";

export interface RecomendacaoCompra {
  id_medicamento: string;
  nome: string;
  urgencia: Severidade;
  acao: AcaoCompra;
  recomendar_compra: boolean;
  quantidade_sugerida: number;
  custo_estimado_brl: number;
  /** Validade mínima (em dias) que o novo lote deve ter ao chegar */
  validade_minima_exigida_dias: number;
  cobertura_dias: number | null;
  prazo_reposicao_dias: number;
  estoque: {
    bruto: number;
    invalidado_termico: number;
    vencido: number;
    em_risco_de_vencimento: number;
    margem_incerteza_divergencia: number;
    util: number;
  };
  lotes_em_risco_de_vencimento: string[];
  justificativas: string[];
  custo_referencia_brl: number;
  preco_referencia_brl: number | null;
  fonte_preco_referencia: string | null;
  fornecedor_recomendado: FornecedorRecomendado | null;
  alternativas_fornecedor: AlternativaFornecedor[];
  fornecedores_excluidos: FornecedorExcluido[];
  motivo_sem_fornecedor: string | null;
  justificativa_fornecedor: string[];
  fatores_decisao: FatorDecisao[];
  por_que_nao_o_mais_barato: string | null;
  justificativa_quantidade: string[];
  previsao: PrevisaoItem;
  consumo: ConsumoHistorico;
  qualidade_dados: QualidadeConsumo;
  faixa_quantidade: FaixaQuantidade | null;
  impacto: ImpactoItem;
  rastreabilidade: RastreabilidadeMedicamento;
}

export interface EventoRastreabilidadeLote {
  tipo: "ENTRADA" | "SAIDA" | "DISPENSACAO" | "TRANSFERENCIA" | "AJUSTE" | "VALIDADE" | "EXCURSAO_TERMICA";
  timestamp: string;
  quantidade: number | null;
  origem_registro: OrigemMovimentacao | null;
  usuario_biometria_id: string | null;
  detalhe: string;
}

export interface LoteRastreabilidade {
  codigo_lote: string;
  validade: string;
  saldo_estoque_cofre: number;
  saldo_reconstruido: number;
  divergencia_unidades: number;
  eventos: EventoRastreabilidadeLote[];
}

export interface RastreabilidadeMedicamento {
  lotes: LoteRastreabilidade[];
  saidas_sem_lote_nao_atribuidas: number;
  divergencias_lote_abertas: number;
  margem_incerteza_unidades: number;
  dados_lote_disponiveis: boolean;
}

export interface FornecedorRecomendado {
  id_fornecedor: string;
  nome: string;
  simulado: true;
  preco_unitario_brl: number;
  preco_efetivo_unitario_brl: number;
  prazo_entrega_dias: number;
  cadeia_fria_certificada: boolean;
  confiabilidade_entrega_pct: number;
  validade_minima_garantida_dias: number;
  quantidade_pedida: number;
  excesso_por_minimo_pedido: number;
  disponibilidade: number;
  condicoes_pagamento: CondicoesPagamento;
  pagamento_escolhido: "A_VISTA" | "A_PRAZO";
  custo_estimado_total_brl: number;
  dias_sem_estoque_previstos: number;
  atraso_vs_prazo_reposicao_dias: number;
  diferenca_vs_preco_referencia_brl: number | null;
}

export interface AlternativaFornecedor extends FornecedorRecomendado {
  diferenca_preco_vs_recomendado_brl: number;
  diferenca_prazo_vs_recomendado_dias: number;
}

export interface FatorDecisao {
  fator: "preco" | "prazo" | "confiabilidade" | "validade";
  peso_pct: number;
  valor: string;
  pontuacao_normalizada: number;
  contribuicao: number;
  efeito: string;
}

export interface PrevisaoItem {
  data_prevista_ruptura: string | null;
  data_limite_pedido: string | null;
  pedido_atrasado: boolean;
  dias_atraso: number | null;
  dias_sem_estoque_previstos: number | null;
  perda_prevista_por_vencimento: { unidades: number; valor_brl: number };
  perda_por_invalidacao_termica: { unidades: number; valor_brl: number };
  custo_de_esperar: { valor_brl: number | null; dias_sem_estoque: number | null; atraso_simulado_dias: number };
  premissas: string[];
}

export interface ConsumoHistorico {
  consumo_usado: number;
  consumo_7d: number;
  consumo_30d: number;
  tendencia: "EM_ALTA" | "ESTAVEL" | "EM_BAIXA" | "SEM_HISTORICO";
  atipicos_detectados: { id_movimento: string; timestamp: string; quantidade: number; motivo: string }[];
  usou_fallback: boolean;
  justificativa_fallback: string | null;
}

export interface QualidadeConsumo {
  percentual_saidas_lote_identificado: number;
  dias_historico: number;
  movimentacoes_manuais_ou_sem_leitura: number;
  divergencias_abertas: number;
  nivel_confianca: "ALTO" | "MEDIO" | "BAIXO";
  motivo_confianca: string;
}

export interface FaixaQuantidade {
  minimo: number;
  maximo: number;
  conservadora: number;
}

export interface PontoSimulacaoDia {
  dia: number;
  data: string;
  estoque_sem_acao: number;
  estoque_com_recomendacao: number;
  capital_sem_acao_brl: number;
  capital_com_recomendacao_brl: number;
}

export interface ResultadoCenario30Dias {
  dias_sem_estoque: number;
  unidades_sem_estoque: number;
  unidades_vencidas: number;
  capital_medio_parado_brl: number;
}

export interface ImpactoItem {
  capital_imobilizado_brl: number;
  capital_excedente_brl: number;
  perdas_evitadas: {
    vencimento: { unidades: number; valor_brl: number };
    falta: { unidades: number; valor_brl: number };
  };
  simulacao_30_dias: {
    sem_acao: ResultadoCenario30Dias;
    com_recomendacao: ResultadoCenario30Dias;
    pontos_diarios: PontoSimulacaoDia[];
    premissas: string[];
  };
}

export interface FornecedorExcluido {
  id_fornecedor: string;
  nome: string;
  motivo: string;
}

export interface AnaliseResponse {
  meta: {
    gerado_em: string;
    data_referencia: string;
    cofre_id: string;
    total_eventos_analisados: number;
    ciclos_porta_analisados: number;
    porta_atualmente_aberta: boolean;
    versao_regras: string;
  };
  resumo: {
    status_geral: "CRITICO" | "ATENCAO" | "NORMAL";
    total_alertas: number;
    lotes_invalidados: number;
    unidades_invalidadas: number;
    divergencias_estoque: number;
    divergencias_lote: number;
    saidas_sem_lote_nao_atribuidas: number;
    medicamentos_com_compra_recomendada: number;
    custo_total_recomendado_brl: number;
    proxima_ruptura: string | null;
  };
  alertas: {
    risco_termico: AlertaRiscoTermico[];
    movimentacao_nao_identificada: AlertaMovimentacaoNaoIdentificada[];
  };
  avaliacoes_termicas: AvaliacaoTermica[];
  recomendacoes_compra: RecomendacaoCompra[];
  qualidade_dados: QualidadeDados;
}

// ---------- Livro de estoque (entradas, saídas, transferências) ----------

export type TipoMovimentacao =
  | "ENTRADA_COMPRA"
  | "ENTRADA_TRANSFERENCIA"
  | "SAIDA_DISPENSACAO"
  | "SAIDA_TRANSFERENCIA"
  | "SAIDA_DESCARTE"
  | "AJUSTE_INVENTARIO";

export type OrigemRegistro = "SCANNER" | "MANUAL" | "INTEGRACAO_NF";

export interface MovimentacaoEstoque {
  id_movimentacao: string;
  cofre_id: string;
  timestamp: string;
  tipo: TipoMovimentacao;
  id_medicamento: string;
  codigo_lote: string;
  /** Sempre positiva, exceto em AJUSTE_INVENTARIO (negativa = sobra a menos no físico) */
  quantidade: number;
  /** Obrigatória na primeira entrada de um lote (YYYY-MM-DD) */
  validade?: string;
  /** Fornecedor ou unidade de origem/destino */
  contraparte?: string;
  documento?: string;
  usuario_id?: string;
  origem_registro: OrigemRegistro;
  /** id_evento do LEITURA_SCANNER que originou a baixa */
  ref_evento_hardware?: string;
  observacao?: string;
}

export interface MovimentacaoComSaldo extends MovimentacaoEstoque {
  saldo_lote_apos: number;
}

export interface ParametroReposicao {
  id_medicamento: string;
  custo_unitario_brl: number;
  prazo_reposicao_dias: number;
  estoque_seguranca_dias: number;
}

export interface ParametrosCofre {
  cofre_id: string;
  itens: ParametroReposicao[];
}

export interface AvisoQualidade {
  codigo:
    | "MOVIMENTACAO_DUPLICADA"
    | "TIMESTAMP_INVALIDO"
    | "MEDICAMENTO_DESCONHECIDO"
    | "ENTRADA_SEM_VALIDADE"
    | "LOTE_SEM_ENTRADA"
    | "SALDO_NEGATIVO"
    | "HISTORICO_CURTO"
    | "SEM_CONSUMO_NA_JANELA"
    | "BIPAGEM_SEM_BAIXA";
  severidade: "INFO" | "ATENCAO";
  mensagem: string;
  id_referencia?: string;
}

export interface QualidadeDados {
  movimentacoes_processadas: number;
  movimentacoes_ignoradas: number;
  percentual_lancamento_manual: number;
  avisos: AvisoQualidade[];
}

export type StatusLote = "OK" | "VENCE_EM_30_DIAS" | "VENCIDO" | "INVALIDADO_TERMICO";

export interface VisaoEstoque {
  itens: {
    id_medicamento: string;
    nome: string;
    saldo_registrado: number;
    valor_imobilizado_brl: number;
    consumo_medio_diario: number;
    lotes: {
      codigo_lote: string;
      quantidade: number;
      validade: string;
      dias_para_vencer: number;
      status: StatusLote;
    }[];
  }[];
  totais: { unidades: number; valor_imobilizado_brl: number; lotes_em_alerta: number };
}