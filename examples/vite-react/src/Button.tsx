import type { ReactNode } from "react";
import styles from "./Button.module.css";

type Props = {
  variant?: "primary" | "ghost";
  children: ReactNode;
};

export function Button({ variant = "primary", children }: Props) {
  const variants = {
    primary: styles.primary,
    ghost: styles.ghost,
  };
  return (
    <button className={`${styles.button} ${variants[variant]}`}>
      {children}
    </button>
  );
}
