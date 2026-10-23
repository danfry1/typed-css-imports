// Type tests: run by `tsc -p test --runExternalCode` with localsConvention camelCase (see tsconfig.json).
// vite-env.d.ts declares the usual `*.module.css` wildcard; the mapped types must take precedence over it.
import styles from "./button.module.css";
import card from "./card.module.scss";
import list from "./list.module.sass";

const names: string[] = [
  styles.button, styles["button-primary"], styles.buttonPrimary, styles.icon, styles.label, styles.wide,
  styles.local, styles.price, styles.card, styles.active, styles.main, styles.spin, styles.brand, styles["sm:p-4"],
];
void names;

// Sass modules: classes from nesting, a partial, a mixin in a loop and @extend.
const sassNames: string[] = [
  card.card, card.cardTitle, card["is-active"], card.isActive, card.stack, card.toneInfo, card["tone-danger"],
  list.list, list.listItem,
];
void sassNames;
// @ts-expect-error placeholders are not exported
card.surface;
// @ts-expect-error Sass variables are not exported
card.brand;

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
