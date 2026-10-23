// Fails loudly if typed-css-imports isn't running. With the mapper, the class below doesn't exist, so the
// expect-error directive is satisfied. Without it (e.g. VS Code on its bundled TypeScript 7.0, or no
// --runExternalCode), the import falls back to vite/client's { [key: string]: string } and TypeScript reports
// TS2578, "Unused '@ts-expect-error' directive", on the line below.
import styles from "./Button.module.css";

// @ts-expect-error typed-css-imports is not running if this line is not an error
styles.thisClassDoesNotExist;
