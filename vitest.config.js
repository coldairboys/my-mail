import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom", // decodeEntities / store.js 都要用 document 与 localStorage
    include: ["tests/**/*.test.js"],
  },
});
