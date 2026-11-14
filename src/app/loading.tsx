import styles from "@/components/PainelAnalise.module.css";

export default function Loading() {
  return (
    <main className={styles.pagina} aria-busy="true" aria-live="polite">
      <div className={styles.avisoDemonstracao}>Carregando análise do cofre…</div>
      <div className={styles.conteudo}>
        <p className={styles.vazio}>Aguardando os dados da análise.</p>
      </div>
    </main>
  );
}