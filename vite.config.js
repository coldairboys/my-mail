import { defineConfig } from "vite";

/* 生产构建注入 CSP：纯静态站能上的第一道防线（XSS 缩小面）。
   只在 build 时注入——dev 模式下 Vite 的 HMR 需要内联脚本与 ws 连接，会被 CSP 拦。
   说明：
   - script/style 需要 'unsafe-inline'：index.html 有首屏主题内联脚本，模板大量行内 style
   - img/media 放开 *：HTML 邮件在沙箱 iframe 里要加载任意发件方的图片
   - connect-src 收敛到实际调用的 API 域（Gmail / OAuth / Graph / 翻译） */
const CSP = [
  "default-src 'self'",
  "connect-src 'self' https://gmail.googleapis.com https://graph.microsoft.com https://oauth2.googleapis.com https://accounts.google.com https://login.microsoftonline.com https://translate.googleapis.com https://api.mymemory.translated.net",
  "frame-src 'self' blob: data:",
  "img-src 'self' data: https: blob:",
  "media-src 'self' data: blob:",
  "font-src 'self' data:",
  "style-src 'self' 'unsafe-inline'",
  "script-src 'self' 'unsafe-inline'",
  "object-src 'none'",
  "base-uri 'self'",
].join("; ");

function cspPlugin() {
  return {
    name: "inject-csp-meta",
    apply: "build",
    transformIndexHtml(html) {
      if (html.includes("Content-Security-Policy")) {
        return html.replace(
          /<meta[\s\S]*?http-equiv="Content-Security-Policy"[\s\S]*?content="[^"]*"[\s\S]*?\/?>/i,
          `<meta http-equiv="Content-Security-Policy" content="${CSP}" />`
        );
      }
      return html.replace(
        "<head>",
        () => `<head>\n    <meta http-equiv="Content-Security-Policy" content="${CSP}" />`
      );
    },
  };
}

export default defineConfig({
  // 纯静态站：保持根为项目根，构建到 dist
  base: "./",
  plugins: [cspPlugin()],
  build: {
    outDir: "dist",
    assetsDir: "assets",
    // 不改动现有无打包的加载方式，vite 仅用于 dev 预览与生产压缩
    rollupOptions: { input: "index.html" },
  },
  server: { port: 5173, open: false },
});
