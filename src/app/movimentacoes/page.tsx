'use client';
import { useState } from 'react';
import { useStore } from '@/context/Store';
import { Badge, Card, DataTable, Sel, type Col } from '@/components/ui';
import { movs } from '@/data/mockData';
import type { Mov, Tone } from '@/types';

const TONE: Record<string, Tone> = { Entrada: 'ok', Saída: 'info', Transferência: 'mute', Ajuste: 'warn' };
export default function Movimentacoes() {
  const { meds } = useStore();
  const [tipo, setTipo] = useState('Todos'), [med, setMed] = useState('Todos'), [de, setDe] = useState(''), [ate, setAte] = useState('');
  const nome = (id: string) => meds.find((m) => m.id === id)?.nome ?? id;
  const rows = movs.filter((m) => (tipo === 'Todos' || m.tipo === tipo) && (med === 'Todos' || nome(m.medId) === med) && (!de || m.data.slice(0, 10) >= de) && (!ate || m.data.slice(0, 10) <= ate));
  const cols: Col<Mov>[] = [
    { label: 'Data e horário', val: (m) => m.data, render: (m) => new Date(m.data).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) },
    { label: 'Medicamento', val: (m) => nome(m.medId), render: (m) => <b>{nome(m.medId)}</b> },
    { label: 'Tipo', val: (m) => m.tipo, render: (m) => <Badge tone={TONE[m.tipo]}>{m.tipo}</Badge> },
    { label: 'Quantidade', val: (m) => m.qtd, render: (m) => (m.tipo === 'Saída' ? '-' : m.tipo === 'Ajuste' ? '' : '+') + m.qtd },
    { label: 'Lote', val: (m) => m.lote }, { label: 'Responsável', val: (m) => m.resp },
  ];
  return (
    <Card>
      <div className="bar">
        <Sel label="Tipo" value={tipo} onChange={setTipo} opts={['Todos', 'Entrada', 'Saída', 'Transferência', 'Ajuste']} />
        <Sel label="Medicamento" value={med} onChange={setMed} opts={['Todos', ...Array.from(new Set(meds.map((m) => m.nome)))]} />
        <label>De <input type="date" value={de} onChange={(e) => setDe(e.target.value)} /></label>
        <label>Até <input type="date" value={ate} onChange={(e) => setAte(e.target.value)} /></label>
      </div>
      <DataTable rows={rows} cols={cols} pageSize={10} />
    </Card>
  );
}
