'use client';
import { useMemo, useState } from 'react';
import { useStore } from '@/context/Store';
import { Badge, Card, DataTable, Sel, type Col } from '@/components/ui';
import { EstadoApi } from '@/components/AvisoApi';
import { brl } from '@/utils/calculations';
import { fornecedores, type FornecedorLivro } from '@/utils/derivados';
import { dataApiBR } from '@/utils/apiHelpers';
import { ofertasDoMedicamento, type LinhaFornecedor, type SeloFornecedor } from '@/lib/catalogo-fornecedores';

const TOM_SELO: Record<SeloFornecedor, 'ok' | 'info' | 'warn'> = {
  'Menor custo': 'ok',
  'Entrega mais rápida': 'info',
  'Mais confiável': 'info',
  'Mais comprado por você': 'warn',
};

export default function Fornecedores() {
  const { estoque, analise, movs, custo } = useStore();
  const [medCat, setMedCat] = useState('');
  const [id, setId] = useState('Todos');
  const nome = (m: string) => estoque?.itens.find((i) => i.id_medicamento === m)?.nome ?? m;
  const rows = useMemo(() => fornecedores(movs, custo, id === 'Todos' ? undefined : id), [movs, custo, id]);
  const cols: Col<FornecedorLivro>[] = [
    { label: 'Fornecedor', val: (f) => f.nome, render: (f) => <b>{f.nome}</b> }, { label: 'Entradas de compra', val: (f) => f.entradas }, { label: 'Unidades', val: (f) => f.unidades },
    { label: 'Valor estimado', val: (f) => f.total, render: (f) => brl(f.total) }, { label: 'Última entrada', val: (f) => f.ultima, render: (f) => dataApiBR(f.ultima) },
    { label: 'Medicamentos', val: (f) => f.meds.length, render: (f) => f.meds.map(nome).join(', ') },
  ];
  const idCat = medCat || estoque?.itens[0]?.id_medicamento || 'MED-001';
  const recomendado = analise?.recomendacoes_compra.find((r) => r.id_medicamento === idCat)?.fornecedor_recomendado?.id_fornecedor;
  const catalogo = useMemo(() => ofertasDoMedicamento(idCat), [idCat]);
  const colsCat: Col<LinhaFornecedor>[] = [
    { label: 'Fornecedor', val: (l) => l.fornecedor.nome, render: (l) => (
      <>
        <b>{l.fornecedor.nome}</b>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
          {l.fornecedor.id_fornecedor === recomendado && <Badge tone="ok">Recomendado pela reposição</Badge>}
          {l.selos.map((selo) => <Badge key={selo} tone={TOM_SELO[selo]}>{selo}</Badge>)}
          {!l.fornecedor.cadeia_fria_certificada && <Badge tone="crit">Sem cadeia fria</Badge>}
        </div>
      </>
    ) },
    { label: 'Preço efetivo/un.', val: (l) => l.precoEfetivo, render: (l) => brl(l.precoEfetivo) },
    { label: 'Entrega', val: (l) => l.oferta.prazo_entrega_dias, render: (l) => `${l.oferta.prazo_entrega_dias} dia(s)` },
    { label: 'Confiabilidade', val: (l) => l.fornecedor.confiabilidade_entrega_pct, render: (l) => `${l.fornecedor.confiabilidade_entrega_pct}%` },
    { label: 'Validade garantida', val: (l) => l.oferta.validade_minima_garantida_dias, render: (l) => `${l.oferta.validade_minima_garantida_dias} dias` },
    { label: 'Pedido mínimo', val: (l) => l.oferta.quantidade_minima_pedido },
    { label: 'Compras anteriores', val: (l) => l.comprasAnteriores },
  ];
  return (
    <>
      <EstadoApi ok={!!estoque} />
      <Card title="Fornecedores disponíveis para reposição" action={<Sel label="Medicamento do catálogo" value={idCat} onChange={setMedCat} opts={estoque?.itens.map((i) => i.id_medicamento) ?? [idCat]} />}>
        <p className="note">{nome(idCat)}. Catálogo simulado da PoC: é o mesmo usado pela reposição inteligente para escolher o fornecedor. Os selos comparam só fornecedores com cadeia fria certificada.</p>
        <DataTable rows={catalogo} cols={colsCat} pageSize={8} />
      </Card>
      <Card title="Fornecedores com entradas registradas" action={<Sel label="Medicamento" value={id} onChange={setId} opts={['Todos', ...(estoque?.itens.map((i) => i.id_medicamento) ?? [])]} />}>
        <p className="note">Fornecedores são as contrapartes das entradas de compra no livro de movimentações. A API não tem preço, prazo de entrega, disponibilidade nem pontualidade; o valor é estimado (quantidade × custo unitário do cofre).</p>
        <DataTable rows={rows} cols={cols} pageSize={8} />
      </Card>
    </>
  );
}