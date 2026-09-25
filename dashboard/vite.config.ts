import { fileURLToPath, URL } from "node:url";

import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    // Định tuyến theo file (docs/10 §5): tự sinh routeTree.gen.ts và tách chunk theo route.
    tanstackRouter({
      target: "react",
      autoCodeSplitting: true,
      routesDirectory: "./src/app/routes",
      generatedRouteTree: "./src/app/routeTree.gen.ts",
    }),
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}", "tests/**/*.test.ts"],
    css: false,
    coverage: {
      provider: "v8",
      include: ["src/shared/**", "src/entities/**", "src/features/**"],
      exclude: [
        "src/shared/api/schema.gen.ts",
        "src/**/*.test.{ts,tsx}",
        "src/mocks/**",
        "src/test/**",
      ],
    },
  },
});
