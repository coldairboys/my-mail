/* My Mail · 侧栏渲染：账号 rail + 文件夹/标签导航
   从 app-core.js 拆出。 */
import { state, ui, accounts, src, liveCount } from "../store.js";
import { LABELS, FOLDERS } from "../data.module.js";
import { esc, strHash } from "../utils.js";
import { $ } from "../core/dom.js";
import { ICONS, hydrateIcons } from "./icons.js";
import { folderCount } from "../core/visible.js";

// 同一个邮箱每次得到同一个色相，头像颜色稳定不跳变（哈希统一走 utils.strHash）
function accountHue(seed) {
  return strHash(seed) % 360;
}
// 只统计收件箱里真正未读、且未归档的邮件，和侧栏文件夹计数的口径一致
function accountUnread(emails) {
  return (emails || []).filter((m) => m.unread && m.folder === "inbox" && !m.archived).length;
}
function accountLabel(provider) {
  if (provider === "outlook") return "Outlook";
  if (provider === "gmail2") return "Gmail 2";
  return "Gmail";
}
function accountEntries() {
  const rows = [];
  const live = liveCount();
  // 统一收件箱排在最前，只有登录了两个以上真实账号时才出现
  if (live > 1) {
    let total = 0;
    for (const a of accounts.values()) if (a.on) total += accountUnread(a.emails);
    rows.push({
      key: "unified",
      name: "全部账号",
      mail: "统一收件箱",
      unread: total,
      icon: "layers",
      removable: false,
    });
  }
  rows.push({
    key: "demo",
    name: "演示数据",
    mail: "demo@mymail.app",
    unread: accountUnread(state.emails),
    icon: null,
    removable: false,
  });
  for (const key of ["gmail", "gmail2", "outlook"]) {
    const acc = accounts.get(key);
    if (!acc || !acc.on) continue;
    const mail = acc.profile?.emailAddress || "";
    rows.push({
      key,
      name: mail ? mail.split("@")[0] : accountLabel(key),
      mail: mail || accountLabel(key) + "（已连接）",
      unread: accountUnread(acc.emails),
      hue: accountHue(mail || key),
      icon: null,
      removable: true,
      provider: key,
    });
  }
  return rows;
}

export function renderAccounts() {
  const ul = $("#accountList");
  if (!ul) return;
  const rows = accountEntries();
  ul.innerHTML = rows
    .map((r) => {
      const active = ui.view === r.key;
      const avatar = r.icon
        ? `<span class="acct-avatar acct-avatar-icon" aria-hidden="true">${ICONS[r.icon] || ""}</span>`
        : `<span class="acct-avatar" style="--hue:${
            r.hue ?? 214
          }" aria-hidden="true">${esc((r.name || "?").trim().charAt(0).toUpperCase())}</span>`;
      const badge = r.unread
        ? `<span class="acct-unread" title="${r.unread} 封未读">${r.unread > 99 ? "99+" : r.unread}</span>`
        : "";
      const more = r.removable
        ? `<button type="button" class="acct-more" data-acct-menu="${r.key}" aria-label="${esc(
            r.name
          )} 的账号操作" title="账号操作"><span data-icon="more" aria-hidden="true"></span></button>`
        : "";
      return (
        `<li class="acct-item${active ? " active" : ""}">` +
        `<button type="button" class="acct-btn" data-acct-view="${r.key}" aria-current="${
          active ? "true" : "false"
        }" title="${esc(r.mail)}">` +
        avatar +
        `<span class="acct-info"><span class="acct-name">${esc(r.name)}</span>` +
        `<span class="acct-mail">${esc(r.mail)}</span></span>` +
        badge +
        `</button>${more}</li>`
      );
    })
    .join("");
  hydrateIcons(ul);
}

export function renderNav() {
  // 折叠成图标栏后文字会被 CSS 隐藏，title 与 aria-label 成为唯一的可读标识
  $("#folderList").innerHTML = FOLDERS.map((f) => {
    const n = folderCount(f.id);
    const active = !ui.currentLabel && ui.currentFolder === f.id;
    return (
      `<li class="${active ? "active" : ""}" data-folder="${f.id}" role="button" tabindex="0" aria-current="${active ? "true" : "false"}" title="${esc(f.name)}" aria-label="${esc(f.name)}">` +
      `<span class="nav-icon">${ICONS[f.icon] || ""}</span><span>${esc(f.name)}</span>` +
      `${n ? `<span class="nav-count">${n}</span>` : ""}</li>`
    );
  }).join("");
  $("#labelList").innerHTML = LABELS.map((l) => {
    const n = src().filter((m) => m.label === l.id && m.folder !== "trash" && m.folder !== "spam").length;
    const active = ui.currentLabel === l.id;
    return (
      `<li class="${active ? "active" : ""}" data-label="${l.id}" role="button" tabindex="0" aria-current="${active ? "true" : "false"}" title="${esc(l.name)}" aria-label="${esc(l.name)}">` +
      `<span class="label-dot" style="background:${l.color}"></span><span>${esc(l.name)}</span>` +
      `${n ? `<span class="nav-count">${n}</span>` : ""}</li>`
    );
  }).join("");
}

export { accountUnread, accountLabel };
