'use client';
import { useState } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { useStore } from '@/context/Store';
import { Badge, Card, DataTable, Modal, SearchBox, type Col } from '@/components/ui';
import { brl, sitTone, situacao } from '@/utils/calculations';
import type { Med } from '@/types';

const vazio = (n: number): Med => ({ id: `MED-${String(n).padStart(3, '0')}`, nome: '', cat: '', fab: '', desc: '', un: 'frasco', temp: '2°C a 8°C', estoque: 0, min: 0, seg: 0, consumo: 0, prazo: 7, preco: 0 });

export default function Medicamentos() {
  const { meds, salvarMed, excluirMed } = useStore();
  const [q, setQ] = useState(''); const [f, setF] = useState<Med | null>(null); const [del, setDel] = useState<Med | null>(null);
  const novoId = Math.max(0, ...meds.map((m) => parseInt(m.id.slice(4)) || 0)) + 1;
  const campo = (k: keyof Med, label: string, type = 'text', full = false) => (
    <label className={full ? 'full' : ''}>{label}
      <input required type={type} step="any" min={type === 'number' ? 0 : undefined} value={f![k]} onChange={(e) => setF({ ...f!, [k]: type === 'number' ? +e.target.value : e.target.value })} /></label>
  );
  const cols: Col<Med>[] = [
    { label: 'Medicamento', val: (m) => m.nome, render: (m) => <><b>{m.nome}</b><div style={{ color: 'var(--mu)', fontSize: 12 }}>{m.id} · {m.fab}</div></> },
    { label: 'Categoria', val: (m) => m.cat }, { label: 'Estoque', val: (m) => m.estoque, render: (m) => `${m.estoque} ${m.un}(s)` },
    { label: 'Mínimo / Segurança', val: (m) => m.min, render: (m) => `${m.min} / ${m.seg}` }, { label: 'Consumo/dia', val: (m) => m.consumo },
    { label: 'Reposição', val: (m) => m.prazo, render: (m) => `${m.prazo} dias` }, { label: 'Preço unit.', val: (m) => m.preco, render: (m) => brl(m.preco) },
    { label: 'Situação', val: (m) => situacao(m), render: (m) => <Badge tone={sitTone(situacao(m))}>{situacao(m)}</Badge> },
    { label: 'Ações', val: () => '', render: (m) => <span style={{ display: 'flex', gap: 4 }}><button className="icon-btn" aria-label={`Editar ${m.nome}`} onClick={() => setF(m)}><Pencil size={16} /></button><button className="icon-btn" aria-label={`Excluir ${m.nome}`} onClick={() => setDel(m)}><Trash2 size={16} /></button></span> },
  ];
  return (
    <Card>
      <div className="bar"><SearchBox value={q} onChange={setQ} placeholder="Buscar medicamento" /><button className="btn pri push" onClick={() => setF(vazio(novoId))}><Plus size={16} style={{ verticalAlign: -3 }} /> Adicionar medicamento</button></div>
      <DataTable rows={meds.filter((m) => (m.nome + m.id + m.cat).toLowerCase().includes(q.toLowerCase()))} cols={cols} />
      {f && (
        <Modal title={meds.some((m) => m.id === f.id) ? 'Editar medicamento' : 'Novo medicamento'} onClose={() => setF(null)} wide>
          <form className="form" onSubmit={(e) => { e.preventDefault(); salvarMed(f); setF(null); }}>
            {campo('nome', 'Nome')}{campo('id', 'Código')}{campo('cat', 'Categoria')}{campo('fab', 'Fabricante')}{campo('un', 'Unidade de medida')}{campo('temp', 'Temperatura de conservação')}
            {campo('estoque', 'Quantidade em estoque', 'number')}{campo('min', 'Estoque mínimo', 'number')}{campo('seg', 'Estoque de segurança', 'number')}
            {campo('consumo', 'Consumo médio diário', 'number')}{campo('prazo', 'Prazo médio de reposição (dias)', 'number')}{campo('preco', 'Preço unitário (R$)', 'number')}
            <label className="full">Descrição<textarea rows={2} value={f.desc} onChange={(e) => setF({ ...f, desc: e.target.value })} /></label>
            <div className="acts full"><button type="button" className="btn" onClick={() => setF(null)}>Cancelar</button><button className="btn pri">Salvar medicamento</button></div>
          </form>
        </Modal>
      )}
      {del && <Modal title="Excluir medicamento" onClose={() => setDel(null)}><p>Excluir <b>{del.nome}</b> da lista? Em demonstração, a ação pode ser desfeita em Configurações.</p><div className="acts"><button className="btn" onClick={() => setDel(null)}>Cancelar</button><button className="btn crit" onClick={() => { excluirMed(del.id); setDel(null); }}>Excluir</button></div></Modal>}
    </Card>
  );
}
