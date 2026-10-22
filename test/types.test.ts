// Type tests: run by `tsc -p test --runExternalCode` with localsConvention camelCase (see tsconfig.json).
// vite-env.d.ts declares the usual `*.module.css` wildcard; the mapped types must take precedence over it.
import styles from "./button.module.css";

const names: string[] = [
  styles.button, styles["button-primary"], styles.buttonPrimary, styles.icon, styles.label, styles.wide,
  styles.local, styles.price, styles.card, styles.active, styles.main, styles.spin, styles.brand, styles["sm:p-4"],
];
void names;

// @ts-expect-error typo
styles.buttn;
// @ts-expect-error commented-out class
styles["commented-out"];
// @ts-expect-error :global class is not exported
styles["not-mine"];
// @ts-expect-error class name inside a string
styles.fake;
// @ts-expect-error class names are read-only
styles.button = "x";
// @ts-expect-error values are strings
const n: number = styles.button;
void n;
export {};
