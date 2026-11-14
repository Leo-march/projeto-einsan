'use client';
import { useState } from 'react';
import { Download, Printer } from 'lucide-react';
import { useStore } from '@/context/Store';
import { Card, DataTable, Sel, type Col } from '@/components/ui';
import { AreaValor, BarrasH, EntSai, LinhaConsumo, C } from '@/components/charts/Charts';
import { BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer } from 'recharts';
import { compras, fornecedores, perdas, series } from '@/data/mockData';
import { brl, dataBR } from '@/utils/calculations';

type Cp = (typeof compras)[number];
export default function Relatorios() {
  const { meds, toast } = useStore();
  const [per, setPer] = useState('12 meses');
  const n = parseInt(per);
  const ids = Object.keys(series).filter((id) => meds.some((m) => m.id === id));
  const ag = series[ids[0]].map((s, i) => ({ mes: s.mes, consumo: ids.reduce((t, id) => t + series[id][i].consumo, 0), entradas: ids.reduce((t, id) => t + series[id][i].entradas, 0), saidas: ids.reduce((t, id) => t + series[id][i].saidas, 0), valor: ids.reduce((t, id) => t + series[id][i].valor, 0) }));
  const cheio = ag.slice(0, -1).slice(-n), nome = (id: string) => meds.find((m) => m.id === id)?.nome ?? id;
  const porMed = ids.map((id) => ({ nome: nome(id).split(' ')[0], valor: series[id].slice(0, -1).slice(-n).reduce((s, x) => s + x.consumo, 0) })).sort((a, b) => b.valor - a.valor);
  const perd = perdas.slice(0, -1).slice(-n);
  const cols: Col<Cp>[] = [
    { label: 'Data', val: (c) => c.data, render: (c) => dataBR(c.data) }, { label: 'Medicamento', val: (c) => nome(c.medId) }, { label: 'Fornecedor', val: (c) => fornecedores.find((f) => f.id === c.forn)?.nome ?? '' },
    { label: 'Quantidade', val: (c) => c.qtd }, { label: 'Total', val: (c) => c.total, render: (c) => brl(c.total) },
  ];
  const csv = () => {
    const l = ['data;medicamento;fornecedor;quantidade;total', ...compras.map((c) => [c.data, nome(c.medId), fornecedores.find((f) => f.id === c.forn)?.nome, c.qtd, c.total].join(';'))].join('\n');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['\ufeff' + l], { type: 'text/csv;charset=utf-8' })); a.download = 'historico-compras.csv'; a.click(); toast('CSV exportado');
  };
  return (
    <>
      <div className="bar"><Sel label="Período" value={per} onChange={setPer} opts={['3 meses', '6 meses', '12 meses']} />
        <button className="btn push" onClick={csv}><Download size={16} style={{ verticalAlign: -3 }} /> Exportar CSV</button>
        <button className="btn" onClick={() => window.print()}><Printer size={16} style={{ verticalAlign: -3 }} /> Exportar PDF</button></div>
      <div className="grid g2">
        <Card title="Evolução do estoque e do investimento (valor)"><AreaValor data={ag.slice(-n - 1)} /></Card>
        <Card title="Consumo mensal total"><LinhaConsumo data={cheio} /></Card>
        <Card title="Consumo por medicamento no período"><BarrasH data={porMed} /></Card>
        <Card title="Entradas e saídas"><EntSai data={cheio} /></Card>
        <Card title="Perdas por vencimento (R$)"><div style={{ height: 280 }}><ResponsiveContainer width="100%" height="100%"><BarChart data={perd}><CartesianGrid stroke={C.grid} vertical={false} /><XAxis dataKey="mes" tick={{ fontSize: 12 }} /><YAxis tick={{ fontSize: 12 }} /><Tooltip formatter={(v) => brl(+(v ?? 0))} /><Bar name="Perdas" dataKey="valor" fill={C.red} radius={[3, 3, 0, 0]} /></BarChart></ResponsiveContainer></div></Card>
        <Card title="Desempenho dos fornecedores"><div style={{ height: 280 }}><ResponsiveContainer width="100%" height="100%"><BarChart data={fornecedores.map((f) => ({ nome: f.nome.split(' ')[0], pontual: f.pontual }))}><CartesianGrid stroke={C.grid} vertical={false} /><XAxis dataKey="nome" tick={{ fontSize: 12 }} /><YAxis domain={[0, 100]} tick={{ fontSize: 12 }} /><Tooltip /><Bar name="Entregas no prazo (%)" dataKey="pontual" fill={C.blue} radius={[3, 3, 0, 0]} /></BarChart></ResponsiveContainer></div></Card>
      </div>
      <Card title="Histórico de compras"><DataTable rows={compras} cols={cols} /></Card>
    </>
  );
}
