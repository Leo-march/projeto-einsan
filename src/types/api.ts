// Formato da resposta de GET /api/analise (conforme o guia da API). Independente de types/dominio.ts.
export type UrgenciaApi = 'CRITICA' | 'ALTA' | 'MEDIA' | 'BAIXA';
export type AnaliseApi = {
  meta: { gerado_em: string; data_referencia: string; cofre_id: string; versao_regras: string; porta_atualmente_aberta?: boolean };
  resumo: { status_geral: 'CRITICO' | 'ATENCAO' | 'NORMAL'; total_alertas: number; lotes_invalidados: number; unidades_invalidadas: number; divergencias_estoque: number; medicamentos_com_compra_recomendada: number; custo_total_recomendado_brl: number };
  alertas: {
    risco_termico: { severidade: string; id_medicamento: string; nome: string; mensagem: string; minutos_fora_da_faixa: number; limite_exposicao_minutos: number }[];
    movimentacao_nao_identificada: { severidade: string; porta_aberta_em: string; mensagem: string }[];
  };
  avaliacoes_termicas: { id_medicamento: string; nome: string; minutos_fora_da_faixa: number; limite_exposicao_minutos: number; status: string }[];
  recomendacoes_compra: {
    id_medicamento: string; nome: string; urgencia: UrgenciaApi; acao: string; recomendar_compra?: boolean; quantidade_sugerida: number; custo_estimado_brl: number;
    cobertura_dias: number | null; prazo_reposicao_dias: number;
    estoque: { bruto: number; invalidado_termico: number; vencido: number; em_risco_de_vencimento: number; margem_incerteza_divergencia: number; util: number };
    justificativas: string[];
  }[];
  qualidade_dados?: QualidadeApi;
};

// ---- Qualidade dos dados (presente em /api/analise e /api/estoque) ----
export type AvisoApi = { codigo: string; severidade: 'INFO' | 'ATENCAO'; mensagem: string; id_referencia?: string };
export type QualidadeApi = { movimentacoes_processadas: number; movimentacoes_ignoradas: number; percentual_lancamento_manual: number; avisos: AvisoApi[] };

// ---- GET /api/estoque ----
export type StatusLoteApi = 'OK' | 'VENCE_EM_30_DIAS' | 'VENCIDO' | 'INVALIDADO_TERMICO';
export type LoteApi = { codigo_lote: string; quantidade: number; validade: string; dias_para_vencer: number; status: StatusLoteApi };
export type ItemEstoqueApi = { id_medicamento: string; nome: string; saldo_registrado: number; valor_imobilizado_brl: number; consumo_medio_diario: number; lotes: LoteApi[] };
export type EstoqueApi = {
  meta: { cofre_id: string; data_referencia: string };
  itens: ItemEstoqueApi[];
  totais: { unidades: number; valor_imobilizado_brl: number; lotes_em_alerta: number };
  qualidade_dados: QualidadeApi;
};

// ---- /api/movimentacoes ----
export type TipoMovApi = 'ENTRADA_COMPRA' | 'ENTRADA_TRANSFERENCIA' | 'SAIDA_DISPENSACAO' | 'SAIDA_TRANSFERENCIA' | 'SAIDA_DESCARTE' | 'AJUSTE_INVENTARIO';
export type OrigemApi = 'SCANNER' | 'MANUAL' | 'INTEGRACAO_NF';
export type MovimentacaoApi = {
  id_movimentacao: string; cofre_id: string; timestamp: string; tipo: TipoMovApi; id_medicamento: string; codigo_lote: string; quantidade: number;
  validade?: string; origem_registro: OrigemApi; contraparte?: string; documento?: string; usuario_id?: string; ref_evento_hardware?: string; observacao?: string; saldo_lote_apos: number;
};
export type NovaMovimentacao = {
  tipo: TipoMovApi; id_medicamento: string; codigo_lote: string; quantidade: number; validade?: string; origem_registro?: OrigemApi;
  contraparte?: string; documento?: string; usuario_id?: string; observacao?: string;
};
export type FiltrosMov = { id_medicamento?: string; codigo_lote?: string; tipo?: string; limite?: number };
