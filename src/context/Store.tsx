'use client';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { AnaliseApi, EstoqueApi, MovimentacaoApi } from '@/types/api';
import { buscarAnalise, buscarEstoque, buscarMovimentacoes } from '@/services/api';
import { custoUnitario } from '@/utils/derivados';

type S = {
  analise: AnaliseApi | null; estoque: EstoqueApi | null; movs: MovimentacaoApi[]; custo: Record<string, number>;
  erroApi: string; carregandoApi: boolean; recarregarApi: (dataRef?: string) => Promise<void>;
  toast: (m: string) => void; msg: string;
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
  const [msg, setMsg] = useState('');

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

  // Limpa decisões antigas (aprovar/rejeitar) que ficaram salvas no navegador e escondiam recomendações.
  useEffect(() => { try { localStorage.removeItem(KEY); } catch {} }, []);

  const toast = useCallback((m: string) => { setMsg(m); setTimeout(() => setMsg(''), 2800); }, []);
  const custo = useMemo(() => custoUnitario(estoque, analise), [estoque, analise]);
  return <Ctx.Provider value={{ analise, estoque, movs, custo, erroApi, carregandoApi, recarregarApi, toast, msg }}>{children}</Ctx.Provider>;
}