'use client';

import { useState } from 'react';
import { useStore } from '@/context/Store';
import { Badge, Card, DataTable, Modal, type Col } from '@/components/ui';
import { EstadoApi } from '@/components/AvisoApi';
import { brl } from '@/utils/calculations';
import { fornecedores, type FornecedorLivro } from '@/utils/derivados';
import { ACAO, dataApiBR, urgLabel, urgTone } from '@/utils/apiHelpers';
import { SugestaoCompra } from '@/components/SugestaoCompra';
import { ApiError, registrarMovimentacao } from '@/services/api';
import type { NovaMovimentacao, OrigemApi } from '@/types/api';

export default function Compras() {
  const { analise, estoque, movs, custo, carregandoApi, recarregarApi, toast } = useStore();
  const [det, setDet] = useState<string | null>(null), [cmp, setCmp] = useState<string | null>(null);
  const [entrada, setEntrada] = useState<NovaMovimentacao | null>(null), [enviando, setEnviando] = useState(false), [erroEntrada, setErroEntrada] = useState('');
  const itens = (analise?.recomendacoes_compra ?? []).filter((r) => r.recomendar_compra !== false);
  const aberto = itens.find((i) => i.id_medicamento === (det ?? cmp));

  const forns = cmp ? fornecedores(movs, custo, cmp) : [];

  // Colunas da tabela de fornecedores anteriores.
  const colsF: Col<FornecedorLivro>[] = [
    {
      label: 'Fornecedor',
      val: (f) => f.nome,
      render: (f) => <b>{f.nome}</b>,
    },
    {
      label: 'Entradas',
      val: (f) => f.entradas,
    },
    {
      label: 'Unidades',
      val: (f) => f.unidades,
    },
    {
      label: 'Valor estimado',
      val: (f) => f.total,
      render: (f) => brl(f.total),
    },
    {
      label: 'Última entrada',
      val: (f) => f.ultima,
      render: (f) => dataApiBR(f.ultima),
    },
  ];
  const iniciarEntrada = (id: string) => {
    const recomendacao = itens.find((item) => item.id_medicamento === id);
    setErroEntrada('');
    setEntrada({
      tipo: 'ENTRADA_COMPRA',
      id_medicamento: id,
      codigo_lote: '',
      quantidade: recomendacao?.quantidade_sugerida ?? 1,
      origem_registro: 'MANUAL',
    });
  };
  const enviarEntrada = async () => {
    if (!entrada || enviando) return;
    setEnviando(true); setErroEntrada('');
    try {
      const body: NovaMovimentacao = {
        ...entrada,
        codigo_lote: entrada.codigo_lote.trim(),
        validade: entrada.validade || undefined,
        contraparte: entrada.contraparte?.trim() || undefined,
        documento: entrada.documento?.trim() || undefined,
      };
      await registrarMovimentacao(body);
      setEntrada(null);
      await recarregarApi();
      toast('Entrada registrada; estoque recalculado a partir do livro de movimentações.');
    } catch (error) {
      const apiError = error as ApiError;
      setErroEntrada([apiError.message, ...(apiError.detalhes ?? [])].join(' '));
    } finally { setEnviando(false); }
  };
  const definirEntrada = <K extends keyof NovaMovimentacao>(campo: K, valor: NovaMovimentacao[K]) => {
    setEntrada((atual) => atual ? { ...atual, [campo]: valor } : atual);
  };
  return (
    <>
      <EstadoApi ok={!!analise} />
      {analise && <div className="note">Recomendações calculadas pela API do Cofre Inteligente (regras {analise.meta.versao_regras}), já ordenadas por urgência. O estoque muda somente após o recebimento ser lançado como entrada com lote e validade.</div>}
      {analise && !itens.length && !carregandoApi && <Card>Nenhuma compra recomendada no momento.</Card>}
      {analise && <SugestaoCompra analise={analise} estoque={estoque} movs={movs} itens={itens} />}
      <div className="grid g2">
        {itens.map((r) => {
          return (
            <Card
              key={r.id_medicamento}
              className="ai"
              title={r.nome}
              action={
                <Badge tone={urgTone(r.urgencia)}>
                  Urgência{' '}
                  {(urgLabel[r.urgencia] ?? r.urgencia).toLowerCase()}
                </Badge>
              }
            >
              <dl className="dl">
                {(
                  [
                    ['Ação', ACAO[r.acao] ?? r.acao],
                    ['Estoque útil', r.estoque.util],
                    [
                      'Cobertura',
                      r.cobertura_dias === null
                        ? 'Sem histórico de consumo'
                        : `${r.cobertura_dias} dias`,
                    ],
                    ['Prazo de reposição', `${r.prazo_reposicao_dias} dias`],
                    ['Quantidade sugerida', r.quantidade_sugerida],
                    ['Custo estimado', brl(r.custo_estimado_brl)],
                    ...(r.fornecedor_recomendado ? [['Fornecedor sugerido', `${r.fornecedor_recomendado.nome} (${r.fornecedor_recomendado.prazo_entrega_dias} dia(s), ${r.fornecedor_recomendado.confiabilidade_entrega_pct}% no prazo)`] as [string, string]] : []),
                  ] as [string, string | number][]
                ).map(([k, v]) => (
                  <div key={k}>
                    <dt>{k}</dt>
                    <dd>{v}</dd>
                  </div>
                ))}
              </dl>

              <div className="list" style={{ margin: '10px 0' }}>
                {r.justificativas.map((j, k) => (
                  <div key={k}>
                    <p style={{ color: 'var(--tx)' }}>{j}</p>
                  </div>
                ))}
              </div>

              <div className="bar" style={{ margin: 0 }}>
                <button className="btn" onClick={() => setDet(r.id_medicamento)}>Ver detalhes</button><button className="btn" onClick={() => setCmp(r.id_medicamento)}>Fornecedores anteriores</button>
                <button className="btn pri" onClick={() => iniciarEntrada(r.id_medicamento)}>Registrar entrada recebida</button>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Modal de detalhes do medicamento. */}
      {aberto && det && (
        <Modal
          title={`Detalhes: ${aberto.nome}`}
          onClose={() => setDet(null)}
        >
          <dl className="dl">
            {(
              [
                ['Estoque bruto', aberto.estoque.bruto],
                ['Invalidado (térmico)', aberto.estoque.invalidado_termico],
                ['Vencido', aberto.estoque.vencido],
                ['Em risco de vencimento', aberto.estoque.em_risco_de_vencimento],
                ['Margem de incerteza', aberto.estoque.margem_incerteza_divergencia],
                ['Estoque útil', aberto.estoque.util],
              ] as [string, number][]
            ).map(([k, v]) => (
              <div key={k}>
                <dt>{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
        </Modal>
      )}

      {/* Modal de fornecedores anteriores. */}
      {aberto && cmp && (
        <Modal title={`Fornecedores anteriores: ${aberto.nome}`} onClose={() => setCmp(null)} wide>
          <p className="note">Vindos das entradas de compra registradas. A API não tem preço, prazo nem disponibilidade por fornecedor, então não há comparação de preço.</p>
          {forns.length ? <DataTable rows={forns} cols={colsF} pageSize={6} /> : <p>Nenhuma entrada de compra registrada para este medicamento.</p>}
          <div className="acts"><button className="btn pri" onClick={() => setCmp(null)}>Fechar</button></div>
        </Modal>
      )}
      {entrada && (
        <Modal title="Registrar entrada de compra" onClose={() => !enviando && setEntrada(null)} wide>
          <p className="note">O registro cria uma movimentação `ENTRADA_COMPRA`. Para lote novo, validade é obrigatória. O saldo útil será recalculado pela API após confirmar a entrada.</p>
          <div className="form">
            <label>Medicamento<select value={entrada.id_medicamento} onChange={(event) => definirEntrada('id_medicamento', event.target.value)}>{itens.map((item) => <option key={item.id_medicamento} value={item.id_medicamento}>{item.nome}</option>)}</select></label>
            <label>Lote recebido<input value={entrada.codigo_lote} onChange={(event) => definirEntrada('codigo_lote', event.target.value)} list="lotes-da-compra" /><datalist id="lotes-da-compra">{estoque?.itens.find((item) => item.id_medicamento === entrada.id_medicamento)?.lotes.map((lote) => <option key={lote.codigo_lote} value={lote.codigo_lote} />)}</datalist></label>
            <label>Quantidade recebida<input type="number" min="1" step="1" value={entrada.quantidade} onChange={(event) => definirEntrada('quantidade', Math.trunc(Number(event.target.value)))} /></label>
            <label>Validade<input type="date" value={entrada.validade ?? ''} onChange={(event) => definirEntrada('validade', event.target.value)} /></label>
            <label>Fornecedor / contraparte<input value={entrada.contraparte ?? ''} onChange={(event) => definirEntrada('contraparte', event.target.value)} /></label>
            <label>Documento<input value={entrada.documento ?? ''} onChange={(event) => definirEntrada('documento', event.target.value)} /></label>
            <label>Origem do registro<select value={entrada.origem_registro ?? 'MANUAL'} onChange={(event) => definirEntrada('origem_registro', event.target.value as OrigemApi)}><option value="MANUAL">Manual</option><option value="INTEGRACAO_NF">Integração de nota</option><option value="SCANNER">Scanner</option></select></label>
            {erroEntrada && <p className="note full" role="alert">{erroEntrada}</p>}
            <div className="acts full"><button className="btn" disabled={enviando} onClick={() => setEntrada(null)}>Cancelar</button><button className="btn pri" disabled={enviando || !entrada.codigo_lote.trim() || !Number.isInteger(entrada.quantidade) || entrada.quantidade <= 0} onClick={() => void enviarEntrada()}>{enviando ? 'Registrando…' : 'Confirmar entrada'}</button></div>
          </div>
        </Modal>
      )}
    </>
  );
}