import { Button } from "./Button";
import { Card } from "./Card";
import styles from "./App.module.css";

export function App() {
  return (
    <main className={styles.app}>
      <h1>typed-css-imports</h1>
      <Card title="Unsaved changes" tone="warning">
        <div className={styles.actions}>
          <Button>Save</Button>
          <Button variant="ghost">Cancel</Button>
        </div>
      </Card>
    </main>
  );
}
