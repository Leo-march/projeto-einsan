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
    medicamentos_com_compra_recomendada: number;
    custo_total_recomendado_brl: number;
  };
  alertas: {
    risco_termico: AlertaRiscoTermico[];
    movimentacao_nao_identificada: AlertaMovimentacaoNaoIdentificada[];
  };
  avaliacoes_termicas: AvaliacaoTermica[];
  recomendacoes_compra: RecomendacaoCompra[];
}