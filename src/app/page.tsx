'use client';
import Link from 'next/link';
import { Pill, Wallet, TrendingDown, CalendarClock, ShoppingCart, AlertOctagon, ShieldAlert, ThermometerSnowflake, PackageX, DoorOpen } from 'lucide-react';
import { useStore } from '@/context/Store';
import { Badge, Card, Kpi } from '@/components/ui';
import { LinhaConsumo, AreaValor, BarrasH, Rosca, EntSai } from '@/components/charts/Charts';
import { lotes, movs, series } from '@/data/mockData';
import { brl, dataBR, diasPara, gerarAlertas, recomendar, situacao } from '@/utils/calculations';
import { ACAO, alertasDaApi, dataHoraBR, statusLabel, statusTone, urgTone } from '@/utils/apiHelpers';
import type { Med, Rec, Tone } from '@/types';

type Destaque = { nome: string; tone: Tone; tag: string; linhas: [string, string][]; texto: string };

export default function Dashboard() {
  const { meds, recStatus, analise, erroApi, carregandoApi, recarregarApi } = useStore();
  const alertas = analise ? alertasDaApi(analise) : gerarAlertas(meds, lotes, movs.filter((m) => m.tipo === 'Ajuste'));
  const recs = meds.map((m) => ({ m, r: recomendar(m) })).filter((x): x is { m: Med; r: Rec } => !!x.r).sort((a, b) => +b.r.urgente - +a.r.urgente);
  const valor = meds.reduce((s, m) => s + m.estoque * m.preco, 0);
  const ids = Object.keys(series);
  const ag = series[ids[0]].map((s, i) => {
    const t = (k: 'consumo' | 'entradas' | 'saidas' | 'valor') => ids.reduce((a, id) => a + series[id][i][k], 0);
    return { mes: s.mes, consumo: t('consumo'), entradas: t('entradas'), saidas: t('saidas'), valor: t('valor') };
  });
  const cheio = ag.slice(0, -1);
  const dv = ag.length > 1 ? Math.round((ag[ag.length - 1].valor / ag[ag.length - 2].valor - 1) * 100) : 0;
  const dc = Math.round((cheio[cheio.length - 1].consumo / cheio[cheio.length - 2].consumo - 1) * 100);
  const top = meds.map((m) => ({ nome: m.nome.split(' ')[0], valor: (series[m.id] ?? []).slice(-4, -1).reduce((s, x) => s + x.consumo, 0) })).sort((a, b) => b.valor - a.valor).slice(0, 6);
  const cats = Object.entries(meds.reduce((o, m) => ({ ...o, [m.cat]: (o[m.cat] ?? 0) + m.estoque * m.preco }), {} as Record<string, number>)).map(([nome, v]) => ({ nome, valor: Math.round(v) }));
  const crit = meds.filter((m) => situacao(m) === 'Crítico').length;
  const baixo = meds.filter((m) => situacao(m) === 'Baixo').length;
  const venc = new Set(lotes.filter((l) => diasPara(l.val) <= 60).map((l) => l.medId)).size;

  const destaques: Destaque[] = analise
    ? analise.recomendacoes_compra.filter((r) => r.recomendar_compra !== false).slice(0, 2).map((r) => ({
        nome: r.nome, tone: urgTone(r.urgencia), tag: ACAO[r.acao] ?? r.acao,
        linhas: [['Estoque útil', String(r.estoque.util)], ['Cobertura', r.cobertura_dias === null ? 'Sem consumo cadastrado' : `${r.cobertura_dias} dias`], ['Prazo de reposição', `${r.prazo_reposicao_dias} dias`], ['Quantidade sugerida', String(r.quantidade_sugerida)]],
        texto: r.justificativas.join(' '),
      }))
    : recs.slice(0, 2).map(({ m, r }) => ({
        nome: m.nome, tone: r.urgente ? 'crit' : 'warn', tag: r.urgente ? 'Comprar agora' : `Comprar até ${dataBR(r.dataCompra)}`,
        linhas: [['Quantidade atual', `${m.estoque} ${m.un}(s)`], ['Consumo médio', `${m.consumo}/dia`], ['Necessidade em 30 dias', String(r.prev30)], ['Quantidade recomendada', String(r.qtd)]], texto: r.justificativa,
      }));

  return (
    <>
      {analise ? (
        <Card title={`Cofre ${analise.meta.cofre_id}: análise térmica e de estoque`} action={<Badge tone={statusTone(analise.resumo.status_geral)}>Status geral: {statusLabel[analise.resumo.status_geral]}</Badge>}>
          <div className="grid g6" style={{ marginBottom: 8 }}>
            <Kpi icon={<ShieldAlert size={20} />} label="Alertas ativos" value={String(analise.resumo.total_alertas)} tone={analise.resumo.total_alertas ? 'crit' : 'ok'} />
            <Kpi icon={<ThermometerSnowflake size={20} />} label="Lotes invalidados" value={String(analise.resumo.lotes_invalidados)} tone={analise.resumo.lotes_invalidados ? 'crit' : 'ok'} note="Excursão térmica" />
            <Kpi icon={<PackageX size={20} />} label="Unidades invalidadas" value={String(analise.resumo.unidades_invalidadas)} tone={analise.resumo.unidades_invalidadas ? 'warn' : 'ok'} />
            <Kpi icon={<DoorOpen size={20} />} label="Divergências de estoque" value={String(analise.resumo.divergencias_estoque)} tone={analise.resumo.divergencias_estoque ? 'warn' : 'ok'} note="Retiradas não identificadas" />
            <Kpi icon={<Wallet size={20} />} label="Custo de compra recomendado" value={brl(analise.resumo.custo_total_recomendado_brl)} note={`${analise.resumo.medicamentos_com_compra_recomendada} medicamentos`} />
          </div>
          <p style={{ color: 'var(--mu)', fontSize: 12 }}>Análise gerada em {dataHoraBR(analise.meta.gerado_em)} (horário de Brasília) · regras {analise.meta.versao_regras}</p>
        </Card>
      ) : (
        <div className="note">{carregandoApi ? 'Carregando análise do cofre…' : `API indisponível (${erroApi}). Exibindo dados de demonstração.`} {!carregandoApi && <button className="btn" onClick={() => recarregarApi()}>Tentar novamente</button>}</div>
      )}
      <div className="grid g6" style={{ marginTop: 16 }}>
        <Kpi icon={<Pill size={20} />} label="Medicamentos cadastrados" value={String(meds.length)} note="Em cofres refrigerados" />
        <Kpi icon={<Wallet size={20} />} label="Valor total do estoque" value={brl(valor)} tone="ok" note={`${dv >= 0 ? '+' : ''}${dv}% vs. mês anterior`} />
        <Kpi icon={<TrendingDown size={20} />} label="Estoque baixo" value={String(baixo)} tone="warn" note="Abaixo do ponto de pedido" />
        <Kpi icon={<CalendarClock size={20} />} label="Próximos do vencimento" value={String(venc)} tone="warn" note="Lotes em até 60 dias" />
        <Kpi icon={<ShoppingCart size={20} />} label="Compras recomendadas" value={String(analise ? analise.resumo.medicamentos_com_compra_recomendada : recs.filter((x) => !recStatus[x.m.id]).length)} note={`Consumo ${dc >= 0 ? '+' : ''}${dc}% vs. mês anterior`} />
        <Kpi icon={<AlertOctagon size={20} />} label="Situação crítica" value={String(crit)} tone="crit" note="Abaixo da reserva de segurança" />
      </div>
      <div className="grid g2">
        <Card title="Inteligência Einsan" className="ai">
          {!analise && <p className="note">Recomendações demonstrativas, calculadas por regras sobre dados fictícios.</p>}
          {destaques.map((d) => (
            <div key={d.nome} style={{ marginBottom: 14 }}>
              <h4>{d.nome} <Badge tone={d.tone}>{d.tag}</Badge></h4>
              <dl className="dl">{d.linhas.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
              <p className="j">{d.texto}</p>
            </div>
          ))}
          {!destaques.length && <p className="j">Nenhuma compra recomendada no momento.</p>}
          <Link className="btn pri" href="/compras">Ver todas as recomendações</Link>
        </Card>
        <Card title="Alertas importantes"><div className="list">{alertas.slice(0, 7).map((a, i) => (
          <div key={i}><Badge tone={a.tone}>{a.grav}</Badge><div className="grow"><b>{a.med}</b><p>{a.texto}</p></div></div>
        ))}{!alertas.length && <p className="j">Nenhum alerta ativo.</p>}</div></Card>
      </div>
      <div className="grid g2">
        <Card title="Consumo mensal (unidades)"><LinhaConsumo data={cheio} /></Card>
        <Card title="Evolução do valor do estoque"><AreaValor data={ag} /></Card>
        <Card title="Medicamentos mais consumidos (últimos 3 meses)"><BarrasH data={top} /></Card>
        <Card title="Estoque por categoria (valor)"><Rosca data={cats} /></Card>
      </div>
      <Card title="Histórico de entradas e saídas (unidades)"><EntSai data={cheio} /></Card>
    </>
  );
}
