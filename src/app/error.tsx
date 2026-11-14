"use client";

import { useEffect } from "react";
import styles from "@/components/PainelAnalise.module.css";

type Props = { error: Error & { digest?: string }; reset: () => void };

export default function ErrorPage({ error, reset }: Props) {
  useEffect(() => {
    console.error("Falha ao carregar a análise do cofre", error);
  }, [error]);

  return (
    <main className={styles.pagina}>
      <div className={styles.avisoDemonstracao}>Medical Security × Bulário Anvisa</div>
      <div className={styles.conteudo}>
        <section className={styles.secao} role="alert">
          <p className={styles.sobretitulo}>FALHA NA ANÁLISE</p>
          <h1>Não foi possível carregar os dados do cofre.</h1>
          <p className={styles.mensagemApi}>Tente novamente. Se o problema persistir, verifique a disponibilidade da análise.</p>
          <button className={styles.botaoTentar} onClick={reset}>Tentar novamente</button>
        </section>
      </div>
    </main>
  );
}