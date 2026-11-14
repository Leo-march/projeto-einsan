import type { ReactNode } from "react";
import styles from "./CartaoResumo.module.css";

type Props = {
  rotulo: string;
  valor: ReactNode;
  detalhe: string;
  destaque?: boolean;
};

export default function CartaoResumo({ rotulo, valor, detalhe, destaque = false }: Props) {
  return (
    <article className={`${styles.card} ${destaque ? styles.destaque : ""}`}>
      <span className={styles.label}>{rotulo}</span>
      <strong className={styles.value}>{valor}</strong>
      <span className={styles.detail}>{detalhe}</span>
    </article>
  );
}