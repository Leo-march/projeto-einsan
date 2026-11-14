'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { CornerDownLeft, Search } from 'lucide-react';

export type ItemPaleta = {
  id: string;
  grupo: string;
  rotulo: string;
  detalhe?: string;
  tecla?: string;
  acao: () => void;
};

const norm = (t: string) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/**
 * Paleta de comandos: um único campo para ir a qualquer seção
 * ou procurar um medicamento no estoque. Abre com "/" ou Ctrl/⌘ + K.
 */
export function Paleta({
  itens,
  onBuscar,
  onFechar,
}: {
  itens: ItemPaleta[];
  onBuscar: (consulta: string) => void;
  onFechar: () => void;
}) {
  const [q, setQ] = useState('');
  const [i, setI] = useState(0);
  const ativo = useRef<HTMLButtonElement>(null);

  const lista = useMemo(() => {
    const termo = norm(q.trim());
    const achados = termo
      ? itens.filter((x) => norm(`${x.rotulo} ${x.detalhe ?? ''} ${x.grupo}`).includes(termo))
      : itens;
    const busca: ItemPaleta[] = q.trim()
      ? [{ id: 'busca', grupo: 'Estoque', rotulo: `Buscar “${q.trim()}” no estoque`, acao: () => onBuscar(q.trim()) }]
      : [];
    return [...achados.slice(0, 14), ...busca];
  }, [q, itens, onBuscar]);

  useEffect(() => { setI(0); }, [q]);
  useEffect(() => { ativo.current?.scrollIntoView({ block: 'nearest' }); }, [i]);

  const aoTeclar = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { e.preventDefault(); onFechar(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); setI((n) => Math.min(n + 1, lista.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setI((n) => Math.max(n - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); lista[i]?.acao(); }
  };

  let grupoAnterior = '';

  return (
    <div className="pal-overlay" onClick={onFechar}>
      <div
        className="pal"
        role="dialog"
        aria-modal="true"
        aria-label="Ir para ou buscar"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={aoTeclar}
      >
        <div className="pal-in">
          <Search size={16} />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Ir para uma seção ou buscar um medicamento"
            aria-label="Ir para uma seção ou buscar um medicamento"
          />
          <kbd>Esc</kbd>
        </div>

        <div className="pal-list" role="listbox">
          {lista.length === 0 && <p className="pal-empty">Nada encontrado.</p>}
          {lista.map((x, n) => {
            const cabecalho = x.grupo !== grupoAnterior ? x.grupo : '';
            grupoAnterior = x.grupo;
            return (
              <div key={x.id}>
                {cabecalho && <div className="pal-g">{cabecalho}</div>}
                <button
                  ref={n === i ? ativo : undefined}
                  type="button"
                  role="option"
                  aria-selected={n === i}
                  className={`pal-i ${n === i ? 'on' : ''}`}
                  onMouseMove={() => setI(n)}
                  onClick={x.acao}
                >
                  <b>{x.rotulo}</b>
                  {x.detalhe && <span>{x.detalhe}</span>}
                  {x.tecla && <kbd>{x.tecla}</kbd>}
                </button>
              </div>
            );
          })}
        </div>

        <div className="pal-foot">
          <span>↑↓ navegar</span>
          <span><CornerDownLeft size={11} style={{ verticalAlign: -1 }} /> abrir</span>
          <span style={{ marginLeft: 'auto' }}>1–9, 0 saltam entre seções</span>
        </div>
      </div>
    </div>
  );
}