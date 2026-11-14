'use client';
import { ResponsiveContainer, LineChart, Line, AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, ComposedChart, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceLine } from 'recharts';
import type { Prev } from '@/types';

/** Paleta dos gráficos: azul de ação, verde/âmbar/vermelho para estados e um azul-gelo de apoio. */
export const C = { navy: '#0b2545', blue: '#0b57d0', sky: '#7cacf8', green: '#1e8e3e', amber: '#f9ab00', red: '#d93025', grid: '#e3e7ec' };

export const ax = { tick: { fontSize: 12, fill: '#5f6368' }, stroke: '#c4c7c5', tickLine: false };

/** Propriedades comuns do <Tooltip /> para combinar com os painéis. */
export const TT = {
  contentStyle: { background: '#fff', border: 'none', borderRadius: 12, fontSize: 13, color: '#1f1f1f', boxShadow: '0 4px 8px 3px rgba(60,64,67,.15), 0 1px 3px rgba(60,64,67,.3)' },
  itemStyle: { color: '#1f1f1f' },
  labelStyle: { color: '#5f6368', marginBottom: 4 },
  cursor: { fill: 'rgba(11,87,208,.06)' },
};
const LG = { wrapperStyle: { fontSize: 13, color: '#5f6368', paddingTop: 8 } };

const H = 280;
type D = Record<string, string | number | null>;
const Wrap = ({ children }: { children: React.ReactElement }) => <div style={{ height: H }}><ResponsiveContainer width="100%" height="100%">{children}</ResponsiveContainer></div>;

export const LinhaConsumo = ({ data }: { data: D[] }) => (
  <Wrap><LineChart data={data}><CartesianGrid stroke={C.grid} vertical={false} /><XAxis dataKey="mes" {...ax} /><YAxis {...ax} /><Tooltip {...TT} /><Legend {...LG} />
    <Line name="Consumo (unid.)" dataKey="consumo" stroke={C.blue} strokeWidth={3} dot={false} activeDot={{ r: 5, fill: C.blue, stroke: '#fff', strokeWidth: 2 }} /></LineChart></Wrap>
);
export const AreaValor = ({ data, label = 'Valor', k = 'valor' }: { data: D[]; label?: string; k?: string }) => (
  <Wrap><AreaChart data={data}><CartesianGrid stroke={C.grid} vertical={false} /><XAxis dataKey="mes" {...ax} /><YAxis {...ax} tickFormatter={(v) => `${Math.round(v / 1000)} mil`} />
    <Tooltip {...TT} formatter={(v) => (+(v ?? 0)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })} /><Legend {...LG} />
    <Area name={label} dataKey={k} stroke={C.blue} strokeWidth={3} fill={C.sky} fillOpacity={0.25} /></AreaChart></Wrap>
);
export const BarrasH = ({ data, nameKey = 'nome', valKey = 'valor', label = 'Unidades' }: { data: D[]; nameKey?: string; valKey?: string; label?: string }) => (
  <Wrap><BarChart data={data} layout="vertical" margin={{ left: 30 }}><CartesianGrid stroke={C.grid} horizontal={false} /><XAxis type="number" {...ax} /><YAxis type="category" dataKey={nameKey} width={130} {...ax} /><Tooltip {...TT} />
    <Bar name={label} dataKey={valKey} fill={C.blue} radius={[0, 8, 8, 0]} barSize={16} /></BarChart></Wrap>
);
const PAL = [C.blue, C.sky, C.green, C.amber, C.navy];
export const Rosca = ({ data }: { data: { nome: string; valor: number }[] }) => (
  <Wrap><PieChart><Pie data={data} dataKey="valor" nameKey="nome" innerRadius={55} outerRadius={95} paddingAngle={2} stroke="#fff" strokeWidth={2}>{data.map((_, i) => <Cell key={i} fill={PAL[i % PAL.length]} />)}</Pie><Tooltip {...TT} /><Legend {...LG} /></PieChart></Wrap>
);
export const EntSai = ({ data }: { data: D[] }) => (
  <Wrap><BarChart data={data}><CartesianGrid stroke={C.grid} vertical={false} /><XAxis dataKey="mes" {...ax} /><YAxis {...ax} /><Tooltip {...TT} /><Legend {...LG} />
    <Bar name="Entradas" dataKey="entradas" fill={C.green} radius={[8, 8, 0, 0]} /><Bar name="Saídas" dataKey="saidas" fill={C.blue} radius={[8, 8, 0, 0]} /></BarChart></Wrap>
);
export const GraficoPrevisao = ({ data, prazo }: { data: Prev[]; prazo: number }) => (
  <div style={{ height: 340 }}><ResponsiveContainer width="100%" height="100%"><ComposedChart data={data}><CartesianGrid stroke={C.grid} vertical={false} /><XAxis dataKey="d" {...ax} interval={3} />
    <YAxis yAxisId="c" {...ax} /><YAxis yAxisId="e" orientation="right" {...ax} /><Tooltip {...TT} /><Legend {...LG} />
    <Area yAxisId="e" name="Estoque projetado" dataKey="estoque" stroke={C.sky} fill={C.sky} fillOpacity={0.25} />
    <Line yAxisId="c" name="Consumo histórico" dataKey="real" stroke={C.navy} strokeWidth={2.5} dot={false} />
    <Line yAxisId="c" name="Consumo médio projetado" dataKey="prev" stroke={C.blue} strokeDasharray="6 3" strokeWidth={3} dot={false} />
    {prazo > 0 && <ReferenceLine yAxisId="c" x={data.filter((p) => p.real !== null).slice(-1)[0]?.d} stroke={C.amber} label={{ value: 'Hoje', fontSize: 12, fill: '#8a5100' }} />}
  </ComposedChart></ResponsiveContainer></div>
);