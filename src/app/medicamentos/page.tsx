'use client';
import { useState } from 'react';
import { useStore } from '@/context/Store';
import { Badge, Card, DataTable, SearchBox, type Col } from '@/components/ui';
import { EstadoApi } from '@/components/AvisoApi';
import { brl } from '@/utils/calculations';
import { urgLabel, urgTone } from '@/utils/apiHelpers';

type Linha = { id: string; nome: string; saldo: number; util: number | null; consumo: number; preco: number | null; valor: number; prazo: number | null; cob: number | null; urg: string | null };

export default function Medicamentos() {
  const { estoque, analise, custo } = useStore();
  const [q, setQ] = useState('');
  const rows: Linha[] = (estoque?.itens ?? []).map((i) => {
    const r = analise?.recomendacoes_compra.find((x) => x.id_medicamento === i.id_medicamento);
    return { id: i.id_medicamento, nome: i.nome, saldo: i.saldo_registrado, util: r?.estoque.util ?? null, consumo: i.consumo_medio_diario, preco: custo[i.id_medicamento] ?? null, valor: i.valor_imobilizado_brl, prazo: r?.prazo_reposicao_dias ?? null, cob: r?.cobertura_dias ?? null, urg: r?.urgencia ?? null };
  }).filter((m) => (m.nome + m.id).toLowerCase().includes(q.toLowerCase()));
  const cols: Col<Linha>[] = [
    { label: 'Medicamento', val: (m) => m.nome, render: (m) => <><b>{m.nome}</b><div style={{ color: 'var(--mu)', fontSize: 12 }}>{m.id}</div></> },
    { label: 'Saldo', val: (m) => m.saldo }, { label: 'Estoque útil', val: (m) => m.util ?? -1, render: (m) => m.util ?? '-' },
    { label: 'Consumo/dia', val: (m) => m.consumo }, { label: 'Cobertura', val: (m) => m.cob ?? 9999, render: (m) => (m.cob === null ? 'Sem consumo' : `${m.cob} dias`) },
    { label: 'Prazo de reposição', val: (m) => m.prazo ?? 0, render: (m) => (m.prazo === null ? '-' : `${m.prazo} dias`) },
    { label: 'Custo unit. (estimado)', val: (m) => m.preco ?? 0, render: (m) => (m.preco === null ? '-' : brl(m.preco)) },
    { label: 'Valor imobilizado', val: (m) => m.valor, render: (m) => brl(m.valor) },
    { label: 'Urgência', val: (m) => m.urg ?? '', render: (m) => (m.urg ? <Badge tone={urgTone(m.urg as never)}>{urgLabel[m.urg]}</Badge> : '-') },
  ];
  return (
    <>
      <EstadoApi ok={!!estoque} />
      <Card>
        <p className="note">Lista somente leitura: os medicamentos vêm dos cadastros do cofre (<code>data/</code>). A API não tem endpoint de cadastro.</p>
        <div className="bar"><SearchBox value={q} onChange={setQ} placeholder="Buscar medicamento" /></div>
        <DataTable rows={rows} cols={cols} />
      </Card>
    </>
  );
}
