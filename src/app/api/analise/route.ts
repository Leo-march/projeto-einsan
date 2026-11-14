import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { executarAnalise } from "@/lib/analise";
import type { Bula, EstoqueCofre, LogHardware } from "@/types/dominio";

export const runtime = "nodejs";
export const dynamic = "force-dynamic"; // PoC: sempre relê os JSONs

async function lerJson<T>(arquivo: string): Promise<T> {
  const caminho = path.join(process.cwd(), "data", arquivo);
  return JSON.parse(await fs.readFile(caminho, "utf-8")) as T;
}

/**
 * GET /api/analise
 * Query opcional: ?data_referencia=2026-11-14T15:30:00-03:00
 * (padrão: timestamp do último evento do log, o que deixa a demo determinística)
 */
export async function GET(request: Request) {
  try {
    const [bulas, logs, estoque] = await Promise.all([
      lerJson<Bula[]>("bulas.json"),
      lerJson<LogHardware[]>("logs_hardware.json"),
      lerJson<EstoqueCofre>("estoque_cofre.json"),
    ]);

    const param = new URL(request.url).searchParams.get("data_referencia");
    let refMs: number;

    if (param) {
      refMs = Date.parse(param);
      if (Number.isNaN(refMs)) {
        return NextResponse.json(
          { erro: "data_referencia inválida. Use ISO 8601." },
          { status: 400 }
        );
      }
    } else {
      const ultimo = logs
        .map((l) => Date.parse(l.timestamp))
        .filter((n) => !Number.isNaN(n))
        .sort((a, b) => b - a)[0];
      refMs = ultimo ?? Date.now();
    }

    return NextResponse.json(executarAnalise(bulas, logs, estoque, refMs));
  } catch (err) {
    console.error("[/api/analise]", err);
    return NextResponse.json(
      { erro: "Falha ao processar a análise." },
      { status: 500 }
    );
  }
}