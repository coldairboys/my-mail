import { defineConfig } from "vite";
export default defineConfig({
  // 纯静态站：保持根为项目根，构建到 dist
  base: "./",
  build: {
    outDir: "dist",
    assetsDir: "assets",
    // 不改动现有无打包的加载方式，vite 仅用于 dev 预览与生产压缩
    rollupOptions: { input: "index.html" },
  },
  server: { port: 5173, open: false },
});
