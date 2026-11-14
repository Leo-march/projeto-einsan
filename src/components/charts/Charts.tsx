'use client';
import { ResponsiveContainer, LineChart, Line, AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, ComposedChart, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceLine } from 'recharts';
import type { Prev } from '@/types';

export const C = { navy: '#0b2545', blue: '#1d6fe0', sky: '#7fb2f0', green: '#1f9d63', amber: '#e8a21a', red: '#d64545', grid: '#e4e9f0' };
const ax = { tick: { fontSize: 12, fill: '#5b6b7f' }, stroke: C.grid };
const H = 280;
type D = Record<string, string | number | null>;
const Wrap = ({ children }: { children: React.ReactElement }) => <div style={{ height: H }}><ResponsiveContainer width="100%" height="100%">{children}</ResponsiveContainer></div>;

export const LinhaConsumo = ({ data }: { data: D[] }) => (
  <Wrap><LineChart data={data}><CartesianGrid stroke={C.grid} vertical={false} /><XAxis dataKey="mes" {...ax} /><YAxis {...ax} /><Tooltip /><Legend />
    <Line name="Consumo (unid.)" dataKey="consumo" stroke={C.blue} strokeWidth={2.5} dot={false} /></LineChart></Wrap>
);
export const AreaValor = ({ data }: { data: D[] }) => (
  <Wrap><AreaChart data={data}><CartesianGrid stroke={C.grid} vertical={false} /><XAxis dataKey="mes" {...ax} /><YAxis {...ax} tickFormatter={(v) => `${Math.round(v / 1000)} mil`} />
    <Tooltip formatter={(v) => (+(v ?? 0)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })} /><Legend />
    <Area name="Valor em estoque" dataKey="valor" stroke={C.navy} fill={C.sky} fillOpacity={0.35} /></AreaChart></Wrap>
);
export const BarrasH = ({ data, nameKey = 'nome', valKey = 'valor', label = 'Unidades' }: { data: D[]; nameKey?: string; valKey?: string; label?: string }) => (
  <Wrap><BarChart data={data} layout="vertical" margin={{ left: 30 }}><CartesianGrid stroke={C.grid} horizontal={false} /><XAxis type="number" {...ax} /><YAxis type="category" dataKey={nameKey} width={130} {...ax} /><Tooltip />
    <Bar name={label} dataKey={valKey} fill={C.blue} radius={[0, 3, 3, 0]} /></BarChart></Wrap>
);
const PAL = [C.navy, C.blue, C.sky, C.green, C.amber];
export const Rosca = ({ data }: { data: { nome: string; valor: number }[] }) => (
  <Wrap><PieChart><Pie data={data} dataKey="valor" nameKey="nome" innerRadius={55} outerRadius={95} paddingAngle={2}>{data.map((_, i) => <Cell key={i} fill={PAL[i % PAL.length]} />)}</Pie><Tooltip /><Legend /></PieChart></Wrap>
);
export const EntSai = ({ data }: { data: D[] }) => (
  <Wrap><BarChart data={data}><CartesianGrid stroke={C.grid} vertical={false} /><XAxis dataKey="mes" {...ax} /><YAxis {...ax} /><Tooltip /><Legend />
    <Bar name="Entradas" dataKey="entradas" fill={C.green} radius={[3, 3, 0, 0]} /><Bar name="Saídas" dataKey="saidas" fill={C.navy} radius={[3, 3, 0, 0]} /></BarChart></Wrap>
);
export const GraficoPrevisao = ({ data, prazo }: { data: Prev[]; prazo: number }) => (
  <div style={{ height: 340 }}><ResponsiveContainer width="100%" height="100%"><ComposedChart data={data}><CartesianGrid stroke={C.grid} vertical={false} /><XAxis dataKey="d" {...ax} interval={3} />
    <YAxis yAxisId="c" {...ax} /><YAxis yAxisId="e" orientation="right" {...ax} /><Tooltip /><Legend />
    <Area yAxisId="e" name="Estoque projetado" dataKey="estoque" stroke={C.sky} fill={C.sky} fillOpacity={0.25} />
    <Line yAxisId="e" name="Estoque de segurança" dataKey="seg" stroke={C.red} strokeDasharray="5 4" dot={false} />
    <Line yAxisId="c" name="Consumo histórico" dataKey="real" stroke={C.navy} strokeWidth={2} dot={false} />
    <Line yAxisId="c" name="Demanda prevista (demonstrativa)" dataKey="prev" stroke={C.blue} strokeDasharray="6 3" strokeWidth={2.5} dot={false} />
    {prazo > 0 && <ReferenceLine yAxisId="c" x={data.filter((p) => p.real !== null).slice(-1)[0]?.d} stroke={C.amber} label={{ value: 'Hoje', fontSize: 11 }} />}
  </ComposedChart></ResponsiveContainer></div>
);
