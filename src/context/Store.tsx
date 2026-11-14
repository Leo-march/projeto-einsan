'use client';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Med } from '@/types';
import type { AnaliseApi } from '@/types/api';
import { medsIniciais } from '@/data/mockData';
import { buscarAnalise } from '@/services/api';

type Status = 'aprovada' | 'rejeitada';
type S = {
  meds: Med[]; recStatus: Record<string, Status>; salvarMed: (m: Med) => void; excluirMed: (id: string) => void; setRec: (id: string, s: Status | null) => void;
  toast: (m: string) => void; msg: string; reset: () => void;
  analise: AnaliseApi | null; erroApi: string; carregandoApi: boolean; recarregarApi: (dataRef?: string) => void;
};
const Ctx = createContext<S>(null as unknown as S);
export const useStore = () => useContext(Ctx);
const KEY = 'einsan-v1';

export function StoreProvider({ children }: { children: ReactNode }) {
  const [meds, setMeds] = useState<Med[]>(medsIniciais);
  const [recStatus, setRS] = useState<Record<string, Status>>({});
  const [msg, setMsg] = useState('');
  const [ok, setOk] = useState(false);
  const [analise, setAnalise] = useState<AnaliseApi | null>(null);
  const [erroApi, setErro] = useState('');
  const [carregandoApi, setCarr] = useState(true);

  const recarregarApi = useCallback((dataRef?: string) => {
    setCarr(true);
    buscarAnalise(dataRef).then((a) => { setAnalise(a); setErro(''); }).catch((e: Error) => setErro(e.message)).finally(() => setCarr(false));
  }, []);
  useEffect(() => { recarregarApi(); }, [recarregarApi]);

  useEffect(() => {
    try { const j = JSON.parse(localStorage.getItem(KEY) || 'null'); if (j) { setMeds(j.meds); setRS(j.recStatus); } } catch {}
    setOk(true);
  }, []);
  useEffect(() => { if (ok) localStorage.setItem(KEY, JSON.stringify({ meds, recStatus })); }, [meds, recStatus, ok]);
  const toast = useCallback((m: string) => { setMsg(m); setTimeout(() => setMsg(''), 2800); }, []);
  const salvarMed = (m: Med) => { setMeds((a) => (a.some((x) => x.id === m.id) ? a.map((x) => (x.id === m.id ? m : x)) : [...a, m])); toast('Medicamento salvo'); };
  const excluirMed = (id: string) => { setMeds((a) => a.filter((x) => x.id !== id)); toast('Medicamento excluído'); };
  const setRec = (id: string, s: Status | null) => { setRS((r) => { const n = { ...r }; if (s) n[id] = s; else delete n[id]; return n; }); if (s) toast(s === 'aprovada' ? 'Recomendação aprovada' : 'Recomendação rejeitada'); };
  const reset = () => { localStorage.removeItem(KEY); setMeds(medsIniciais); setRS({}); toast('Dados de demonstração restaurados'); };
  return <Ctx.Provider value={{ meds, recStatus, salvarMed, excluirMed, setRec, toast, msg, reset, analise, erroApi, carregandoApi, recarregarApi }}>{children}</Ctx.Provider>;
}
