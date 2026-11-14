import type { Fornecedor } from "../tipos";

export type FornecedorAvaliado = {
  fornecedor: Fornecedor;
  pontuacao: number;
  excluido: boolean;
  motivoExclusao: string | null;
  justificativa: string[];
};