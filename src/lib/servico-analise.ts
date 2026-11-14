import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import { executarAnalise } from "@/lib/analise";
import type { AnaliseResponse, Bula, DadosFornecedores, EstoqueCofre, LogHardware, Movimentacao } from "@/types/dominio";

async function lerJson<T>(arquivo: string): Promise<T> {
  const caminho = path.join(process.cwd(), "data", arquivo);
  return JSON.parse(await fs.readFile(caminho, "utf-8")) as T;
}

export async function obterAnalise(referenciaMs?: number): Promise<AnaliseResponse> {
  const [bulas, logs, estoque, dadosFornecedores, movimentacoes] = await Promise.all([
    lerJson<Bula[]>("bulas.json"),
    lerJson<LogHardware[]>("logs_hardware.json"),
    lerJson<EstoqueCofre>("estoque_cofre.json"),
    lerJson<DadosFornecedores>("fornecedores.json"),
    lerJson<Movimentacao[]>("movimentacoes.json"),
  ]);

  const referenciaPadrao = logs
    .map((log) => Date.parse(log.timestamp))
    .filter((timestamp) => !Number.isNaN(timestamp))
    .sort((left, right) => right - left)[0];

  return executarAnalise(bulas, logs, estoque, referenciaMs ?? referenciaPadrao ?? Date.now(), dadosFornecedores, movimentacoes);
}