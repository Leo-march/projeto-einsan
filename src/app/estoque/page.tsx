'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Package, Wallet, AlertTriangle } from 'lucide-react';
import { useStore } from '@/context/Store';
import { Badge, Card, DataTable, Kpi, Modal, SearchBox, Sel, type Col } from '@/components/ui';
import { AvisosQualidade, EstadoApi } from '@/components/AvisoApi';
import { brl } from '@/utils/calculations';
import { dataApiBR, loteLabel, loteTone } from '@/utils/apiHelpers';
import type { ItemEstoqueApi, StatusLoteApi } from '@/types/api';

const cobertura = (i: ItemEstoqueApi) => (i.consumo_medio_diario > 0 ? Math.round((i.saldo_registrado / i.consumo_medio_diario) * 10) / 10 : null);
const resumoSituacoes = (i: ItemEstoqueApi) => (['INVALIDADO_TERMICO', 'VENCIDO', 'VENCE_EM_30_DIAS', 'OK'] as StatusLoteApi[])
  .map((status) => ({ status, quantidade: i.lotes.filter((l) => l.status === status).reduce((total, l) => total + l.quantidade, 0) }))
  .filter((x) => x.quantidade > 0);

export default function Estoque() {
  const { estoque } = useStore();
  const [q, setQ] = useState(''), [sit, setSit] = useState('Todas');
  const [sel, setSel] = useState<string | null>(null);
  useEffect(() => setQ(new URLSearchParams(location.search).get('q') ?? ''), []);
  const itens = estoque?.itens ?? [];
  const rows = useMemo(() => itens.filter((i) => (i.nome + i.id_medicamento).toLowerCase().includes(q.toLowerCase()) && (sit === 'Todas' || i.lotes.some((l) => l.status === sit))), [itens, q, sit]);
  const aberto = itens.find((i) => i.id_medicamento === sel);
  const cols: Col<ItemEstoqueApi>[] = [
    { label: 'Medicamento', val: (i) => i.nome, render: (i) => <b>{i.nome}</b> },
    { label: 'Código', val: (i) => i.id_medicamento },
    { label: 'Saldo (un.)', val: (i) => i.saldo_registrado },
    { label: 'Valor imobilizado', val: (i) => i.valor_imobilizado_brl, render: (i) => brl(i.valor_imobilizado_brl) },
    { label: 'Lote mais próximo', val: (i) => i.lotes[0]?.codigo_lote ?? '-' },
    { label: 'Validade', val: (i) => i.lotes[0]?.validade ?? '', render: (i) => i.lotes[0] ? dataApiBR(i.lotes[0].validade) : '-' },
    { label: 'Consumo/dia', val: (i) => i.consumo_medio_diario },
    { label: 'Cobertura', val: (i) => cobertura(i) ?? 9999, render: (i) => { const c = cobertura(i); return c === null ? 'Sem consumo' : `${c} dias`; } },
    { label: 'Situação por recebimento', val: (i) => resumoSituacoes(i).map((x) => x.status).join(', '), render: (i) => <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{resumoSituacoes(i).map(({ status, quantidade }) => <Badge key={status} tone={loteTone[status]}>{loteLabel[status]} · {quantidade} un.</Badge>)}</div> },
  ];
  return (
    <>
      <EstadoApi ok={!!estoque} />
      {estoque && (
        <div className="grid g6" style={{ marginBottom: 16 }}>
          <Kpi icon={<Package size={20} />} label="Unidades em estoque" value={String(estoque.totais.unidades)} />
          <Kpi icon={<Wallet size={20} />} label="Valor imobilizado" value={brl(estoque.totais.valor_imobilizado_brl)} />
          <Kpi icon={<AlertTriangle size={20} />} label="Lotes em alerta" value={String(estoque.totais.lotes_em_alerta)} tone={estoque.totais.lotes_em_alerta ? 'warn' : 'ok'} />
        </div>
      )}
      <Card>
        <div className="bar">
          <SearchBox value={q} onChange={setQ} placeholder="Nome ou código" />
          <Sel label="Situação" value={sit} onChange={setSit} opts={['Todas', 'OK', 'VENCE_EM_30_DIAS', 'VENCIDO', 'INVALIDADO_TERMICO']} />
        </div>
        <p className="note">As situações e quantidades são exibidas por recebimento. Um recebimento novo pode estar no prazo mesmo que unidades anteriores do mesmo código tenham sido invalidadas.</p>
        <DataTable rows={rows} cols={cols} onRow={(i) => setSel(i.id_medicamento)} />
        {estoque && <AvisosQualidade avisos={estoque.qualidade_dados.avisos} />}
        {aberto && (
          <Modal title={aberto.nome} onClose={() => setSel(null)} wide>
            <dl className="dl">{([['Código', aberto.id_medicamento], ['Saldo registrado', `${aberto.saldo_registrado} un.`], ['Valor imobilizado', brl(aberto.valor_imobilizado_brl)], ['Consumo médio', `${aberto.consumo_medio_diario}/dia`]] as [string, string][]).map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
            <h4 style={{ margin: '18px 0 6px' }}>Recebimentos (FEFO: vence primeiro, sai primeiro)</h4>
            <div className="list">{aberto.lotes.map((l) => <div key={l.id_recebimento}><div className="grow"><b>{l.codigo_lote}</b><p>{l.quantidade} un. · recebido em {dataApiBR(l.primeira_entrada)} · validade {dataApiBR(l.validade)} · {l.dias_para_vencer} dias</p></div><Badge tone={loteTone[l.status]}>{loteLabel[l.status]}</Badge></div>)}</div>
            <div className="acts"><Link className="btn pri" href={`/movimentacoes?m=${aberto.id_medicamento}`}>Ver movimentações</Link></div>
          </Modal>
        )}
      </Card>
    </>
  );
}
