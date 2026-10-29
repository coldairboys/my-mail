import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom", // decodeEntities / store.js 都要用 document 与 localStorage
    include: ["tests/**/*.test.js"],
    // jsdom 对 location.assign 导航未实现，会向虚拟控制台打「Not implemented: navigation」。
    // 该噪音来自 gmail-client 测试里 startRedirectLogin 的真实跳转（已被会话状态断言覆盖），
    // 在这里按内容过滤，保持 CI stderr 干净；其余 stderr 原样保留。
    onConsoleLog(log, type) {
      if (log.includes("Not implemented: navigation")) return false;
      return undefined;
    },
  },
});
