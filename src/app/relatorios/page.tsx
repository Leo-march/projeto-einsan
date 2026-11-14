'use client';
import { useMemo, useState } from 'react';
import { Download, Printer } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer } from 'recharts';
import { useStore } from '@/context/Store';
import { Card, DataTable, Sel, type Col } from '@/components/ui';
import { EstadoApi } from '@/components/AvisoApi';
import { AreaValor, BarrasH, EntSai, LinhaConsumo, C, ax, TT } from '@/components/charts/Charts';
import { brl } from '@/utils/calculations';
import { compras, consumoPorMed, fornecedores, serieMensal, type Compra } from '@/utils/derivados';
import { dataApiBR } from '@/utils/apiHelpers';

export default function Relatorios() {
  const { estoque, movs, custo, toast } = useStore();
  const [per, setPer] = useState('12 meses');
  const n = parseInt(per);
  const nome = (id: string) => estoque?.itens.find((i) => i.id_medicamento === id)?.nome ?? id;
  const serie = useMemo(() => serieMensal(movs, custo).slice(-n), [movs, custo, n]);
  const lista = useMemo(() => compras(movs, custo), [movs, custo]);
  const porMed = useMemo(() => { const c = consumoPorMed(movs); return (estoque?.itens ?? []).map((i) => ({ nome: i.nome.split(' ')[0], valor: c[i.id_medicamento] ?? 0 })).sort((a, b) => b.valor - a.valor); }, [movs, estoque]);
  const porForn = useMemo(() => fornecedores(movs, custo).map((f) => ({ nome: f.nome.split(' ').slice(-1)[0], unidades: f.unidades })), [movs, custo]);
  const cols: Col<Compra>[] = [
    { label: 'Data', val: (c) => c.timestamp, render: (c) => dataApiBR(c.timestamp) }, { label: 'Medicamento', val: (c) => nome(c.id_medicamento), render: (c) => nome(c.id_medicamento) },
    { label: 'Fornecedor', val: (c) => c.fornecedor }, { label: 'Documento', val: (c) => c.documento }, { label: 'Quantidade', val: (c) => c.qtd }, { label: 'Total estimado', val: (c) => c.total, render: (c) => brl(c.total) },
  ];
  const csv = () => {
    const l = ['data;medicamento;fornecedor;documento;quantidade;total_estimado', ...lista.map((c) => [c.timestamp.slice(0, 10), nome(c.id_medicamento), c.fornecedor, c.documento, c.qtd, c.total.toFixed(2)].join(';'))].join('\n');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['\ufeff' + l], { type: 'text/csv;charset=utf-8' })); a.download = 'historico-compras.csv'; a.click(); toast('CSV exportado');
  };
  return (
    <>
      <EstadoApi ok={!!estoque} />
      <div className="bar"><Sel label="Período" value={per} onChange={setPer} opts={['3 meses', '6 meses', '12 meses']} />
        <button className="btn push" onClick={csv}><Download size={16} style={{ verticalAlign: -3 }} /> Exportar CSV</button>
        <button className="btn" onClick={() => window.print()}><Printer size={16} style={{ verticalAlign: -3 }} /> Exportar PDF</button></div>
      <div className="note">Calculado a partir do livro de movimentações. Valores em R$ usam o custo unitário do cofre (estimado).</div>
      <div className="grid g2">
        <Card title="Valor das compras por mês (R$)"><AreaValor data={serie} k="valorCompras" label="Compras" /></Card>
        <Card title="Consumo mensal (dispensações)"><LinhaConsumo data={serie} /></Card>
        <Card title="Dispensações por medicamento (histórico)"><BarrasH data={porMed} /></Card>
        <Card title="Entradas e saídas"><EntSai data={serie} /></Card>
        <Card title="Perdas por descarte (R$)"><div style={{ height: 280 }}><ResponsiveContainer width="100%" height="100%"><BarChart data={serie}><CartesianGrid stroke={C.grid} vertical={false} /><XAxis dataKey="mes" {...ax} /><YAxis {...ax} /><Tooltip {...TT} formatter={(v) => brl(+(v ?? 0))} /><Bar name="Descartes" dataKey="valorPerdas" fill={C.red} radius={0} /></BarChart></ResponsiveContainer></div></Card>
        <Card title="Unidades compradas por fornecedor"><div style={{ height: 280 }}><ResponsiveContainer width="100%" height="100%"><BarChart data={porForn}><CartesianGrid stroke={C.grid} vertical={false} /><XAxis dataKey="nome" {...ax} /><YAxis {...ax} /><Tooltip {...TT} /><Bar name="Unidades" dataKey="unidades" fill={C.blue} radius={0} /></BarChart></ResponsiveContainer></div></Card>
      </div>
      <Card title="Histórico de compras"><DataTable rows={lista} cols={cols} /></Card>
    </>
  );
}