'use client';
import { useEffect, useState } from 'react';
import { useStore } from '@/context/Store';
import { Badge, Card, Kpi } from '@/components/ui';
import { GraficoPrevisao } from '@/components/charts/Charts';
import { tendencia } from '@/data/mockData';
import { addDias, dataBR, iso, previsaoDe, situacao, sitTone } from '@/utils/calculations';
import { Activity, CalendarX, Clock, ShieldCheck } from 'lucide-react';

export default function Previsao() {
  const { meds } = useStore();
  const [id, setId] = useState(meds[0]?.id ?? ''); const [h, setH] = useState(30);
  useEffect(() => { const m = new URLSearchParams(location.search).get('m'); if (m) setId(m); }, []);
  const m = meds.find((x) => x.id === id) ?? meds[0];
  if (!m) return <Card>Cadastre um medicamento para ver a previsão.</Card>;
  const pv = previsaoDe(m), fut = pv.filter((p) => p.prev !== null);
  const soma = (n: number) => Math.round(fut.slice(0, n).reduce((s, p) => s + (p.prev ?? 0), 0));
  const t = tendencia[m.id] ?? 0;
  const diasR = (() => { const i = fut.findIndex((p) => (p.estoque ?? 0) <= 0); return i < 0 ? null : i + 1; })();
  const diasSeg = fut.findIndex((p) => (p.estoque ?? 0) <= m.seg);
  const pts = [...pv.filter((p) => p.real !== null), ...fut.slice(0, h)];
  return (
    <>
      <div className="note">Previsões demonstrativas: calculadas com média móvel e tendência linear (pandas) sobre dados fictícios. Não representam resultado de um modelo de IA em produção.</div>
      <div className="bar"><select aria-label="Medicamento" value={m.id} onChange={(e) => setId(e.target.value)}>{meds.map((x) => <option key={x.id} value={x.id}>{x.nome}</option>)}</select>
        <Badge tone={sitTone(situacao(m))}>Estoque {situacao(m).toLowerCase()}</Badge>
        <div className="seg push">{[7, 15, 30].map((n) => <button key={n} className={h === n ? 'on' : ''} onClick={() => setH(n)}>{n} dias</button>)}</div></div>
      <div className="grid g6">
        <Kpi icon={<Activity size={20} />} label="Consumo médio diário" value={`${m.consumo}`} note={`Tendência ${t >= 0 ? '+' : ''}${t}% (30 dias)`} />
        <Kpi icon={<CalendarX size={20} />} label="Ruptura estimada" value={diasR ? dataBR(iso(addDias(diasR))) : 'Fora de 30 dias'} tone={diasR && diasR <= m.prazo ? 'crit' : 'ok'} note={`Reserva de segurança em ${diasSeg < 0 ? '+30' : diasSeg + 1} dias`} />
        <Kpi icon={<ShieldCheck size={20} />} label="Estoque de segurança" value={`${m.seg} ${m.un}(s)`} note={`Estoque atual: ${m.estoque}`} />
        <Kpi icon={<Clock size={20} />} label="Prazo de entrega" value={`${m.prazo} dias`} tone="warn" note="Prazo médio de reposição" />
      </div>
      <div className="grid g2" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,420px),1fr))' }}>
        <Card title={`Consumo histórico, demanda prevista e estoque (${h} dias)`}><GraficoPrevisao data={pts} prazo={m.prazo} /></Card>
        <div style={{ display: 'grid', gap: 16, alignContent: 'start' }}>
          <Card title="Demanda prevista"><dl className="dl">{[7, 15, 30].map((n) => <div key={n}><dt>Próximos {n} dias</dt><dd>{soma(n)} {m.un}(s)</dd></div>)}</dl></Card>
          <Card title="Fatores considerados"><div className="list">
            <div><div className="grow"><b>Média dos últimos 30 dias</b><p>{m.consumo} unidades/dia como base da projeção.</p></div></div>
            <div><div className="grow"><b>Tendência de consumo</b><p>{t >= 0 ? 'Alta' : 'Queda'} de {Math.abs(t)}% frente aos 30 dias anteriores, aplicada de forma amortecida.</p></div></div>
            <div><div className="grow"><b>Prazo de reposição</b><p>{m.prazo} dias entre o pedido e a chegada ao cofre.</p></div></div>
            <div><div className="grow"><b>Estoque de segurança</b><p>Reserva de {m.seg} unidades, equivalente a 3 dias de consumo.</p></div></div>
          </div></Card>
        </div>
      </div>
    </>
  );
}
