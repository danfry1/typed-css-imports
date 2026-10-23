import type { ReactNode } from "react";
import styles from "./Card.module.scss";

type Props = {
  title: string;
  tone?: "info" | "warning";
  children: ReactNode;
};

export function Card({ title, tone = "info", children }: Props) {
  const tones = { info: styles.toneInfo, warning: styles.toneWarning };
  return (
    <section className={`${styles.card} ${tones[tone]}`}>
      <h2 className={styles.cardTitle}>{title}</h2>
      {children}
    </section>
  );
}
