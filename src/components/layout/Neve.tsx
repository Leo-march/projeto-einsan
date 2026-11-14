'use client';

import { useEffect, useState, type CSSProperties } from 'react';
import { Snowflake } from 'lucide-react';

type Floco = { x: number; tam: number; dur: number; atraso: number; deriva: number; opac: number };

/** Gera os flocos de forma determinística, para a neve ser sempre a mesma e leve. */
const FLOCOS: Floco[] = Array.from({ length: 20 }, (_, i) => {
  const r = (n: number) => { const v = Math.sin((i + 1) * 12.9898 + n * 78.233) * 43758.5453; return v - Math.floor(v); };
  return {
    x: Math.round(r(1) * 100),
    tam: 10 + Math.round(r(2) * 16),
    dur: 16 + Math.round(r(3) * 18),
    atraso: -Math.round(r(4) * 34),
    deriva: Math.round((r(5) - 0.5) * 140),
    opac: 0.20 + r(6) * 0.34,
  };
});

/**
 * Neve discreta que atravessa a tela, lembrando o cofre refrigerado do San.
 * Não captura cliques, some na impressão e respeita "reduzir movimento".
 * Só é montada no navegador para não divergir da renderização do servidor.
 */
export function Neve({ ativa }: { ativa: boolean }) {
  const [montada, setMontada] = useState(false);
  useEffect(() => { setMontada(true); }, []);
  if (!montada || !ativa) return null;

  return (
    <div className="neve" aria-hidden="true">
      {FLOCOS.map((f, i) => (
        <span
          key={i}
          className="flake"
          style={{
            left: `${f.x}%`,
            width: f.tam,
            height: f.tam,
            animationDuration: `${f.dur}s`,
            animationDelay: `${f.atraso}s`,
            opacity: f.opac,
            ['--dr' as string]: `${f.deriva}px`,
          } as CSSProperties}
        >
          <Snowflake size={f.tam} strokeWidth={1.6} />
        </span>
      ))}
    </div>
  );
}