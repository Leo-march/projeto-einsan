'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useStore } from '@/context/Store';
import { Badge, Card, DataTable, Modal, SearchBox, Sel, type Col } from '@/components/ui';
import { lotes } from '@/data/mockData';
import { dataBR, diasPara, proxVal, sitLote, sitTone, situacao } from '@/utils/calculations';
import type { Med } from '@/types';

export default function Estoque() {
  const { meds } = useStore();
  const [q, setQ] = useState(''), [cat, setCat] = useState('Todas'), [sit, setSit] = useState('Todas'), [val, setVal] = useState('Todas');
  const [sel, setSel] = useState<Med | null>(null);
  useEffect(() => setQ(new URLSearchParams(location.search).get('q') ?? ''), []);
  const rows = useMemo(() => meds.filter((m) => {
    const d = diasPara(proxVal(m.id, lotes) ?? '2099-01-01');
    return (m.nome + m.id).toLowerCase().includes(q.toLowerCase()) && (cat === 'Todas' || m.cat === cat) && (sit === 'Todas' || situacao(m) === sit)
      && (val === 'Todas' || (val === 'Vencidos' ? d < 0 : val === 'Até 30 dias' ? d <= 30 : d <= 60));
  }), [meds, q, cat, sit, val]);
  const cols: Col<Med>[] = [
    { label: 'Medicamento', val: (m) => m.nome, render: (m) => <b>{m.nome}</b> },
    { label: 'Código', val: (m) => m.id }, { label: 'Categoria', val: (m) => m.cat },
    { label: 'Quantidade', val: (m) => m.estoque }, { label: 'Unidade', val: (m) => m.un },
    { label: 'Lote (mais próximo)', val: (m) => lotes.filter((l) => l.medId === m.id).sort((a, b) => a.val.localeCompare(b.val))[0]?.lote ?? '-' },
    { label: 'Validade', val: (m) => proxVal(m.id, lotes) ?? '', render: (m) => { const v = proxVal(m.id, lotes); return v ? <>{dataBR(v)} <Badge tone={sitTone(sitLote(v))}>{sitLote(v) === 'Normal' ? 'No prazo' : sitLote(v)}</Badge></> : '-'; } },
    { label: 'Consumo/dia', val: (m) => m.consumo },
    { label: 'Situação', val: (m) => situacao(m), render: (m) => <Badge tone={sitTone(situacao(m))}>{situacao(m)}</Badge> },
  ];
  return (
    <Card>
      <div className="bar">
        <SearchBox value={q} onChange={setQ} placeholder="Nome ou código" />
        <Sel label="Categoria" value={cat} onChange={setCat} opts={['Todas', ...Array.from(new Set(meds.map((m) => m.cat)))]} />
        <Sel label="Situação" value={sit} onChange={setSit} opts={['Todas', 'Normal', 'Baixo', 'Crítico']} />
        <Sel label="Validade" value={val} onChange={setVal} opts={['Todas', 'Até 60 dias', 'Até 30 dias', 'Vencidos']} />
      </div>
      <DataTable rows={rows} cols={cols} onRow={setSel} />
      {sel && (
        <Modal title={sel.nome} onClose={() => setSel(null)} wide>
          <dl className="dl">{([['Código', sel.id], ['Fabricante', sel.fab], ['Temperatura', sel.temp], ['Em estoque', `${sel.estoque} ${sel.un}(s)`], ['Estoque mínimo', sel.min], ['Estoque de segurança', sel.seg], ['Consumo médio', `${sel.consumo}/dia`], ['Prazo de reposição', `${sel.prazo} dias`]] as [string, string | number][]).map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
          <h4 style={{ margin: '18px 0 6px' }}>Lotes (FEFO: vence primeiro, sai primeiro)</h4>
          <div className="list">{lotes.filter((l) => l.medId === sel.id).sort((a, b) => a.val.localeCompare(b.val)).map((l) => <div key={l.id}><div className="grow"><b>{l.lote}</b><p>{l.qtd} un. · validade {dataBR(l.val)}</p></div><Badge tone={sitTone(sitLote(l.val))}>{sitLote(l.val)}</Badge></div>)}</div>
          <div className="acts"><Link className="btn pri" href={`/previsao?m=${sel.id}`}>Ver previsão de demanda</Link></div>
        </Modal>
      )}
    </Card>
  );
}
