'use client';
import { useState } from 'react';
import { CheckCircle2, Clock, XCircle, ThermometerSnowflake } from 'lucide-react';
import { useStore } from '@/context/Store';
import { Badge, Card, DataTable, Kpi, Sel, type Col } from '@/components/ui';
import { EstadoApi } from '@/components/AvisoApi';
import { dataApiBR, loteLabel, loteTone } from '@/utils/apiHelpers';
import type { LoteApi } from '@/types/api';

type Linha = LoteApi & { id_medicamento: string; nome: string };

export default function Lotes() {
  const { estoque } = useStore();
  const [f, setF] = useState('Todos');
  const lotes: Linha[] = (estoque?.itens ?? []).flatMap((i) => i.lotes.map((l) => ({ ...l, id_medicamento: i.id_medicamento, nome: i.nome })));
  const cont = (s: string) => lotes.filter((l) => l.status === s).length;
  // Só lotes utilizáveis entram na ordem de uso; vencidos e invalidados vão para descarte.
  const fefo = lotes.filter((l) => l.status === 'OK' || l.status === 'VENCE_EM_30_DIAS').sort((a, b) => a.dias_para_vencer - b.dias_para_vencer).slice(0, 5);
  const cols: Col<Linha>[] = [
    { label: 'Medicamento', val: (l) => l.nome, render: (l) => <b>{l.nome}</b> }, { label: 'Lote', val: (l) => l.codigo_lote }, { label: 'Quantidade', val: (l) => l.quantidade },
    { label: 'Validade', val: (l) => l.validade, render: (l) => dataApiBR(l.validade) }, { label: 'Dias restantes', val: (l) => l.dias_para_vencer },
    { label: 'Situação', val: (l) => l.status, render: (l) => <Badge tone={loteTone[l.status]}>{loteLabel[l.status]}</Badge> },
  ];
  return (
    <>
      <EstadoApi ok={!!estoque} />
      <div className="grid g6">
        <Kpi icon={<CheckCircle2 size={20} />} tone="ok" label="No prazo" value={String(cont('OK'))} />
        <Kpi icon={<Clock size={20} />} tone="warn" label="Vencem em até 30 dias" value={String(cont('VENCE_EM_30_DIAS'))} />
        <Kpi icon={<XCircle size={20} />} tone="crit" label="Lotes vencidos" value={String(cont('VENCIDO'))} />
        <Kpi icon={<ThermometerSnowflake size={20} />} tone="crit" label="Invalidados (térmico)" value={String(cont('INVALIDADO_TERMICO'))} />
      </div>
      <div className="grid g2" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,340px),1fr))' }}>
        <Card title="Ordem de uso (FEFO)"><p className="note">Primeiro a vencer, primeiro a sair. Lotes vencidos ou invalidados não entram: registre-os como descarte.</p>
          <div className="list">{fefo.map((l, i) => <div key={l.id_medicamento + l.codigo_lote}><b>{i + 1}.</b><div className="grow"><b>{l.nome}</b><p>{l.codigo_lote} · {l.quantidade} un. · vence em {l.dias_para_vencer} dias ({dataApiBR(l.validade)})</p></div><Badge tone={loteTone[l.status]}>{loteLabel[l.status]}</Badge></div>)}
            {!fefo.length && <p className="j">Nenhum lote utilizável.</p>}</div></Card>
        <Card title="Rastreabilidade de lotes" action={<Sel label="Situação" value={f} onChange={setF} opts={['Todos', 'OK', 'VENCE_EM_30_DIAS', 'VENCIDO', 'INVALIDADO_TERMICO']} />}>
          <DataTable rows={lotes.filter((l) => f === 'Todos' || l.status === f)} cols={cols} pageSize={6} />
        </Card>
      </div>
    </>
  );
}
