'use client';

import { useMemo } from 'react';
import { Sparkles } from 'lucide-react';
import { Badge, Card, DataTable, type Col } from '@/components/ui';
import { brl } from '@/utils/calculations';
import { diaSP } from '@/utils/derivados';
import { ofertasDoMedicamento, type LinhaFornecedor, type SeloFornecedor } from '@/lib/catalogo-fornecedores';
import type { AnaliseApi, EstoqueApi, MovimentacaoApi } from '@/types/api';

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const TOM_SELO: Record<SeloFornecedor, 'ok' | 'info' | 'warn'> = {
  'Menor custo': 'ok',
  'Entrega mais rápida': 'info',
  'Mais confiável': 'info',
  'Mais comprado por você': 'warn',
};

type Recomendacao = AnaliseApi['recomendacoes_compra'][number];
type Opcao = LinhaFornecedor & { quantidade: number; total: number; escolhida: boolean };

/** Mês anterior ao da data de referência (fuso de São Paulo), no formato AAAA-MM. */
function mesPassado(refIso: string): string {
  const [ano, mes] = diaSP(refIso).split('-').map(Number);
  return mes === 1 ? `${ano - 1}-12` : `${ano}-${String(mes - 1).padStart(2, '0')}`;
}

function dispensacoesPorMed(movs: MovimentacaoApi[], mes: string): Record<string, number> {
  const por: Record<string, number> = {};
  for (const m of movs) {
    if (m.tipo === 'SAIDA_DISPENSACAO' && diaSP(m.timestamp).slice(0, 7) === mes) {
      por[m.id_medicamento] = (por[m.id_medicamento] ?? 0) + 1;
    }
  }
  return por;
}

/** Nível de uso comparando o consumo diário do medicamento com a mediana do cofre. */
function nivelDeUso(consumo: number, todos: number[]): string {
  const ordenados = todos.filter((c) => c > 0).sort((a, b) => a - b);
  if (!ordenados.length || consumo <= 0) return 'baixo';
  const mediana = ordenados[Math.floor(ordenados.length / 2)];
  const razao = consumo / mediana;
  if (razao >= 1.5) return 'muito alto';
  if (razao >= 1.15) return 'alto';
  if (razao <= 0.85) return 'baixo';
  return 'mediano';
}

function juntar(partes: string[]): string {
  return partes.length <= 1 ? partes.join('') : `${partes.slice(0, -1).join(', ')} e ${partes[partes.length - 1]}`;
}

/** Texto da "análise da IA": regras da PoC que explicam o fornecedor escolhido, o prazo e o nível de uso. */
function analiseIA(r: Recomendacao, opcoes: Opcao[], consumo: number, todosConsumos: number[], dispensacoes: number, nomeMes: string): string {
  const escolhida = opcoes.find((o) => o.escolhida);
  if (!escolhida) return `Não há fornecedor elegível para ${r.nome} agora (cadeia fria, validade ou disponibilidade). Vale pedir cotação manual.`;

  const motivos = escolhida.selos.map((selo) => {
    if (selo === 'Menor custo') return `está com o preço mais barato (${brl(escolhida.precoEfetivo)}/un.)`;
    if (selo === 'Entrega mais rápida') return `entrega mais rápido (${escolhida.oferta.prazo_entrega_dias} dia(s))`;
    if (selo === 'Mais confiável') return `é o mais confiável (${escolhida.fornecedor.confiabilidade_entrega_pct}% das entregas no prazo)`;
    return 'você já compra bastante com ele';
  });
  const porque = motivos.length ? juntar(motivos) : 'tem o melhor equilíbrio entre preço, prazo e confiabilidade';
  const urgente = r.urgencia === 'CRITICA' || r.urgencia === 'ALTA';
  const cobertura = r.cobertura_dias === null ? 'sem histórico de consumo' : r.cobertura_dias <= 0 ? 'sem estoque útil' : `${r.cobertura_dias} dia(s) de cobertura`;
  const uso = `${nivelDeUso(consumo, todosConsumos)} (${dispensacoes} dispensação(ões) em ${nomeMes})`;

  if (urgente) {
    const maisBarato = [...opcoes].filter((o) => o.fornecedor.cadeia_fria_certificada).sort((a, b) => a.precoEfetivo - b.precoEfetivo)[0];
    const ressalva = maisBarato && maisBarato !== escolhida && maisBarato.oferta.prazo_entrega_dias > escolhida.oferta.prazo_entrega_dias
      ? ` O mais barato seria ${maisBarato.fornecedor.nome}, mas leva ${maisBarato.oferta.prazo_entrega_dias} dia(s).`
      : '';
    return `Compre ${r.quantidade_sugerida} un. imediatamente no fornecedor ${escolhida.fornecedor.nome} porque ${porque}. O medicamento está acabando (${cobertura}) e o uso é ${uso}.${ressalva}`;
  }
  return `Compre ${r.quantidade_sugerida} un. no fornecedor ${escolhida.fornecedor.nome} porque ${porque}. O prazo não pesa porque ainda há estoque de reserva (${r.estoque.util} un. úteis, ${cobertura}) e o uso é ${uso}.`;
}

export function SugestaoCompra({ analise, estoque, movs, itens }: {
  analise: AnaliseApi;
  estoque: EstoqueApi | null;
  movs: MovimentacaoApi[];
  itens: Recomendacao[];
}) {
  const mes = mesPassado(analise.meta.data_referencia);
  const nomeMes = MESES[Number(mes.slice(5)) - 1];
  const dispensacoes = useMemo(() => dispensacoesPorMed(movs, mes), [movs, mes]);
  const todosConsumos = estoque?.itens.map((i) => i.consumo_medio_diario) ?? [];
  const sugestoes = itens.filter((r) => r.quantidade_sugerida > 0);

  const cols: Col<Opcao>[] = [
    { label: 'Fornecedor', val: (o) => o.fornecedor.nome, render: (o) => (
      <>
        <b>{o.fornecedor.nome}</b>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
          {o.escolhida && <Badge tone="ok">Escolhido pela IA</Badge>}
          {o.selos.map((selo) => <Badge key={selo} tone={TOM_SELO[selo]}>{selo}</Badge>)}
          {!o.fornecedor.cadeia_fria_certificada && <Badge tone="crit">Sem cadeia fria</Badge>}
        </div>
      </>
    ) },
    { label: 'Preço efetivo/un.', val: (o) => o.precoEfetivo, render: (o) => brl(o.precoEfetivo) },
    { label: 'Entrega', val: (o) => o.oferta.prazo_entrega_dias, render: (o) => `${o.oferta.prazo_entrega_dias} dia(s)` },
    { label: 'Confiabilidade', val: (o) => o.fornecedor.confiabilidade_entrega_pct, render: (o) => `${o.fornecedor.confiabilidade_entrega_pct}%` },
    { label: 'Total do pedido', val: (o) => o.total, render: (o) => `${brl(o.total)} (${o.quantidade} un.)` },
  ];

  if (!sugestoes.length) return null;
  return (
    <Card title="Sugestão de compra">
      <p className="note">Opções de fornecedor para cada medicamento com compra recomendada. As análises abaixo são geradas por regras da PoC a partir do estoque, do consumo e do catálogo simulado.</p>
      {sugestoes.map((r) => {
        const consumo = estoque?.itens.find((i) => i.id_medicamento === r.id_medicamento)?.consumo_medio_diario ?? 0;
        const idEscolhido = r.fornecedor_recomendado?.id_fornecedor;
        const opcoes: Opcao[] = ofertasDoMedicamento(r.id_medicamento)
          .map((linha) => {
            const quantidade = Math.max(r.quantidade_sugerida, linha.oferta.quantidade_minima_pedido);
            return { ...linha, quantidade, total: quantidade * linha.precoEfetivo, escolhida: linha.fornecedor.id_fornecedor === idEscolhido };
          })
          .sort((a, b) => Number(b.escolhida) - Number(a.escolhida)
            || Number(b.fornecedor.cadeia_fria_certificada) - Number(a.fornecedor.cadeia_fria_certificada)
            || a.total - b.total);
        return (
          <div key={r.id_medicamento} style={{ marginBottom: 22 }}>
            <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>{r.nome}</h4>
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', background: '#f3f0ff', border: '1px solid #ddd6fe', borderRadius: 'var(--r)', padding: '10px 14px', marginBottom: 12 }}>
              <Sparkles size={18} style={{ color: '#6d4fd1', flex: 'none', marginTop: 2 }} />
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#6d4fd1', marginBottom: 2 }}>Análise da IA</div>
                <p>{analiseIA(r, opcoes, consumo, todosConsumos, dispensacoes[r.id_medicamento] ?? 0, nomeMes)}</p>
              </div>
            </div>
            <DataTable rows={opcoes} cols={cols} pageSize={5} />
          </div>
        );
      })}
    </Card>
  );
}