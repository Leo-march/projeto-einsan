'use client';
import { useEffect, useMemo, useState } from 'react';
import { useStore } from '@/context/Store';
import { Badge, Card, Kpi } from '@/components/ui';
import { EstadoApi } from '@/components/AvisoApi';
import { GraficoPrevisao } from '@/components/charts/Charts';
import { consumoDiario } from '@/utils/derivados';
import { dataApiBR, urgLabel, urgTone } from '@/utils/apiHelpers';
import type { Prev } from '@/types';
import { Activity, CalendarX, Clock, ShieldCheck } from 'lucide-react';

export default function Previsao() {
  const { estoque, analise, movs } = useStore();
  const itens = estoque?.itens ?? [];
  const [id, setId] = useState(''); const [h, setH] = useState(30);
  useEffect(() => { const m = new URLSearchParams(location.search).get('m'); if (m) setId(m); }, []);
  const item = itens.find((x) => x.id_medicamento === id) ?? itens[0];
  const rec = analise?.recomendacoes_compra.find((r) => r.id_medicamento === item?.id_medicamento);
  const ref = analise?.meta.data_referencia ?? estoque?.meta.data_referencia;
  const util = rec?.estoque.util ?? item?.saldo_registrado ?? 0;
  const dados = useMemo<Prev[]>(() => {
    if (!item || !ref) return [];
    const hist: Prev[] = consumoDiario(movs, item.id_medicamento, ref, 30).map((p) => ({ d: p.d, real: p.real, prev: null, estoque: null }));
    const fut: Prev[] = Array.from({ length: h }, (_, n) => {
      const k = new Date(new Date(ref).getTime() + (n + 1) * 864e5).toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
      return { d: `${k.slice(8, 10)}/${k.slice(5, 7)}`, real: null, prev: item.consumo_medio_diario, estoque: Math.max(0, Math.round((util - item.consumo_medio_diario * (n + 1)) * 10) / 10) };
    });
    return [...hist, ...fut];
  }, [item, ref, movs, h, util]);
  if (!item) return <><EstadoApi ok={!!estoque} /></>;
  const dispensado30 = dados.filter((p) => p.real !== null).reduce((s, p) => s + (p.real ?? 0), 0);
  const rup = rec?.cobertura_dias != null && ref ? new Date(new Date(ref).getTime() + rec.cobertura_dias * 864e5).toISOString() : null;
  const soma = (n: number) => Math.round(item.consumo_medio_diario * n * 10) / 10;
  return (
    <>
      <EstadoApi ok={!!estoque} />
      <div className="note">Projeção linear: estoque útil menos o consumo médio diário da API (dispensações dos últimos 30 dias). Não é um modelo de IA: não considera tendência, sazonalidade nem reposições futuras.</div>
      <div className="bar"><select aria-label="Medicamento" value={item.id_medicamento} onChange={(e) => setId(e.target.value)}>{itens.map((x) => <option key={x.id_medicamento} value={x.id_medicamento}>{x.nome}</option>)}</select>
        {rec && <Badge tone={urgTone(rec.urgencia)}>Urgência {(urgLabel[rec.urgencia] ?? rec.urgencia).toLowerCase()}</Badge>}
        <div className="seg push">{[7, 15, 30].map((n) => <button key={n} className={h === n ? 'on' : ''} onClick={() => setH(n)}>{n} dias</button>)}</div></div>
      <div className="grid g6">
        <Kpi icon={<Activity size={20} />} label="Consumo médio diário" value={`${item.consumo_medio_diario}`} note={`${dispensado30} un. dispensadas em 30 dias`} />
        <Kpi icon={<CalendarX size={20} />} label="Ruptura estimada" value={rup ? dataApiBR(rup) : rec?.cobertura_dias === null ? 'Sem consumo' : '-'} tone={rec && rec.cobertura_dias !== null && rec.cobertura_dias <= rec.prazo_reposicao_dias ? 'crit' : 'ok'} note={rec?.cobertura_dias != null ? `Cobertura de ${rec.cobertura_dias} dias` : undefined} />
        <Kpi icon={<ShieldCheck size={20} />} label="Estoque útil" value={`${util} un.`} note={`Bruto: ${item.saldo_registrado}`} />
        <Kpi icon={<Clock size={20} />} label="Prazo de reposição" value={rec ? `${rec.prazo_reposicao_dias} dias` : '-'} tone="warn" />
      </div>
      <div className="grid g2" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,420px),1fr))' }}>
        <Card title={`Consumo histórico e estoque projetado (${h} dias)`}><GraficoPrevisao data={dados} prazo={rec?.prazo_reposicao_dias ?? 1} /></Card>
        <Card title="Demanda projetada"><dl className="dl">{[7, 15, 30].map((n) => <div key={n}><dt>Próximos {n} dias</dt><dd>{soma(n)} un.</dd></div>)}</dl>
          {rec && <><h4 style={{ margin: '14px 0 6px' }}>Composição do estoque</h4><dl className="dl">{([['Bruto', rec.estoque.bruto], ['Invalidado (térmico)', rec.estoque.invalidado_termico], ['Vencido', rec.estoque.vencido], ['Em risco de vencimento', rec.estoque.em_risco_de_vencimento], ['Útil', rec.estoque.util]] as [string, number][]).map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl></>}
        </Card>
      </div>
    </>
  );
}
