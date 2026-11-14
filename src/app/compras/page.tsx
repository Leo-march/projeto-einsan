'use client';
import { useState } from 'react';
import { useStore } from '@/context/Store';
import { Badge, Card, Modal } from '@/components/ui';
import { fornecedores } from '@/data/mockData';
import { brl, dataBR, recomendar } from '@/utils/calculations';
import { ACAO, urgLabel, urgTone } from '@/utils/apiHelpers';
import type { Tone } from '@/types';
import type { AnaliseApi } from '@/types/api';

type Estoque = AnaliseApi['recomendacoes_compra'][number]['estoque'];
type Item = { id: string; nome: string; tone: Tone; urg: string; acao: string; util: number; cob: number | null; prazo: number; qtd: number; custo: number; just: string[]; estoque?: Estoque; data?: string };

export default function Compras() {
  const { meds, recStatus, setRec, analise, erroApi, carregandoApi, recarregarApi } = useStore();
  const [det, setDet] = useState<string | null>(null), [cmp, setCmp] = useState<string | null>(null);
  const itens: Item[] = analise
    ? analise.recomendacoes_compra.filter((r) => r.recomendar_compra !== false).map((r) => ({
        id: r.id_medicamento, nome: r.nome, tone: urgTone(r.urgencia), urg: urgLabel[r.urgencia] ?? r.urgencia, acao: ACAO[r.acao] ?? r.acao, util: r.estoque.util,
        cob: r.cobertura_dias, prazo: r.prazo_reposicao_dias, qtd: r.quantidade_sugerida, custo: r.custo_estimado_brl, just: r.justificativas, estoque: r.estoque }))
    : meds.flatMap((m) => { const r = recomendar(m); return r ? [{ id: m.id, nome: m.nome, tone: (r.urgente ? 'crit' : 'warn') as Tone, urg: r.urgente ? 'Crítica' : 'Média', acao: r.urgente ? 'Comprar imediatamente' : 'Planejar reposição', util: m.estoque, cob: Math.round(m.estoque / (m.consumo || 1)), prazo: m.prazo, qtd: r.qtd, custo: r.qtd * m.preco, just: [r.justificativa], data: r.dataCompra }] : []; });
  const aberto = itens.find((i) => i.id === (det ?? cmp));
  const forns = fornecedores.map((f) => ({ f, i: f.itens.find((x) => x.medId === cmp) })).filter((x) => x.i);
  return (
    <>
      {analise ? <div className="note">Recomendações calculadas pela API do Cofre Inteligente (regras {analise.meta.versao_regras}), já ordenadas por urgência.</div>
        : <div className="note">{carregandoApi ? 'Carregando recomendações…' : `API indisponível (${erroApi}). Exibindo recomendações de demonstração.`} {!carregandoApi && <button className="btn" onClick={() => recarregarApi()}>Tentar novamente</button>}</div>}
      {!itens.length && !carregandoApi && <Card>Nenhuma compra recomendada no momento.</Card>}
      <div className="grid g2">
        {itens.map((it) => {
          const st = recStatus[it.id];
          return (
            <Card key={it.id} className="ai" title={it.nome} action={st ? <Badge tone={st === 'aprovada' ? 'ok' : 'mute'}>{st === 'aprovada' ? 'Aprovada' : 'Rejeitada'}</Badge> : <Badge tone={it.tone}>Urgência {it.urg.toLowerCase()}</Badge>}>
              <dl className="dl">
                {([['Ação', it.acao], ['Estoque útil', it.util], ['Cobertura', it.cob === null ? 'Sem consumo cadastrado' : `${it.cob} dias`], ['Prazo de reposição', `${it.prazo} dias`], ['Quantidade sugerida', it.qtd], ['Custo estimado', brl(it.custo)], ...(it.data ? [['Comprar até', dataBR(it.data)]] : [])] as [string, string | number][]).map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
              </dl>
              <div className="list" style={{ margin: '10px 0' }}>{it.just.map((j, k) => <div key={k}><p style={{ color: 'var(--tx)' }}>{j}</p></div>)}</div>
              <div className="bar" style={{ margin: 0 }}>
                <button className="btn" onClick={() => setDet(it.id)}>Ver detalhes</button><button className="btn" onClick={() => setCmp(it.id)}>Comparar fornecedores</button>
                {st ? <button className="btn push" onClick={() => setRec(it.id, null)}>Desfazer</button> : <>
                  <button className="btn crit push" onClick={() => setRec(it.id, 'rejeitada')}>Rejeitar</button><button className="btn ok" onClick={() => setRec(it.id, 'aprovada')}>Aprovar</button></>}
              </div>
            </Card>
          );
        })}
      </div>
      {aberto && det && (
        <Modal title={`Detalhes: ${aberto.nome}`} onClose={() => setDet(null)}>
          {aberto.estoque ? (
            <dl className="dl">{([['Estoque bruto', aberto.estoque.bruto], ['Invalidado (térmico)', aberto.estoque.invalidado_termico], ['Vencido', aberto.estoque.vencido], ['Em risco de vencimento', aberto.estoque.em_risco_de_vencimento], ['Margem de incerteza', aberto.estoque.margem_incerteza_divergencia], ['Estoque útil', aberto.estoque.util]] as [string, number][]).map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
          ) : <p>{aberto.just.join(' ')}</p>}
        </Modal>
      )}
      {aberto && cmp && (
        <Modal title={`Fornecedores: ${aberto.nome}`} onClose={() => setCmp(null)} wide>
          <p className="note">O menor preço nem sempre é a melhor escolha: com urgência alta, prazo e disponibilidade pesam mais. Dados de fornecedores são fictícios.</p>
          {forns.length ? (
            <div className="tbl-wrap"><table><thead><tr>{['Fornecedor', 'Preço unit.', 'Prazo', 'Disponibilidade', 'Total'].map((h) => <th key={h}><button style={{ cursor: 'default' }}>{h}</button></th>)}</tr></thead><tbody>
              {forns.map(({ f, i }) => <tr key={f.id}><td><b>{f.nome}</b></td><td>{brl(i!.preco)}</td><td>{i!.prazo} dias</td><td><Badge tone={i!.disp === 'Alta' ? 'ok' : i!.disp === 'Média' ? 'warn' : 'crit'}>{i!.disp}</Badge></td><td>{brl(i!.preco * aberto.qtd)}</td></tr>)}
            </tbody></table></div>
          ) : <p>Ainda não há fornecedores cadastrados para este medicamento.</p>}
          <div className="acts"><button className="btn pri" onClick={() => setCmp(null)}>Fechar</button></div>
        </Modal>
      )}
    </>
  );
}
