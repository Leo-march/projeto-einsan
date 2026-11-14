'use client';
import Link from 'next/link';
import { useMemo } from 'react';
import { Pill, Wallet, TrendingDown, CalendarClock, ShoppingCart, AlertOctagon, ShieldAlert, ThermometerSnowflake, PackageX, DoorOpen } from 'lucide-react';
import { useStore } from '@/context/Store';
import { Badge, Card, Kpi } from '@/components/ui';
import { AvisosQualidade, EstadoApi } from '@/components/AvisoApi';
import { LinhaConsumo, AreaValor, BarrasH, Rosca, EntSai } from '@/components/charts/Charts';
import { brl } from '@/utils/calculations';
import { consumoPorMed, serieMensal } from '@/utils/derivados';
import { ACAO, alertasDaApi, dataHoraBR, statusLabel, statusTone, urgTone } from '@/utils/apiHelpers';

export default function Dashboard() {
  const { analise, estoque, movs, custo } = useStore();
  const serie = useMemo(() => serieMensal(movs, custo), [movs, custo]);
  const top = useMemo(() => {
    const c = consumoPorMed(movs);
    return (estoque?.itens ?? []).map((i) => ({ nome: i.nome.split(' ')[0], valor: c[i.id_medicamento] ?? 0 })).sort((a, b) => b.valor - a.valor).slice(0, 6);
  }, [movs, estoque]);
  const porMed = (estoque?.itens ?? []).map((i) => ({ nome: i.nome.split(' ')[0], valor: Math.round(i.valor_imobilizado_brl) }));

  const alertas = analise ? alertasDaApi(analise) : [];
  const recs = (analise?.recomendacoes_compra ?? []).filter((r) => r.recomendar_compra !== false);
  const crit = recs.filter((r) => r.urgencia === 'CRITICA').length;
  const baixo = recs.filter((r) => r.urgencia === 'ALTA' || r.urgencia === 'MEDIA').length;
  const venc = (estoque?.itens ?? []).reduce((n, i) => n + i.lotes.filter((l) => l.status === 'VENCE_EM_30_DIAS').length, 0);

  return (
    <>
      <EstadoApi ok={!!analise && !!estoque} />
      {analise && estoque && (
        <>
          <Card title={`Cofre ${analise.meta.cofre_id}: análise térmica e de estoque`} action={<Badge tone={statusTone(analise.resumo.status_geral)}>Status geral: {statusLabel[analise.resumo.status_geral]}</Badge>}>
            <div className="grid g6" style={{ marginBottom: 8 }}>
              <Kpi icon={<ShieldAlert size={20} />} label="Alertas ativos" value={String(analise.resumo.total_alertas)} tone={analise.resumo.total_alertas ? 'crit' : 'ok'} />
              <Kpi icon={<ThermometerSnowflake size={20} />} label="Lotes invalidados" value={String(analise.resumo.lotes_invalidados)} tone={analise.resumo.lotes_invalidados ? 'crit' : 'ok'} note="Excursão térmica" />
              <Kpi icon={<PackageX size={20} />} label="Unidades invalidadas" value={String(analise.resumo.unidades_invalidadas)} tone={analise.resumo.unidades_invalidadas ? 'warn' : 'ok'} />
              <Kpi icon={<DoorOpen size={20} />} label="Divergências de estoque" value={String(analise.resumo.divergencias_estoque)} tone={analise.resumo.divergencias_estoque ? 'warn' : 'ok'} note="Retiradas não identificadas" />
              <Kpi icon={<Wallet size={20} />} label="Custo de compra recomendado" value={brl(analise.resumo.custo_total_recomendado_brl)} note={`${analise.resumo.medicamentos_com_compra_recomendada} medicamentos`} />
            </div>
            <p style={{ color: 'var(--mu)', fontSize: 12 }}>Análise gerada em {dataHoraBR(analise.meta.gerado_em)} (horário de Brasília) · referência {dataHoraBR(analise.meta.data_referencia)} · regras {analise.meta.versao_regras}</p>
            {analise.qualidade_dados && <AvisosQualidade avisos={analise.qualidade_dados.avisos} />}
          </Card>
          <div className="grid g6" style={{ marginTop: 16 }}>
            <Kpi icon={<Pill size={20} />} label="Medicamentos no cofre" value={String(estoque.itens.length)} note={`Cofre ${estoque.meta.cofre_id}`} />
            <Kpi icon={<Wallet size={20} />} label="Valor imobilizado" value={brl(estoque.totais.valor_imobilizado_brl)} tone="ok" note={`${estoque.totais.unidades} unidades`} />
            <Kpi icon={<TrendingDown size={20} />} label="Reposição prioritária" value={String(baixo)} tone="warn" note="Urgência alta ou média" />
            <Kpi icon={<CalendarClock size={20} />} label="Próximos do vencimento" value={String(venc)} tone="warn" note="Lotes que vencem em até 30 dias" />
            <Kpi icon={<ShoppingCart size={20} />} label="Compras recomendadas" value={String(analise.resumo.medicamentos_com_compra_recomendada)} note="Calculadas pela API" />
            <Kpi icon={<AlertOctagon size={20} />} label="Situação crítica" value={String(crit)} tone="crit" note="Cobertura ≤ prazo de reposição" />
          </div>
          <div className="grid g2">
            <Card title="Inteligência Einsan" className="ai">
              {recs.slice(0, 2).map((r) => (
                <div key={r.id_medicamento} style={{ marginBottom: 14 }}>
                  <h4>{r.nome} <Badge tone={urgTone(r.urgencia)}>{ACAO[r.acao] ?? r.acao}</Badge></h4>
                  <dl className="dl">{([['Estoque útil', String(r.estoque.util)], ['Cobertura', r.cobertura_dias === null ? 'Sem histórico de consumo' : `${r.cobertura_dias} dias`], ['Prazo de reposição', `${r.prazo_reposicao_dias} dias`], ['Quantidade sugerida', String(r.quantidade_sugerida)]] as [string, string][]).map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
                  <p className="j">{r.justificativas.join(' ')}</p>
                </div>
              ))}
              {!recs.length && <p className="j">Nenhuma compra recomendada no momento.</p>}
              <Link className="btn pri" href="/compras">Ver todas as recomendações</Link>
            </Card>
            <Card title="Alertas importantes"><div className="list">{alertas.slice(0, 7).map((a, i) => (
              <div key={i}><Badge tone={a.tone}>{a.grav}</Badge><div className="grow"><b>{a.med}</b><p>{a.texto}</p></div></div>
            ))}{!alertas.length && <p className="j">Nenhum alerta ativo.</p>}</div></Card>
          </div>
          <div className="grid g2">
            <Card title="Consumo mensal (dispensações)"><LinhaConsumo data={serie} /></Card>
            <Card title="Valor das compras por mês (R$)"><AreaValor data={serie} k="valorCompras" label="Compras" /></Card>
            <Card title="Medicamentos mais dispensados (histórico)"><BarrasH data={top} /></Card>
            <Card title="Valor imobilizado por medicamento"><Rosca data={porMed} /></Card>
          </div>
          <Card title="Entradas e saídas por mês (unidades)"><EntSai data={serie} /></Card>
        </>
      )}
    </>
  );
}