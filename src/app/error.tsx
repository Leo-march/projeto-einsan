"use client";

import { useEffect } from "react";

type Props = { error: Error & { digest?: string }; reset: () => void };

export default function ErrorPage({ error, reset }: Props) {
  useEffect(() => {
    console.error("Falha ao carregar a análise do cofre", error);
  }, [error]);

  return (
    <section className="card" role="alert">
      <header className="card-h"><h3>Falha na análise</h3></header>
      <h2 style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-.02em', marginBottom: 8 }}>Não foi possível carregar os dados do cofre.</h2>
      <p style={{ color: 'var(--mu)', marginBottom: 16 }}>Tente novamente. Se o problema persistir, verifique a disponibilidade da análise.</p>
      <button className="btn pri" onClick={reset}>Tentar novamente</button>
    </section>
  );
}