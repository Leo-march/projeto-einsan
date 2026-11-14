import { NextResponse } from "next/server";
import { executarAnalise } from "@/lib/analise";
import { carregarDados, resolverReferencia } from "@/lib/dados";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/analise?data_referencia=<ISO 8601> */
export async function GET(request: Request) {
  try {
    const d = await carregarDados();
    const ref = resolverReferencia(new URL(request.url).searchParams.get("data_referencia"), d.logs, d.movimentacoes);
    if (ref === null) return NextResponse.json({ erro: "data_referencia inválida. Use ISO 8601." }, { status: 400 });
    return NextResponse.json(executarAnalise(d.bulas, d.logs, d.movimentacoes, d.parametros, ref));
  } catch (err) {
    console.error("[/api/analise]", err);
    return NextResponse.json({ erro: "Falha ao processar a análise." }, { status: 500 });
  }
}