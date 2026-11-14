'use client';
import { useState } from 'react';
import { useStore } from '@/context/Store';
import { Badge, Card, DataTable, type Col } from '@/components/ui';
import { fornecedores } from '@/data/mockData';
import { brl } from '@/utils/calculations';
import type { Disp } from '@/types';

type Row = { forn: string; preco: number; prazo: number; disp: Disp };
export default function Fornecedores() {
  const { meds } = useStore();
  const [id, setId] = useState(meds[0]?.id ?? '');
  const rows: Row[] = fornecedores.flatMap((f) => f.itens.filter((i) => i.medId === id).map((i) => ({ forn: f.nome, preco: i.preco, prazo: i.prazo, disp: i.disp })));
  const rank = { Alta: 3, Média: 2, Baixa: 1 };
  const cols: Col<Row>[] = [
    { label: 'Fornecedor', val: (r) => r.forn, render: (r) => <b>{r.forn}</b> }, { label: 'Preço unitário', val: (r) => r.preco, render: (r) => brl(r.preco) },
    { label: 'Prazo de entrega', val: (r) => r.prazo, render: (r) => `${r.prazo} dias` },
    { label: 'Disponibilidade', val: (r) => rank[r.disp], render: (r) => <Badge tone={r.disp === 'Alta' ? 'ok' : r.disp === 'Média' ? 'warn' : 'crit'}>{r.disp}</Badge> },
  ];
  return (
    <>
      <Card title="Comparar fornecedores" action={<select aria-label="Medicamento" value={id} onChange={(e) => setId(e.target.value)}>{meds.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}</select>}>
        <p className="note">Nenhum fornecedor é pré-selecionado. A melhor escolha depende da urgência: para reposição imediata, prazo e disponibilidade tendem a pesar mais que o preço. Ordene as colunas para comparar.</p>
        <DataTable rows={rows} cols={cols} pageSize={6} />
      </Card>
      <div className="grid g2">
        {fornecedores.map((f) => (
          <Card key={f.id} title={f.nome} action={<Badge tone={f.pontual >= 95 ? 'ok' : f.pontual >= 85 ? 'warn' : 'crit'}>{f.pontual}% no prazo</Badge>}>
            <dl className="dl" style={{ marginBottom: 12 }}><div><dt>CNPJ (fictício)</dt><dd>{f.cnpj}</dd></div><div><dt>Condições de pagamento</dt><dd>{f.pagamento}</dd></div><div><dt>Histórico</dt><dd>{f.hist}</dd></div></dl>
            <p style={{ color: 'var(--mu)', fontSize: 13 }}>Fornece: {f.itens.map((i) => meds.find((m) => m.id === i.medId)?.nome).filter(Boolean).join(', ')}.</p>
          </Card>
        ))}
      </div>
    </>
  );
}
