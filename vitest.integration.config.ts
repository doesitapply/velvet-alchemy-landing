import path from "path";
import { defineConfig } from "vitest/config";

const root = path.resolve(import.meta.dirname);

export default defineConfig({
  root,
  test: {
    include: ["server/**/*.test.ts"],
    exclude: ["server/**/*.unit.test.ts", "server/**/*.live.test.ts"],
    environment: "node",
  },
  resolve: {
    alias: {
      "@": path.resolve(root, "client", "src"),
      "@shared": path.resolve(root, "shared"),
      "@assets": path.resolve(root, "attached_assets"),
    },
  },
});
