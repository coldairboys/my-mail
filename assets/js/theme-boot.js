/* My Mail · 首屏主题预设（外链脚本，符合 CSP 规范并防止首屏闪烁 FOUC）
   在 head 中同步执行：读取已保存的主题模式，auto 时跟随系统偏好 */
(function () {
  try {
    var s = JSON.parse(localStorage.getItem("mymail-state-v2") || "{}");
    var mode = s.themeMode || "auto";
    var dark = mode === "dark" || (mode === "auto" && matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.dataset.theme = dark ? "dark" : "light";
  } catch (e) {}
})();
