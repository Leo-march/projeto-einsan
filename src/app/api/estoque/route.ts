import { NextResponse } from "next/server";
import { analisarRiscoTermico } from "@/lib/analise";
import { carregarDados, resolverReferencia } from "@/lib/dados";
import { montarVisaoEstoque, reconstruirEstoque } from "@/lib/estoque";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/estoque?data_referencia=<ISO 8601>: saldo por medicamento e lote */
export async function GET(request: Request) {
  try {
    const d = await carregarDados();
    const ref = resolverReferencia(new URL(request.url).searchParams.get("data_referencia"), d.logs, d.movimentacoes);
    if (ref === null) return NextResponse.json({ erro: "data_referencia inválida. Use ISO 8601." }, { status: 400 });

    const { estoque, qualidade } = reconstruirEstoque(d.movimentacoes, d.parametros, ref);
    const { avaliacoes } = analisarRiscoTermico(d.logs, d.bulas, estoque, ref);
    return NextResponse.json({
      meta: { cofre_id: estoque.cofre_id, data_referencia: new Date(ref).toISOString() },
      ...montarVisaoEstoque(estoque, d.bulas, avaliacoes, ref),
      qualidade_dados: qualidade,
    });
  } catch (err) {
    console.error("[/api/estoque]", err);
    return NextResponse.json({ erro: "Falha ao consultar o estoque." }, { status: 500 });
  }
}