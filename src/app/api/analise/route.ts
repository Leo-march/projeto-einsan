import { NextResponse } from "next/server";
import { obterAnalise } from "@/lib/servico-analise";

export const runtime = "nodejs";
export const dynamic = "force-dynamic"; // PoC: sempre relê os JSONs

/**
 * GET /api/analise
 * Query opcional: ?data_referencia=2026-11-14T15:30:00-03:00
 * (padrão: timestamp do último evento do log, o que deixa a demo determinística)
 */
export async function GET(request: Request) {
  try {
    const param = new URL(request.url).searchParams.get("data_referencia");
    let refMs: number | undefined;

    if (param) {
      refMs = Date.parse(param);
      if (Number.isNaN(refMs)) {
        return NextResponse.json(
          { erro: "data_referencia inválida. Use ISO 8601." },
          { status: 400 }
        );
      }
    }

    return NextResponse.json(await obterAnalise(refMs));
  } catch (err) {
    console.error("[/api/analise]", err);
    return NextResponse.json(
      { erro: "Falha ao processar a análise." },
      { status: 500 }
    );
  }
}