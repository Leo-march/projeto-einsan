'use client';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { AnaliseApi, EstoqueApi, MovimentacaoApi } from '@/types/api';
import { buscarAnalise, buscarEstoque, buscarMovimentacoes } from '@/services/api';
import { custoUnitario } from '@/utils/derivados';

type Status = 'aprovada' | 'rejeitada';
type S = {
  analise: AnaliseApi | null; estoque: EstoqueApi | null; movs: MovimentacaoApi[]; custo: Record<string, number>;
  erroApi: string; carregandoApi: boolean; recarregarApi: (dataRef?: string) => Promise<void>;
  recStatus: Record<string, Status>; setRec: (id: string, s: Status | null) => void; toast: (m: string) => void; msg: string;
};
const Ctx = createContext<S>(null as unknown as S);
export const useStore = () => useContext(Ctx);
const KEY = 'einsan-rec-status';

export function StoreProvider({ children }: { children: ReactNode }) {
  const [analise, setAnalise] = useState<AnaliseApi | null>(null);
  const [estoque, setEstoque] = useState<EstoqueApi | null>(null);
  const [movs, setMovs] = useState<MovimentacaoApi[]>([]);
  const [erroApi, setErro] = useState('');
  const [carregandoApi, setCarr] = useState(true);
  const [recStatus, setRS] = useState<Record<string, Status>>({});
  const [msg, setMsg] = useState('');
  const [ok, setOk] = useState(false);

  // Análise, estoque e histórico são buscados juntos, com a mesma data_referencia, para as telas não divergirem.
  const recarregarApi = useCallback(async (dataRef?: string) => {
    setCarr(true);
    try {
      const [a, e, m] = await Promise.all([buscarAnalise(dataRef), buscarEstoque(dataRef), buscarMovimentacoes({ limite: 100000 })]);
      setAnalise(a); setEstoque(e); setMovs(m.movimentacoes); setErro('');
    } catch (err) { setErro((err as Error).message); }
    finally { setCarr(false); }
  }, []);
  useEffect(() => { void recarregarApi(); }, [recarregarApi]);

  // Só a decisão do operador (aprovar/rejeitar) fica no navegador; nenhum dado de negócio.
  useEffect(() => { try { const j = JSON.parse(localStorage.getItem(KEY) || 'null'); if (j) setRS(j); } catch {} setOk(true); }, []);
  useEffect(() => { if (ok) localStorage.setItem(KEY, JSON.stringify(recStatus)); }, [recStatus, ok]);

  const toast = useCallback((m: string) => { setMsg(m); setTimeout(() => setMsg(''), 2800); }, []);
  const setRec = (id: string, s: Status | null) => { setRS((r) => { const n = { ...r }; if (s) n[id] = s; else delete n[id]; return n; }); if (s) toast(s === 'aprovada' ? 'Recomendação aprovada' : 'Recomendação rejeitada'); };
  const custo = useMemo(() => custoUnitario(estoque, analise), [estoque, analise]);
  return <Ctx.Provider value={{ analise, estoque, movs, custo, erroApi, carregandoApi, recarregarApi, recStatus, setRec, toast, msg }}>{children}</Ctx.Provider>;
}
