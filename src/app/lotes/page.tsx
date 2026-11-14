'use client';
import { useState } from 'react';
import { useStore } from '@/context/Store';
import { Badge, Card, DataTable, Kpi, Sel, type Col } from '@/components/ui';
import { lotes } from '@/data/mockData';
import { dataBR, diasPara, sitLote, sitTone } from '@/utils/calculations';
import type { Lote } from '@/types';
import { CheckCircle2, Clock, AlertTriangle, XCircle } from 'lucide-react';

export default function Lotes() {
  const { meds } = useStore();
  const [f, setF] = useState('Todos');
  const nome = (id: string) => meds.find((m) => m.id === id)?.nome ?? id;
  const validos = lotes.filter((l) => meds.some((m) => m.id === l.medId));
  const cont = (s: string) => validos.filter((l) => sitLote(l.val) === s).length;
  const fefo = [...validos].filter((l) => diasPara(l.val) >= 0).sort((a, b) => a.val.localeCompare(b.val)).slice(0, 5);
  const cols: Col<Lote>[] = [
    { label: 'Medicamento', val: (l) => nome(l.medId), render: (l) => <b>{nome(l.medId)}</b> }, { label: 'Lote', val: (l) => l.lote }, { label: 'Quantidade', val: (l) => l.qtd },
    { label: 'Fabricação', val: (l) => l.fab, render: (l) => dataBR(l.fab) }, { label: 'Validade', val: (l) => l.val, render: (l) => dataBR(l.val) },
    { label: 'Dias restantes', val: (l) => diasPara(l.val) }, { label: 'Situação', val: (l) => sitLote(l.val), render: (l) => <Badge tone={sitTone(sitLote(l.val))}>{sitLote(l.val) === 'Normal' ? 'Validade normal' : sitLote(l.val) === 'Próximo' ? 'Vencimento próximo' : sitLote(l.val) === 'Crítico' ? 'Vencimento crítico' : 'Vencido'}</Badge> },
  ];
  return (
    <>
      <div className="grid g6">
        <Kpi icon={<CheckCircle2 size={20} />} tone="ok" label="Validade normal" value={String(cont('Normal'))} />
        <Kpi icon={<Clock size={20} />} tone="warn" label="Vencimento próximo (31 a 60 dias)" value={String(cont('Próximo'))} />
        <Kpi icon={<AlertTriangle size={20} />} tone="crit" label="Vencimento crítico (até 30 dias)" value={String(cont('Crítico'))} />
        <Kpi icon={<XCircle size={20} />} tone="crit" label="Lotes vencidos" value={String(cont('Vencido'))} />
      </div>
      <div className="grid g2" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,340px),1fr))' }}>
        <Card title="Ordem de uso (FEFO)"><p className="note">Primeiro a vencer, primeiro a sair: use os lotes nesta ordem.</p>
          <div className="list">{fefo.map((l, i) => <div key={l.id}><b>{i + 1}.</b><div className="grow"><b>{nome(l.medId)}</b><p>{l.lote} · {l.qtd} un. · vence em {diasPara(l.val)} dias ({dataBR(l.val)})</p></div><Badge tone={sitTone(sitLote(l.val))}>{sitLote(l.val)}</Badge></div>)}</div></Card>
        <Card title="Rastreabilidade de lotes" action={<Sel label="Situação" value={f} onChange={setF} opts={['Todos', 'Normal', 'Próximo', 'Crítico', 'Vencido']} />}>
          <DataTable rows={validos.filter((l) => f === 'Todos' || sitLote(l.val) === f)} cols={cols} pageSize={6} />
        </Card>
      </div>
    </>
  );
}
