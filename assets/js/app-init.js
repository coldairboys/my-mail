/* My Mail · 应用入口（ES Module）
   负责：多账号状态初始化、OAuth 回调消费、账号切换、设置规则等编排逻辑。
   UI 渲染与事件绑定委托给 app-core.js
*/
import { state, ui, accounts, saveSync, liveCount } from "./store.js";
import { bindEvents, renderAll, renderAccounts, visibleEmails, select } from "./app-core.js";
import { toast } from "./app-core.js";

const $ = (s) => document.querySelector(s);

/* ---------- 账号工具 ---------- */
function account(viewKey) {
  return accounts.get(viewKey);
}

function setAccountUI(name, mail, initial) {
  $("#accountName").textContent = name;
  $("#accountMail").textContent = mail;
  $("#accountAvatar").textContent = initial;
}

function updateChrome() {
  let name = "Yangming",
    mail = "demo@mymail.app",
    init = "Y";
  const gmail = account("gmail"),
    g2 = account("gmail2"),
    outlook = account("outlook");
  if (ui.view === "gmail" && gmail.profile) {
    mail = gmail.profile.emailAddress || "";
    name = mail.split("@")[0] || "Gmail";
    init = mail ? mail.trim().charAt(0).toUpperCase() : "G";
  }
  if (ui.view === "gmail2" && g2.profile) {
    mail = g2.profile.emailAddress || "";
    name = mail.split("@")[0] || "Gmail";
    init = mail ? mail.trim().charAt(0).toUpperCase() : "G";
  }
  if (ui.view === "outlook" && outlook.profile) {
    mail = outlook.profile.emailAddress || "";
    name = mail.split("@")[0] || "Outlook";
    init = mail ? mail.trim().charAt(0).toUpperCase() : "O";
  }
  if (ui.view === "unified") {
    name = "全部账号";
    mail = [gmail.on && "Gmail", g2.on && "Gmail", outlook.on && "Outlook"].filter(Boolean).join(" + ");
    init = "全";
  }
  setAccountUI(name, mail, init);
  ui.mode = ui.view === "demo" ? "demo" : "live";
  document.body.classList.toggle("live-mode", (gmail.on || g2.on || outlook.on) && ui.view !== "demo");
  // 账号列表（头像 + 未读角标 + 行内操作）由 app-core 统一渲染，
  // 取代了原先并排的「登录 Gmail / 登录 Outlook / 添加第二个 Gmail」三个按钮与账号 chips。
  renderAccounts();
  const foot = document.querySelector(".sidebar-footer");
  if (ui.view === "gmail" && gmail.profile)
    foot.innerHTML =
      '<span class="sync-dot" aria-hidden="true"></span> 已同步 · ' +
      (gmail.profile.messagesTotal ? `邮箱共 ${gmail.profile.messagesTotal} 封 · ` : "") +
      "Gmail 实时数据（不落盘）";
  else if (ui.view === "outlook" && outlook.profile)
    foot.innerHTML =
      '<span class="sync-dot" aria-hidden="true"></span> 已同步 · ' +
      (outlook.profile.messagesTotal ? `邮箱共 ${outlook.profile.messagesTotal} 封 · ` : "") +
      "Outlook 实时数据（不落盘）";
  else if (ui.view === "gmail2" && g2.profile)
    foot.innerHTML =
      '<span class="sync-dot" aria-hidden="true"></span> 已同步 · ' +
      (g2.profile.messagesTotal ? `邮箱共 ${g2.profile.messagesTotal} 封 · ` : "") +
      "Gmail 实时数据（不落盘）";
  else if (ui.view === "unified")
    foot.innerHTML = '<span class="sync-dot" aria-hidden="true"></span> 已同步 · 统一收件箱（不落盘）';
  else foot.innerHTML = '<span class="sync-dot" aria-hidden="true"></span> 已同步 · 演示数据';
  const sn = $("#settingsNote");
  if (sn)
    sn.textContent =
      ui.view === "demo"
        ? "演示模式：数据只保存在本机浏览器（localStorage），为虚构示例邮件。"
        : "真实模式：邮件只在内存中显示、不落盘；令牌约 1 小时有效。只读+发送权限下，删除/归档仅在本页内生效；过滤规则在邮箱加载时自动执行。";
  const rl = $("#resetLabel");
  if (rl) rl.textContent = ui.view === "demo" ? "恢复演示数据" : "重新拉取当前邮箱";
  const rb = $("#btnResetData");
  if (rb) rb.textContent = ui.view === "demo" ? "恢复" : "拉取";
}

function setView(v) {
  ui.view = v;
  ui.selectedId = null;
  ui.currentLabel = null;
  updateChrome();
  renderAll();
  const f = visibleEmails()[0];
  if (f) select(f.id, false, false);
}

/* ---------- 过滤规则 ---------- */
const RULE_ACTIONS = { spam: "移到垃圾邮件", trash: "删除", archive: "归档", read: "标已读", star: "加星标" };
function applyRules(list) {
  const rules = state.rules || [];
  if (!rules.length) return 0;
  let hit = 0;
  for (const m of list)
    for (const r of rules) {
      const hay = r.field === "subject" ? m.subject || "" : (m.from || "") + " " + (m.address || "");
      if (r.kw && hay.toLowerCase().includes(String(r.kw).toLowerCase())) {
        hit++;
        if (r.action === "star") m.starred = true;
        else if (r.action === "read") m.unread = false;
        else if (r.action === "archive" && m.folder === "inbox") m.archived = true;
        else if (r.action === "spam") {
          m.folder = "spam";
          m.archived = false;
        } else if (r.action === "trash") {
          m.folder = "trash";
          m.archived = false;
        }
      }
    }
  return hit;
}
function renderRules() {
  const ul = $("#rulesList");
  if (!ul) return;
  const rules = state.rules || [];
  const esc2 = (s) =>
    String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  ul.innerHTML = rules.length
    ? rules
        .map(
          (r, i) =>
            `<li><span>${r.field === "subject" ? "主题" : "发件人"}含「${esc2(r.kw)}」→ ${RULE_ACTIONS[r.action] || r.action}</span><button type="button" class="rules-del" data-rule="${i}" aria-label="删除规则">×</button></li>`
        )
        .join("")
    : '<li class="rules-empty">暂无规则</li>';
  ul.querySelectorAll("[data-rule]").forEach(
    (b) =>
      (b.onclick = () => {
        state.rules.splice(Number(b.dataset.rule), 1);
        saveSync();
        renderRules();
        toast("规则已删除");
      })
  );
}

/* ---------- 登录编排 ---------- */
const G = () => window.MyMailGmail;
const G2 = () => window.MyMailGmail2;
const MS = () => window.MyMailOutlook;

function showLogin(errorMsg) {
  if (errorMsg) {
    $("#loginError").hidden = false;
    $("#loginError").textContent = errorMsg;
  } else {
    $("#loginError").hidden = true;
  }
  const gCfg = G() ? G().configured() : false;
  $("#loginConfigNote").hidden = gCfg;
  const mn = $("#loginMsNote");
  if (mn) mn.hidden = !MS() || MS().configured();
  $("#loginScreen").hidden = false;
  $("#loginScreen").setAttribute("aria-hidden", "false");
}
function hideLogin() {
  $("#loginScreen").hidden = true;
  $("#loginScreen").setAttribute("aria-hidden", "true");
}

async function enterGmail(switchTo = true) {
  toast("正在拉取你的 Gmail…");
  const { profile, emails } = await G().loadAll();
  const acc = account("gmail");
  acc.profile = profile;
  acc.emails = emails;
  acc.on = true;
  const hit = applyRules(acc.emails);
  if (switchTo) {
    ui.currentFolder = "inbox";
    setView("gmail");
  } else {
    updateChrome();
    renderAll();
  }
  hideLogin();
  toast("已登录 Gmail：" + (profile.emailAddress || "") + (hit ? `（规则处理了 ${hit} 封）` : ""));
}
async function enterOutlook(switchTo = true) {
  toast("正在拉取你的 Outlook…");
  const { profile, emails } = await MS().loadAll();
  const acc = account("outlook");
  acc.profile = profile;
  acc.emails = emails;
  acc.on = true;
  const hit = applyRules(acc.emails);
  if (switchTo) {
    ui.currentFolder = "inbox";
    setView("outlook");
  } else {
    updateChrome();
    renderAll();
  }
  hideLogin();
  toast("已登录 Outlook：" + (profile.emailAddress || "") + (hit ? `（规则处理了 ${hit} 封）` : ""));
}
async function enterG2(switchTo = true) {
  toast("正在拉取第二个 Gmail…");
  const { profile, emails } = await G2().loadAll();
  const gmailAcc = account("gmail");
  if (
    gmailAcc.on &&
    gmailAcc.profile &&
    profile.emailAddress &&
    profile.emailAddress === gmailAcc.profile.emailAddress
  ) {
    G2().clearToken();
    toast("这就是你已登录的第一个 Gmail，同一个账号不用加两次");
    return false;
  }
  const acc = account("gmail2");
  acc.profile = profile;
  acc.emails = emails;
  acc.on = true;
  const hit = applyRules(acc.emails);
  if (switchTo) {
    ui.currentFolder = "inbox";
    setView("gmail2");
  } else {
    updateChrome();
    renderAll();
  }
  hideLogin();
  toast("已添加第二个 Gmail：" + (profile.emailAddress || "") + (hit ? `（规则处理了 ${hit} 封）` : ""));
  return true;
}
async function refreshCurrent() {
  const v = ui.view;
  if (v === "gmail") await enterGmail(false);
  else if (v === "gmail2") await enterG2(false);
  else if (v === "outlook") await enterOutlook(false);
  else if (v === "unified") {
    const jobs = [];
    if (account("gmail").on) jobs.push(enterGmail(false));
    if (account("gmail2").on) jobs.push(enterG2(false));
    if (account("outlook").on) jobs.push(enterOutlook(false));
    await Promise.all(jobs);
  }
}

function doG2Login() {
  if (!G2() || !G2().configured()) {
    showLogin("尚未配置 Google Client ID（见 README 的接入步骤）");
    return;
  }
  toast("正在跳转到 Google 登录（请选择第二个账号）…");
  G2().startRedirectLogin();
}
function doGoogleLogin() {
  if (!G() || !G().configured()) {
    showLogin("尚未配置 Google Client ID（见 README 的接入步骤）");
    return;
  }
  const btn = $("#btnGoogleLogin");
  btn.disabled = true;
  btn.textContent = "正在跳转到 Google 登录…";
  G().startRedirectLogin();
}
function doMsLogin() {
  if (!MS() || !MS().configured()) {
    showLogin();
    const n = $("#loginMsNote");
    if (n) n.hidden = false;
    return;
  }
  const btn = $("#btnMsLogin");
  btn.disabled = true;
  btn.textContent = "正在跳转到微软登录…";
  MS().startRedirectLogin();
}
function handleAuthGmailToggle() {
  const acc = account("gmail");
  if (!acc.on) {
    showLogin();
    return;
  }
  G().clearToken();
  acc.on = false;
  acc.emails = [];
  acc.profile = null;
  if (ui.view === "gmail" || ui.view === "unified")
    setView(account("gmail2").on ? "gmail2" : account("outlook").on ? "outlook" : "demo");
  else {
    updateChrome();
    renderAll();
  }
  toast("已退出 Gmail");
}
function handleAuthMsToggle() {
  const acc = account("outlook");
  if (!acc.on) {
    doMsLogin();
    return;
  }
  MS().clearToken();
  acc.on = false;
  acc.emails = [];
  acc.profile = null;
  if (ui.view === "outlook" || ui.view === "unified")
    setView(account("gmail").on ? "gmail" : account("gmail2").on ? "gmail2" : "demo");
  else {
    updateChrome();
    renderAll();
  }
  toast("已退出 Outlook");
}
function handleAuthG2Toggle() {
  const acc = account("gmail2");
  if (!acc.on) {
    doG2Login();
    return;
  }
  G2().clearToken();
  acc.on = false;
  acc.emails = [];
  acc.profile = null;
  if (ui.view === "gmail2" || ui.view === "unified")
    setView(account("gmail").on ? "gmail" : account("outlook").on ? "outlook" : "demo");
  else {
    updateChrome();
    renderAll();
  }
  toast("已退出第二个 Gmail");
}

/* ---------- 规则表单 ---------- */
function bindRulesForm() {
  const btn = $("#btnAddRule");
  if (!btn || btn._bound) return;
  btn._bound = true;
  btn.addEventListener("click", () => {
    const kw = $("#ruleKeyword").value.trim();
    if (!kw) {
      toast("先填关键词");
      return;
    }
    state.rules = state.rules || [];
    state.rules.push({ field: $("#ruleField").value, kw, action: $("#ruleAction").value });
    $("#ruleKeyword").value = "";
    saveSync();
    renderRules();
    toast("规则已添加，下次加载邮箱时生效");
  });
}

/* ---------- 启动 ---------- */
window.MyMailFetchCount = state.fetchCount || 40;

bindEvents({
  setView,
  updateChrome,
  enterGmail,
  enterOutlook,
  enterG2,
  doGoogleLogin,
  doMsLogin,
  doG2Login,
  showLogin,
  hideLogin,
  handleAuthGmailToggle,
  handleAuthMsToggle,
  handleAuthG2Toggle,
  renderRules,
  refreshCurrent,
});
bindRulesForm();

// 兜底：旧版 token 达到 quota 时的提示
window.addEventListener("mymail:quota-trimmed", () => toast("本地存储已接近上限，已自动精简演示数据"));

// 首屏渲染
updateChrome();
renderAll();
const first = visibleEmails()[0];
if (first) select(first.id, false, false);

// OAuth 回调消费（兼容新旧流程）
(async function initAuth() {
  const ms = MS();
  if (ms && ms.configured()) {
    let res = null;
    try {
      res = await ms.consumeRedirectCode();
    } catch (e) {}
    if (res && res.ok) {
      try {
        await enterOutlook();
      } catch (e) {
        showLogin("Outlook 拉取失败：" + e.message);
      }
      return;
    }
    if (res && res.error) {
      showLogin("Outlook 登录失败：" + res.error);
      return;
    }
    if (ms.getStoredToken()) {
      try {
        await enterOutlook(false);
      } catch (e) {}
    }
  }
  if (G() && G().configured()) {
    const oauthErr = G().consumeRedirectError();
    if (oauthErr) {
      showLogin("Google 授权未完成：" + oauthErr + "（请重新点登录，并在验证页确认授权）");
      return;
    }
    // 优先消费新 PKCE code 回调
    let target = "";
    try {
      target = sessionStorage.getItem("mymail-login-target") || "";
      sessionStorage.removeItem("mymail-login-target");
    } catch (e) {}
    const firstIsG2 = target === "2" && G2();
    const first = firstIsG2 ? G2() : G();
    const enterFirst = firstIsG2 ? enterG2 : enterGmail;

    // 若 URL 上有 ?code=，尝试 PKCE 交换
    let codeRes = null;
    try {
      codeRes = await first.consumeRedirectCode();
    } catch (e) {}
    if (codeRes && codeRes.error) {
      showLogin("Google 登录失败：" + codeRes.error);
      return;
    }
    let entered = false;
    if (codeRes && codeRes.ok) {
      try {
        entered = (await enterFirst(false)) !== false;
      } catch (e) {
        showLogin("拉取邮件失败，请重新登录：" + e.message);
        return;
      }
    } else {
      // 无回调或旧 hash token 兼容：检查现有 token
      // 先检查主账号是否有 hash code 回调被消费
      if (first.getStoredToken()) {
        try {
          entered = (await enterFirst(false)) !== false;
        } catch (e) {}
      } else if (first.consumeRedirectToken && first.consumeRedirectToken()) {
        // 兼容旧流程遗留的 hash token
        try {
          entered = (await enterFirst(false)) !== false;
        } catch (e) {}
      }
    }
    const other = firstIsG2 ? G() : G2();
    const enterOther = firstIsG2 ? enterGmail : enterG2;
    if (other) {
      let otherCodeRes = null;
      try {
        otherCodeRes = await other.consumeRedirectCode();
      } catch (e) {}
      if (otherCodeRes && otherCodeRes.ok) {
        try {
          entered = (await enterOther(false)) !== false || entered;
        } catch (e) {}
      } else if (other.getStoredToken()) {
        try {
          entered = (await enterOther(false)) !== false || entered;
        } catch (e) {}
      }
    }
    if (entered) {
      hideLogin();
      setView(
        liveCount() > 1
          ? "unified"
          : account("gmail").on
            ? "gmail"
            : account("gmail2").on
              ? "gmail2"
              : "outlook"
      );
      return;
    }
    if (account("outlook").on) {
      setView("outlook");
      return;
    }
    // 用户之前主动选过「演示模式」：刷新后不要再强制弹登录页挡住界面。
    // 侧栏的「登录 Gmail / 登录 Outlook」按钮随时可以唤起登录页。
    if (state.demoChosen) return;
    showLogin();
  } else if (account("outlook").on) setView("outlook");
  else {
    // 演示模式：若之前已登录但未配置 Client ID 的情况，展示登录页
    // 已在 updateChrome/renderAll 后展示演示数据
  }
})();
