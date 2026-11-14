'use client';
import { Badge } from '@/components/ui';
import { useStore } from '@/context/Store';

/** Nota de carregamento/erro, usada por todas as telas que dependem da API. */
export function EstadoApi({ ok }: { ok: boolean }) {
  const { carregandoApi, erroApi, recarregarApi } = useStore();
  if (ok && !erroApi) return null;
  return (
    <div className="note">
      {carregandoApi ? 'Carregando dados do cofre…' : `API indisponível (${erroApi}).`}{' '}
      {!carregandoApi && <button className="btn" onClick={() => void recarregarApi()}>Tentar novamente</button>}
    </div>
  );
}

/** Avisos de qualidade dos dados (o guia pede para não escondê-los do operador). */
export function AvisosQualidade({ avisos }: { avisos: { codigo: string; severidade: 'INFO' | 'ATENCAO'; mensagem: string }[] }) {
  if (!avisos.length) return null;
  return (
    <div className="list" style={{ margin: '12px 0' }}>
      {avisos.map((a, i) => <div key={i}><Badge tone={a.severidade === 'ATENCAO' ? 'warn' : 'info'}>{a.severidade === 'ATENCAO' ? 'Atenção' : 'Info'}</Badge><div className="grow"><b>{a.codigo}</b><p>{a.mensagem}</p></div></div>)}
    </div>
  );
}
