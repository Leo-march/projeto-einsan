'use client';
import { useState } from 'react';
import { useStore } from '@/context/Store';
import { Badge, Card, DataTable, Modal, type Col } from '@/components/ui';
import { EstadoApi } from '@/components/AvisoApi';
import { brl } from '@/utils/calculations';
import { fornecedores, type FornecedorLivro } from '@/utils/derivados';
import { ACAO, dataApiBR, urgLabel, urgTone } from '@/utils/apiHelpers';

export default function Compras() {
  const { analise, movs, custo, recStatus, setRec, carregandoApi } = useStore();
  const [det, setDet] = useState<string | null>(null), [cmp, setCmp] = useState<string | null>(null);
  const itens = (analise?.recomendacoes_compra ?? []).filter((r) => r.recomendar_compra !== false);
  const aberto = itens.find((i) => i.id_medicamento === (det ?? cmp));
  const forns = cmp ? fornecedores(movs, custo, cmp) : [];
  const colsF: Col<FornecedorLivro>[] = [
    { label: 'Fornecedor', val: (f) => f.nome, render: (f) => <b>{f.nome}</b> }, { label: 'Entradas', val: (f) => f.entradas }, { label: 'Unidades', val: (f) => f.unidades },
    { label: 'Valor estimado', val: (f) => f.total, render: (f) => brl(f.total) }, { label: 'Última entrada', val: (f) => f.ultima, render: (f) => dataApiBR(f.ultima) },
  ];
  return (
    <>
      <EstadoApi ok={!!analise} />
      {analise && <div className="note">Recomendações calculadas pela API do Cofre Inteligente (regras {analise.meta.versao_regras}), já ordenadas por urgência.</div>}
      {analise && !itens.length && !carregandoApi && <Card>Nenhuma compra recomendada no momento.</Card>}
      <div className="grid g2">
        {itens.map((r) => {
          const st = recStatus[r.id_medicamento];
          return (
            <Card key={r.id_medicamento} className="ai" title={r.nome} action={st ? <Badge tone={st === 'aprovada' ? 'ok' : 'mute'}>{st === 'aprovada' ? 'Aprovada' : 'Rejeitada'}</Badge> : <Badge tone={urgTone(r.urgencia)}>Urgência {(urgLabel[r.urgencia] ?? r.urgencia).toLowerCase()}</Badge>}>
              <dl className="dl">
                {([['Ação', ACAO[r.acao] ?? r.acao], ['Estoque útil', r.estoque.util], ['Cobertura', r.cobertura_dias === null ? 'Sem histórico de consumo' : `${r.cobertura_dias} dias`], ['Prazo de reposição', `${r.prazo_reposicao_dias} dias`], ['Quantidade sugerida', r.quantidade_sugerida], ['Custo estimado', brl(r.custo_estimado_brl)]] as [string, string | number][]).map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
              </dl>
              <div className="list" style={{ margin: '10px 0' }}>{r.justificativas.map((j, k) => <div key={k}><p style={{ color: 'var(--tx)' }}>{j}</p></div>)}</div>
              <div className="bar" style={{ margin: 0 }}>
                <button className="btn" onClick={() => setDet(r.id_medicamento)}>Ver detalhes</button><button className="btn" onClick={() => setCmp(r.id_medicamento)}>Fornecedores anteriores</button>
                {st ? <button className="btn push" onClick={() => setRec(r.id_medicamento, null)}>Desfazer</button> : <>
                  <button className="btn crit push" onClick={() => setRec(r.id_medicamento, 'rejeitada')}>Rejeitar</button><button className="btn ok" onClick={() => setRec(r.id_medicamento, 'aprovada')}>Aprovar</button></>}
              </div>
            </Card>
          );
        })}
      </div>
      {aberto && det && (
        <Modal title={`Detalhes: ${aberto.nome}`} onClose={() => setDet(null)}>
          <dl className="dl">{([['Estoque bruto', aberto.estoque.bruto], ['Invalidado (térmico)', aberto.estoque.invalidado_termico], ['Vencido', aberto.estoque.vencido], ['Em risco de vencimento', aberto.estoque.em_risco_de_vencimento], ['Margem de incerteza', aberto.estoque.margem_incerteza_divergencia], ['Estoque útil', aberto.estoque.util]] as [string, number][]).map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
        </Modal>
      )}
      {aberto && cmp && (
        <Modal title={`Fornecedores anteriores: ${aberto.nome}`} onClose={() => setCmp(null)} wide>
          <p className="note">Vindos das entradas de compra registradas. A API não tem preço, prazo nem disponibilidade por fornecedor, então não há comparação de preço.</p>
          {forns.length ? <DataTable rows={forns} cols={colsF} pageSize={6} /> : <p>Nenhuma entrada de compra registrada para este medicamento.</p>}
          <div className="acts"><button className="btn pri" onClick={() => setCmp(null)}>Fechar</button></div>
        </Modal>
      )}
    </>
  );
}
