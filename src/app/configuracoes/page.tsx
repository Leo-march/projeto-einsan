'use client';
import { useState } from 'react';
import { useStore } from '@/context/Store';
import { Card } from '@/components/ui';
import { AvisosQualidade, EstadoApi } from '@/components/AvisoApi';
import { dataHoraBR } from '@/utils/apiHelpers';

export default function Configuracoes() {
  const { analise, estoque, recarregarApi, carregandoApi } = useStore();
  const [ref, setRef] = useState('');
  const q = estoque?.qualidade_dados ?? analise?.qualidade_dados;
  return (
    <>
      <EstadoApi ok={!!analise} />
      <div className="grid g2">
        <Card title="Data de referência">
          <p style={{ marginBottom: 12 }}>Por padrão a API usa o evento mais recente. Escolha uma data para ver o retrato do cofre naquele momento.</p>
          <div className="bar" style={{ margin: 0 }}>
            <input type="datetime-local" value={ref} onChange={(e) => setRef(e.target.value)} />
            <button className="btn pri" disabled={!ref || carregandoApi} onClick={() => void recarregarApi(new Date(ref).toISOString())}>Aplicar</button>
            <button className="btn" disabled={carregandoApi} onClick={() => { setRef(''); void recarregarApi(); }}>Voltar ao mais recente</button>
          </div>
          {analise && <p style={{ marginTop: 12, color: 'var(--mu)', fontSize: 13 }}>Referência atual: {dataHoraBR(analise.meta.data_referencia)} · cofre {analise.meta.cofre_id} · regras {analise.meta.versao_regras}</p>}
        </Card>
        <Card title="Qualidade dos dados">
          {q ? <><dl className="dl"><div><dt>Movimentações processadas</dt><dd>{q.movimentacoes_processadas}</dd></div><div><dt>Ignoradas</dt><dd>{q.movimentacoes_ignoradas}</dd></div><div><dt>Lançamento manual</dt><dd>{q.percentual_lancamento_manual}%</dd></div></dl><AvisosQualidade avisos={q.avisos} /></> : <p>Sem dados.</p>}
          <p style={{ color: 'var(--mu)', fontSize: 13, marginTop: 8 }}>Fonte: <code>data/*.json</code>, via <code>/api/analise</code>, <code>/api/estoque</code> e <code>/api/movimentacoes</code>.</p>
        </Card>
      </div>
    </>
  );
}
