import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom", // decodeEntities / store.js 都要用 document 与 localStorage
    include: ["tests/**/*.test.js"],
    // stderr 噪音过滤见 tests/setup.quiet-jsdom.js（jsdom 导航噪音，仅该一条被吞）
    setupFiles: ["tests/setup.quiet-jsdom.js"],
  },
});
