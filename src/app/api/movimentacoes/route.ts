import { NextResponse } from "next/server";
import { analisarRiscoTermico, executarAnalise } from "@/lib/analise";
import { carregarDados, resolverReferencia, salvarMovimentacoes } from "@/lib/dados";
import { listarMovimentacoes, reconstruirEstoque, validarNovaMovimentacao } from "@/lib/estoque";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/movimentacoes?id_medicamento=&codigo_lote=&tipo=&limite= (rastreabilidade) */
export async function GET(request: Request) {
  try {
    const q = new URL(request.url).searchParams;
    const { movimentacoes } = await carregarDados();
    const limite = Number(q.get("limite"));
    const itens = listarMovimentacoes(movimentacoes, {
      id_medicamento: q.get("id_medicamento") ?? undefined,
      codigo_lote: q.get("codigo_lote") ?? undefined,
      tipo: q.get("tipo") ?? undefined,
      limite: Number.isFinite(limite) && limite > 0 ? limite : undefined,
    });
    return NextResponse.json({ total: itens.length, movimentacoes: itens });
  } catch (err) {
    console.error("[GET /api/movimentacoes]", err);
    return NextResponse.json({ erro: "Falha ao consultar movimentações." }, { status: 500 });
  }
}

/**
 * POST /api/movimentacoes: registra entrada, saída, transferência, descarte ou ajuste.
 * Responde com a recomendação já recalculada para o medicamento.
 */
export async function POST(request: Request) {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ erro: "Corpo da requisição não é um JSON válido." }, { status: 400 });
    }

    const d = await carregarDados();
    const agora = new Date();
    const { estoque: estoqueTotal } = reconstruirEstoque(d.movimentacoes, d.parametros, Infinity);
    const v = validarNovaMovimentacao(body, d.parametros, estoqueTotal, agora);
    if (!v.ok) return NextResponse.json({ erro: "Movimentação inválida.", detalhes: v.erros }, { status: 400 });

    const mov = v.movimentacao;

    // Trava de segurança: não dispensa lote invalidado por temperatura nem vencido.
    if (mov.tipo === "SAIDA_DISPENSACAO") {
      const ref = resolverReferencia(null, d.logs, d.movimentacoes) ?? agora.getTime();
      const { avaliacoes } = analisarRiscoTermico(d.logs, d.bulas, estoqueTotal, ref);
      if (avaliacoes.find((a) => a.id_medicamento === mov.id_medicamento)?.status === "LOTES_INVALIDADOS") {
        return NextResponse.json(
          { erro: "Dispensação bloqueada: lote invalidado por excursão térmica. Registre como SAIDA_DESCARTE." },
          { status: 422 }
        );
      }
      const validade = estoqueTotal.itens.find((i) => i.id_medicamento === mov.id_medicamento)?.lotes.find((l) => l.codigo_lote === mov.codigo_lote)?.validade;
      if (validade && Date.parse(`${validade}T23:59:59-03:00`) < Date.parse(mov.timestamp)) {
        return NextResponse.json({ erro: "Dispensação bloqueada: lote vencido. Registre como SAIDA_DESCARTE." }, { status: 422 });
      }
    }

    const novas = [...d.movimentacoes, mov];
    await salvarMovimentacoes(novas);

    const ref = resolverReferencia(null, d.logs, novas) ?? agora.getTime();
    const analise = executarAnalise(d.bulas, d.logs, novas, d.parametros, ref);
    return NextResponse.json(
      {
        movimentacao: mov,
        recomendacao_atualizada: analise.recomendacoes_compra.find((r) => r.id_medicamento === mov.id_medicamento) ?? null,
        resumo: analise.resumo,
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("[POST /api/movimentacoes]", err);
    return NextResponse.json({ erro: "Falha ao registrar a movimentação (disco somente leitura?)." }, { status: 500 });
  }
}