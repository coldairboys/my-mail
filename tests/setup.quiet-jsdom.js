/* jsdom 环境的 stderr 噪音过滤（vitest 5 + jsdom 30）
   jsdom 对 location.assign 导航未实现，会经 JSDOM 默认 virtualConsole 的 jsdomError
   直接打到 stderr（jsdom 30 文案为 "navigation to another Document"，旧版为
   "navigation (except hash changes)"）。
   噪音来源：gmail-client 测试里 startRedirectLogin 的真实跳转（会话状态已被断言覆盖）。
   做法：摘掉运行中 JSDOM 实例 virtualConsole 上 jsdomError 的默认监听
   （removeAllListeners('jsdomError') 已实测可摘），装上过滤版——仅吞导航噪音，
   其余 jsdomError 原样透传到 stderr；console 系输出不动。
   注意：VirtualConsole 含函数，无法跨 vitest forks worker 序列化，所以必须在
   setup 文件（环境内部）做，不能在 vitest.config.js 经 environmentOptions 传。 */

const dom = globalThis.jsdom;
if (dom && dom.virtualConsole) {
  const vc = dom.virtualConsole;
  // 摘掉 jsdom 内部挂的默认「直接打 stderr」监听，再装过滤版
  vc.removeAllListeners("jsdomError");
  vc.on("jsdomError", (err) => {
    const msg = err && err.message ? err.message : String(err);
    if (!/Not implemented: navigation/.test(msg)) console.error(msg);
  });
}
