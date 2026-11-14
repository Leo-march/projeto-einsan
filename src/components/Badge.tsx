import type { ReactNode } from "react";
import styles from "./Badge.module.css";

export type TomBadge = "critica" | "alta" | "media" | "baixa" | "ok" | "neutro";

type Props = {
  children: ReactNode;
  tom: TomBadge;
};

const icones: Record<TomBadge, string> = {
  critica: "!",
  alta: "▲",
  media: "◆",
  baixa: "•",
  ok: "✓",
  neutro: "i",
};

export default function Badge({ children, tom }: Props) {
  return <span className={`${styles.badge} ${styles[tom]}`}><span aria-hidden="true">{icones[tom]}</span>{children}</span>;
}