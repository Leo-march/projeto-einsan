// Formato da resposta de GET /api/analise (conforme o guia da API). Independente de types/dominio.ts.
export type UrgenciaApi = 'CRITICA' | 'ALTA' | 'MEDIA' | 'BAIXA';
export type AnaliseApi = {
  meta: { gerado_em: string; data_referencia: string; cofre_id: string; versao_regras: string };
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
};
