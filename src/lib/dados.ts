import { promises as fs } from "fs";
import path from "path";
import type { Bula, LogHardware, MovimentacaoEstoque, ParametrosCofre } from "@/types/dominio";

const DIR = path.join(process.cwd(), "data");

async function lerJson<T>(arquivo: string): Promise<T> {
  return JSON.parse(await fs.readFile(path.join(DIR, arquivo), "utf-8")) as T;
}

export async function carregarDados() {
  const [bulas, logs, movimentacoes, parametros] = await Promise.all([
    lerJson<Bula[]>("bulas.json"),
    lerJson<LogHardware[]>("logs_hardware.json"),
    lerJson<MovimentacaoEstoque[]>("movimentacoes_estoque.json"),
    lerJson<ParametrosCofre>("parametros_reposicao.json"),
  ]);
  return { bulas, logs, movimentacoes, parametros };
}

/** Só funciona em ambiente com disco gravável (npm run dev / servidor próprio). */
export async function salvarMovimentacoes(movs: MovimentacaoEstoque[]) {
  await fs.writeFile(path.join(DIR, "movimentacoes_estoque.json"), JSON.stringify(movs, null, 2) + "\n", "utf-8");
}

/**
 * Data de referência: parâmetro (ISO 8601) ou, por padrão, o evento mais recente
 * entre logs de hardware e movimentações. Retorna null se o parâmetro for inválido.
 */
export function resolverReferencia(param: string | null, logs: LogHardware[], movs: MovimentacaoEstoque[]): number | null {
  if (param) {
    const ms = Date.parse(param);
    return Number.isNaN(ms) ? null : ms;
  }
  const todos = [...logs.map((l) => l.timestamp), ...movs.map((m) => m.timestamp)]
    .map((t) => Date.parse(t))
    .filter((n) => !Number.isNaN(n));
  return todos.length ? Math.max(...todos) : Date.now();
}