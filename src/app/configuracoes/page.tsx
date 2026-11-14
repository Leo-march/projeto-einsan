'use client';
import { useStore } from '@/context/Store';
import { Card } from '@/components/ui';
import { EMPRESA } from '@/data/mockData';

export default function Configuracoes() {
  const { reset } = useStore();
  return (
    <div className="grid g2">
      <Card title="Ambiente de demonstração">
        <p style={{ marginBottom: 12 }}>Empresa: <b>{EMPRESA}</b>. Todos os dados são fictícios e ficam salvos apenas neste navegador.</p>
        <button className="btn crit" onClick={reset}>Restaurar dados de demonstração</button>
      </Card>
      <Card title="Fonte dos dados">
        <p>Os dados vêm de <code>src/data/dados.json</code>, gerado por <code>scripts/gerar_dados.py</code> (pandas). Para integrar uma API, substitua <code>src/data/mockData.ts</code> mantendo os tipos de <code>src/types</code>.</p>
      </Card>
    </div>
  );
}
