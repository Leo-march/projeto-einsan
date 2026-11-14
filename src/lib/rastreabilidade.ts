import type {
  AvaliacaoTermica,
  EstoqueCofre,
  EventoRastreabilidadeLote,
  Movimentacao,
  RastreabilidadeMedicamento,
} from "@/types/dominio";

function deltaSaldo(movimento: Movimentacao): number {
  if (movimento.tipo === "ENTRADA") return movimento.quantidade;
  if (movimento.tipo === "SAIDA" || movimento.tipo === "DISPENSACAO") return -movimento.quantidade;
  if (movimento.tipo === "TRANSFERENCIA") {
    if (movimento.sentido_transferencia === "ENTRADA") return movimento.quantidade;
    if (movimento.sentido_transferencia === "SAIDA") return -movimento.quantidade;
    return 0;
  }
  return movimento.quantidade;
}

function eventoMovimento(movimento: Movimentacao): EventoRastreabilidadeLote {
  const detalhe = movimento.tipo === "TRANSFERENCIA"
    ? `Transferência ${movimento.sentido_transferencia === "ENTRADA" ? "recebida de" : "enviada para"} ${movimento.cofre_par ?? "cofre não identificado"}`
    : movimento.tipo === "AJUSTE"
      ? `Ajuste de ${movimento.quantidade} un.`
      : `${movimento.tipo === "ENTRADA" ? "Entrada" : movimento.tipo === "SAIDA" ? "Saída" : "Dispensação"} de ${movimento.quantidade} un.`;

  return {
    tipo: movimento.tipo,
    timestamp: movimento.timestamp,
    quantidade: movimento.quantidade,
    origem_registro: movimento.origem_registro,
    usuario_biometria_id: movimento.usuario_biometria_id,
    detalhe: detalhe + (movimento.origem_registro === "SCANNER" ? " · scanner" : ` · ${movimento.origem_registro.toLowerCase()}`),
  };
}

export function reconstruirRastreabilidade(
  estoque: EstoqueCofre,
  movimentacoes: Movimentacao[],
  avaliacoes: AvaliacaoTermica[],
  refMs: number,
  margemFallback: number,
): Record<string, RastreabilidadeMedicamento> {
  const resultado: Record<string, RastreabilidadeMedicamento> = {};

  for (const item of estoque.itens) {
    const movimentos = movimentacoes.filter(
      (movimento) => movimento.id_medicamento === item.id_medicamento && movimento.cofre_id === estoque.cofre_id,
    );
    const eventosSemLote = movimentos.filter((movimento) =>
      movimento.codigo_lote === null && (
        movimento.tipo === "SAIDA" ||
        movimento.tipo === "DISPENSACAO" ||
        (movimento.tipo === "TRANSFERENCIA" && movimento.sentido_transferencia !== "ENTRADA")
      ),
    );
    const saidasSemLote = eventosSemLote.reduce((soma, movimento) => soma + movimento.quantidade, 0);
    const avaliacao = avaliacoes.find((registro) => registro.id_medicamento === item.id_medicamento);
    let divergenciasLote = 0;
    let incertezaLotes = 0;

    const lotes = item.lotes.map((lote) => {
      const movimentosLote = movimentos
        .filter((movimento) => movimento.codigo_lote === lote.codigo_lote)
        .sort((left, right) => Date.parse(left.timestamp) - Date.parse(right.timestamp));
      const saldoReconstruido = movimentosLote.reduce((saldo, movimento) => saldo + deltaSaldo(movimento), 0);
      const divergencia = saldoReconstruido - lote.quantidade;
      if (divergencia !== 0) {
        divergenciasLote += 1;
        incertezaLotes += Math.abs(divergencia);
      }

      const eventos: EventoRastreabilidadeLote[] = movimentosLote.map(eventoMovimento);
      eventos.push({
        tipo: "VALIDADE",
        timestamp: new Date(`${lote.validade}T12:00:00-03:00`).toISOString(),
        quantidade: null,
        origem_registro: null,
        usuario_biometria_id: null,
        detalhe: `Validade informada no estoque: ${lote.validade}`,
      });
      if (avaliacao && (avaliacao.minutos_fora_da_faixa > 0 || avaliacao.excursao_em_andamento)) {
        eventos.push({
          tipo: "EXCURSAO_TERMICA",
          timestamp: avaliacao.inicio_excursao ?? new Date(refMs).toISOString(),
          quantidade: null,
          origem_registro: null,
          usuario_biometria_id: null,
          detalhe: `Excursão térmica avaliada no cofre · ${avaliacao.status}${avaliacao.excursao_em_andamento ? " · em andamento" : ""}`,
        });
      }

      return {
        codigo_lote: lote.codigo_lote,
        validade: lote.validade,
        saldo_estoque_cofre: lote.quantidade,
        saldo_reconstruido: saldoReconstruido,
        divergencia_unidades: divergencia,
        eventos: eventos.sort((left, right) => Date.parse(left.timestamp) - Date.parse(right.timestamp)),
      };
    });
    const temDados = movimentos.length > 0;

    resultado[item.id_medicamento] = {
      lotes,
      saidas_sem_lote_nao_atribuidas: saidasSemLote,
      divergencias_lote_abertas: divergenciasLote,
      margem_incerteza_unidades: temDados ? incertezaLotes + saidasSemLote : margemFallback,
      dados_lote_disponiveis: temDados,
    };
  }

  return resultado;
}