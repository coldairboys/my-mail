export default [
  {
    ignores: ["dist/**", "node_modules/**"],
  },
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        window: "readonly",
        document: "readonly",
        localStorage: "readonly",
        sessionStorage: "readonly",
        history: "readonly",
        crypto: "readonly",
        matchMedia: "readonly",
        requestAnimationFrame: "readonly",
        cancelAnimationFrame: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        URL: "readonly",
        URLSearchParams: "readonly",
        fetch: "readonly",
        structuredClone: "readonly",
        CSS: "readonly",
        Blob: "readonly",
        atob: "readonly",
        btoa: "readonly",
        TextEncoder: "readonly",
        AbortController: "readonly",
        CustomEvent: "readonly",
        Event: "readonly",
        innerWidth: "readonly",
        innerHeight: "readonly",
        performance: "readonly",
        navigator: "readonly",
        location: "readonly",
        console: "readonly",
      },
    },
    rules: {
      // 本项目大量使用 try { ... } catch (e) {} 静默兜底（localStorage、OAuth 回调等），
      // 这类空 catch 参数不是缺陷，不该淹没真正的未使用变量告警。
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrors: "none" }],
      "no-console": "off",
    },
  },
];
