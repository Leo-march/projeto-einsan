// Camada de dados: hoje lê o JSON gerado por scripts/gerar_dados.py (pandas).
// Para integrar uma API, troque este arquivo por chamadas fetch mantendo os mesmos tipos.
import raw from './dados.json';
import type { Med, Lote, Mov, Forn, Serie, Prev } from '@/types';

export const medsIniciais = raw.meds as Med[];
export const lotes = raw.lotes as Lote[];
export const movs = raw.movs as Mov[];
export const series = raw.series as Record<string, Serie[]>;
export const previsoes = raw.previsoes as Record<string, Prev[]>;
export const tendencia = raw.tendencia as Record<string, number>;
export const fornecedores = raw.fornecedores as Forn[];
export const compras = raw.compras as { data: string; medId: string; forn: string; qtd: number; total: number }[];
export const perdas = raw.perdas as { mes: string; valor: number }[];
export const EMPRESA = 'Clínica Vida Plena';
export const USUARIO = 'Dra. Marina Duarte';
