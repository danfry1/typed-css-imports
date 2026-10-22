import type { ReactNode } from "react";
import styles from "./Button.module.css";

export function Button({ variant = "primary", children }: { variant?: "primary" | "ghost"; children: ReactNode }) {
  const variantClass = variant === "primary" ? styles.buttonPrimary : styles.buttonGhost;
  return <button className={`${styles.button} ${variantClass}`}>{children}</button>;
}
