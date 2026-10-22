import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Keep localsConvention in sync with the contentMappers options in tsconfig.json.
export default defineConfig({
  plugins: [react()],
  css: { modules: { localsConvention: "camelCaseOnly" } },
});
