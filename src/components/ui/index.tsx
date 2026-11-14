'use client';
import { useMemo, useState, type ReactNode } from 'react';
import { Search, X, ChevronUp, ChevronDown } from 'lucide-react';
import type { Tone } from '@/types';

export const Badge = ({ tone = 'mute', children }: { tone?: Tone; children: ReactNode }) => <span className={`badge ${tone}`}>{children}</span>;
export const Card = ({ title, action, children, className = '' }: { title?: string; action?: ReactNode; children: ReactNode; className?: string }) => (
  <section className={`card ${className}`}>{title && <header className="card-h"><h3>{title}</h3>{action}</header>}{children}</section>
);
export const Kpi = ({ icon, label, value, tone = 'info', note }: { icon: ReactNode; label: string; value: string; tone?: Tone; note?: string }) => (
  <div className={`kpi k-${tone}`}><div className="kpi-i">{icon}</div><div><div className="kpi-v">{value}</div><div className="kpi-l">{label}</div>{note && <div className="kpi-n">{note}</div>}</div></div>
);
export function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  return (
    <div className="overlay" onClick={onClose}>
      <div className={`modal ${wide ? 'wide' : ''}`} role="dialog" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <header className="card-h"><h3>{title}</h3><button className="icon-btn" aria-label="Fechar" onClick={onClose}><X size={18} /></button></header>
        {children}
      </div>
    </div>
  );
}
export const SearchBox = ({ value, onChange, placeholder = 'Pesquisar' }: { value: string; onChange: (v: string) => void; placeholder?: string }) => (
  <label className="search"><Search size={16} /><input value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} /></label>
);
export const Sel = ({ value, onChange, opts, label }: { value: string; onChange: (v: string) => void; opts: string[]; label: string }) => (
  <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value)}>{opts.map((o) => <option key={o}>{o}</option>)}</select>
);

export type Col<T> = { label: string; val: (r: T) => string | number; render?: (r: T) => ReactNode };
export function DataTable<T>({ rows, cols, onRow, pageSize = 8, empty = 'Nenhum registro encontrado. Ajuste os filtros.' }: { rows: T[]; cols: Col<T>[]; onRow?: (r: T) => void; pageSize?: number; empty?: string }) {
  const [sort, setSort] = useState<{ i: number; dir: 1 | -1 } | null>(null);
  const [page, setPage] = useState(0);
  const sorted = useMemo(() => {
    if (!sort) return rows;
    const f = cols[sort.i].val;
    return [...rows].sort((a, b) => { const x = f(a), y = f(b); return (typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), 'pt-BR')) * sort.dir; });
  }, [rows, sort, cols]);
  const pages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const p = Math.min(page, pages - 1);
  return (
    <div>
      <div className="tbl-wrap">
        <table>
          <thead><tr>{cols.map((c, i) => (
            <th key={c.label}><button onClick={() => setSort(sort?.i === i ? { i, dir: sort.dir === 1 ? -1 : 1 } : { i, dir: 1 })}>{c.label}{sort?.i === i && (sort.dir === 1 ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}</button></th>
          ))}</tr></thead>
          <tbody>
            {sorted.slice(p * pageSize, (p + 1) * pageSize).map((r, k) => (
              <tr key={k} className={onRow ? 'click' : ''} onClick={() => onRow?.(r)}>{cols.map((c) => <td key={c.label}>{c.render ? c.render(r) : c.val(r)}</td>)}</tr>
            ))}
            {!sorted.length && <tr><td colSpan={cols.length} className="empty">{empty}</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="pager"><span>{sorted.length} registros</span><div><button disabled={p === 0} onClick={() => setPage(p - 1)}>Anterior</button><span>{p + 1} / {pages}</span><button disabled={p >= pages - 1} onClick={() => setPage(p + 1)}>Próxima</button></div></div>
    </div>
  );
}
