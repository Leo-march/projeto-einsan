'use client';
import { useMemo, useState } from 'react';
import { useStore } from '@/context/Store';
import { Card, DataTable, Sel, type Col } from '@/components/ui';
import { EstadoApi } from '@/components/AvisoApi';
import { brl } from '@/utils/calculations';
import { fornecedores, type FornecedorLivro } from '@/utils/derivados';
import { dataApiBR } from '@/utils/apiHelpers';

export default function Fornecedores() {
  const { estoque, movs, custo } = useStore();
  const [id, setId] = useState('Todos');
  const nome = (m: string) => estoque?.itens.find((i) => i.id_medicamento === m)?.nome ?? m;
  const rows = useMemo(() => fornecedores(movs, custo, id === 'Todos' ? undefined : id), [movs, custo, id]);
  const cols: Col<FornecedorLivro>[] = [
    { label: 'Fornecedor', val: (f) => f.nome, render: (f) => <b>{f.nome}</b> }, { label: 'Entradas de compra', val: (f) => f.entradas }, { label: 'Unidades', val: (f) => f.unidades },
    { label: 'Valor estimado', val: (f) => f.total, render: (f) => brl(f.total) }, { label: 'Última entrada', val: (f) => f.ultima, render: (f) => dataApiBR(f.ultima) },
    { label: 'Medicamentos', val: (f) => f.meds.length, render: (f) => f.meds.map(nome).join(', ') },
  ];
  return (
    <>
      <EstadoApi ok={!!estoque} />
      <Card title="Fornecedores com entradas registradas" action={<Sel label="Medicamento" value={id} onChange={setId} opts={['Todos', ...(estoque?.itens.map((i) => i.id_medicamento) ?? [])]} />}>
        <p className="note">Fornecedores são as contrapartes das entradas de compra no livro de movimentações. A API não tem preço, prazo de entrega, disponibilidade nem pontualidade; o valor é estimado (quantidade × custo unitário do cofre).</p>
        <DataTable rows={rows} cols={cols} pageSize={8} />
      </Card>
    </>
  );
}
