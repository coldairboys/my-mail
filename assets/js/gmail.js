/* My Mail · Gmail 接入层
   安全模型（与 README 的「安全说明」一致）：
   - 登录走 Google Identity Services 的 OAuth 令牌流程，密码只在 Google 官方页面输入
   - 本文件只用 Client ID（公开标识），没有也不需要 client_secret
   - access token 只存 sessionStorage（关标签页即失效，约 1 小时过期），不写 localStorage、不上传任何服务器
   - 邮件数据只在浏览器内存里，页面关掉即消失，不落盘
   - 权限范围：gmail.readonly（只读）+ gmail.send（发送）；管理动作（删除/归档等）
     在只读权限下无法写回 Gmail，本页内由 app.js 做会话级本地处理 */

(function () {
  "use strict";
  const CFG = window.MYMAIL_CONFIG || {};
  const TOKEN_KEY = "mymail-gmail-token";
  const EXP_KEY = "mymail-gmail-token-exp";
  let tokenClient = null;
  let gisReady = null;

  const configured = () => Boolean(CFG.GOOGLE_CLIENT_ID);

  function loadGIS() {
    if (gisReady) return gisReady;
    gisReady = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = "https://accounts.google.com/gsi/client";
      s.async = true;
      s.onload = () => resolve(window.google);
      s.onerror = () => reject(new Error("Google 登录组件加载失败，请检查网络"));
      document.head.appendChild(s);
    });
    return gisReady;
  }

  function getStoredToken() {
    try {
      const t = sessionStorage.getItem(TOKEN_KEY);
      const exp = Number(sessionStorage.getItem(EXP_KEY) || 0);
      if (t && exp > Date.now() + 30_000) return t;
    } catch (e) {}
    return null;
  }
  function storeToken(accessToken, expiresInSec) {
    try {
      sessionStorage.setItem(TOKEN_KEY, accessToken);
      sessionStorage.setItem(EXP_KEY, String(Date.now() + (expiresInSec || 3600) * 1000));
    } catch (e) {}
  }
  function clearToken() {
    try { sessionStorage.removeItem(TOKEN_KEY); sessionStorage.removeItem(EXP_KEY); } catch (e) {}
  }

  /* 预初始化令牌客户端：让点击时能同步发起授权弹窗，避免被浏览器按「非用户手势」拦截 */
  let pendingResolve = null, pendingReject = null;
  function ensureClient(google) {
    if (tokenClient || !configured()) return;
    tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: CFG.GOOGLE_CLIENT_ID,
      scope: CFG.GMAIL_SCOPES,
      callback: (resp) => {
        if (resp && resp.access_token) {
          storeToken(resp.access_token, Number(resp.expires_in || 3600));
          if (pendingResolve) pendingResolve(resp.access_token);
        } else if (pendingReject) pendingReject(new Error("没有拿到授权令牌"));
        pendingResolve = pendingReject = null;
      },
      error_callback: (err) => {
        if (pendingReject) pendingReject(new Error("授权被取消或失败" + (err && err.type ? "：" + err.type : "")));
        pendingResolve = pendingReject = null;
      },
    });
  }
  if (configured()) loadGIS().then(ensureClient).catch(() => {});

  async function signIn() {
    if (!configured()) throw new Error("尚未配置 GOOGLE_CLIENT_ID（见 README 的接入步骤）");
    const google = await loadGIS();
    ensureClient(google);
    return new Promise((resolve, reject) => {
      pendingResolve = resolve; pendingReject = reject;
      tokenClient.requestAccessToken({ prompt: getStoredToken() ? "" : "consent" });
    });
  }

  /* ---------- 整页跳转登录（隐式流程）：弹窗打不开时（App 内嵌浏览器等）的回退 ----------
     需在 Google Cloud 控制台为该客户端登记重定向 URI：站点根地址本身 */
  function redirectUri() { return window.location.origin + window.location.pathname; }
  function startRedirectLogin() {
    const u = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    u.searchParams.set("client_id", CFG.GOOGLE_CLIENT_ID);
    u.searchParams.set("redirect_uri", redirectUri());
    u.searchParams.set("response_type", "token");
    u.searchParams.set("scope", CFG.GMAIL_SCOPES);
    u.searchParams.set("include_granted_scopes", "true");
    u.searchParams.set("prompt", "consent");
    window.location.assign(u.toString());
  }
  function consumeRedirectError() {
    if (!window.location.hash || !window.location.hash.includes("error=")) return null;
    const p = new URLSearchParams(window.location.hash.slice(1));
    const err = p.get("error");
    if (err) history.replaceState(null, "", window.location.pathname + window.location.search);
    return err;
  }
  function consumeRedirectToken() {
    if (!window.location.hash || !window.location.hash.includes("access_token=")) return false;
    const p = new URLSearchParams(window.location.hash.slice(1));
    const token = p.get("access_token");
    if (!token) return false;
    storeToken(token, Number(p.get("expires_in") || 3600));
    history.replaceState(null, "", window.location.pathname + window.location.search);
    return true;
  }

  async function api(path, options = {}) {
    let token = getStoredToken();
    if (!token) token = await signIn();
    const resp = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/" + path, {
      ...options,
      headers: { Authorization: "Bearer " + token, "Content-Type": "application/json", ...(options.headers || {}) },
    });
    if (resp.status === 401) { clearToken(); throw new Error("登录已过期，请重新登录"); }
    if (!resp.ok) throw new Error("Gmail 接口返回 " + resp.status);
    return resp.status === 204 ? {} : resp.json();
  }

  /* ---------- 邮件解析 ---------- */
  const decodeEntities = (s) => {
    const ta = document.createElement("textarea");
    ta.innerHTML = s || "";
    return ta.value;
  };
  function header(headers, name) {
    const h = (headers || []).find((x) => x.name.toLowerCase() === name.toLowerCase());
    return h ? decodeEntities(h.value) : "";
  }
  function parseAddress(from) {
    const m = /^(.*?)\s*<([^>]+)>$/.exec(from || "");
    if (m) return { name: m[1].replace(/^"|"$/g, "") || m[2], address: m[2] };
    return { name: from || "(未知)", address: from || "" };
  }
  function b64ToText(data) {
    try {
      const bin = atob((data || "").replace(/-/g, "+").replace(/_/g, "/"));
      const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
      return new TextDecoder("utf-8").decode(bytes);
    } catch (e) { return ""; }
  }
  function collectParts(payload, texts, atts) {
    if (!payload) return;
    if (payload.filename && payload.body) {
      atts.push({ filename: payload.filename, mimeType: payload.mimeType || "", size: payload.body.size || 0, attachmentId: payload.body.attachmentId || null });
    }
    if (payload.body && payload.body.data) texts.push({ mime: payload.mimeType, text: b64ToText(payload.body.data) });
    (payload.parts || []).forEach((p) => collectParts(p, texts, atts));
  }
  function gmailCategory(labelIds) {
    if (labelIds.includes("CATEGORY_PROMOTIONS")) return "promo";
    if (labelIds.includes("CATEGORY_SOCIAL")) return "social";
    if (labelIds.includes("CATEGORY_UPDATES") || labelIds.includes("CATEGORY_FORUMS")) return "updates";
    return null;
  }
  function bodyParagraphs(msg) {
    const parts = [];
    collectParts(msg.payload, parts, []);
    let text = "";
    const plain = parts.find((p) => p.mime === "text/plain");
    if (plain) text = plain.text;
    else {
      const html = parts.find((p) => p.mime === "text/html");
      if (html) {
        const div = document.createElement("div");
        div.innerHTML = html.text;
        text = div.textContent || "";
      }
    }
    const paras = text.split(/\n{2,}|\r\n{2,}/).map((p) => p.replace(/\s+\n/g, "\n").trim()).filter(Boolean);
    return paras.length ? paras : [msg.snippet || "(无正文)"];
  }
  function primaryFolder(labelIds, fallback) {
    if (labelIds.includes("TRASH")) return "trash";
    if (labelIds.includes("SPAM")) return "spam";
    if (labelIds.includes("DRAFT")) return "drafts";
    if (labelIds.includes("SENT")) return "sent";
    return fallback || "inbox";
  }
  function toEmail(msg, fallbackFolder) {
    const h = (msg.payload && msg.payload.headers) || [];
    const from = parseAddress(header(h, "From"));
    const labelIds = msg.labelIds || [];
    const d = new Date(Number(msg.internalDate || Date.now()));
    const pad = (n) => String(n).padStart(2, "0");
    return {
      id: msg.id, provider: "gmail", bodyLoaded: true,
      ts: Number(msg.internalDate || 0),
      from: from.name, address: from.address,
      to: header(h, "To") || "我",
      date: `${d.getMonth() + 1}月${d.getDate()}日`,
      time: `${d.getMonth() + 1}月${d.getDate()}日 ${pad(d.getHours())}:${pad(d.getMinutes())}`,
      subject: header(h, "Subject") || "(无主题)",
      snippet: decodeEntities(msg.snippet || ""),
      label: null,
      folder: primaryFolder(labelIds, fallbackFolder),
      archived: !labelIds.includes("INBOX") && !["TRASH", "SPAM", "DRAFT", "SENT"].some((x) => labelIds.includes(x)),
      unread: labelIds.includes("UNREAD"),
      starred: labelIds.includes("STARRED"),
      body: bodyParagraphs(msg),
      bodyZh: null,
      attachments: (() => { const atts = []; collectParts(msg.payload, [], atts); return atts; })(),
      unsub: (() => { const v = header(h, "List-Unsubscribe"); const mm = /<(https?:[^>]+)>/.exec(v || ""); const mo = /<(mailto:[^>]+)>/.exec(v || ""); return mm ? mm[1] : mo ? mo[1] : null; })(),
      gmailLabelIds: labelIds,
      important: labelIds.includes("IMPORTANT"),
      category: gmailCategory(labelIds),
      gmailThreadId: msg.threadId,
    };
  }

  async function fetchList(params) {
    const qs = new URLSearchParams(params).toString();
    const data = await api("messages?" + qs);
    const ids = (data.messages || []).map((m) => m.id);
    // 并发拉取（6 路）：逐封顺序请求会让列表等很久
    const msgs = [];
    let cursor = 0;
    async function worker() {
      while (cursor < ids.length) {
        const id = ids[cursor++];
        try { msgs.push(await api("messages/" + id + "?format=full")); } catch (e) {}
      }
    }
    await Promise.all(Array.from({ length: Math.min(6, ids.length) }, worker));
    return msgs;
  }

  async function loadAll() {
    const profile = await api("profile");
    const byIdMap = new Map();
    const jobs = [
      { labelIds: "INBOX", maxResults: "40" },
      { labelIds: "SENT", maxResults: "20" },
      { labelIds: "DRAFT", maxResults: "20" },
      { labelIds: "SPAM", maxResults: "20" },
      { labelIds: "TRASH", maxResults: "20" },
      { labelIds: "STARRED", maxResults: "40" },
    ];
    for (const job of jobs) {
      const msgs = await fetchList(job);
      for (const raw of msgs) {
        const em = toEmail(raw);
        if (byIdMap.has(em.id)) {
          const prev = byIdMap.get(em.id);
          prev.starred = prev.starred || em.starred;
        } else byIdMap.set(em.id, em);
      }
    }
    return { profile, emails: [...byIdMap.values()] };
  }

  function utf8ToB64Url(str) {
    const bytes = new TextEncoder().encode(str);
    let bin = "";
    bytes.forEach((b) => (bin += String.fromCharCode(b)));
    return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }
  async function send({ to, subject, body, threadId }) {
    const raw = [`To: ${to}`, `Subject: ${subject || ""}`, "Content-Type: text/plain; charset=UTF-8", "", body || ""].join("\r\n");
    const payload = { raw: utf8ToB64Url(raw) };
    if (threadId) payload.threadId = threadId;
    return api("messages/send", { method: "POST", body: JSON.stringify(payload) });
  }

  /* ---------- 翻译（公开的 gtx 端点，失败时由调用方提示） ---------- */
  async function translateParagraphs(paragraphs, target) {
    const tl = target === "en" ? "en" : "zh-CN";
    const out = [];
    for (const p of paragraphs) {
      const url = "https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&dt=t&tl=" +
        tl + "&q=" + encodeURIComponent(p.slice(0, 1500));
      const r = await fetch(url);
      if (!r.ok) throw new Error("翻译服务返回 " + r.status);
      const data = await r.json();
      out.push((data[0] || []).map((seg) => seg[0]).join(""));
    }
    return out;
  }

  async function searchAll(q) {
    const msgs = await fetchList({ q, maxResults: "30" });
    return msgs.map((raw) => toEmail(raw));
  }
  async function downloadAttachment(messageId, attachmentId) {
    const r = await api("messages/" + messageId + "/attachments/" + attachmentId);
    return r.data || "";
  }

  window.MyMailGmail = { configured, signIn, startRedirectLogin, consumeRedirectToken, consumeRedirectError, getStoredToken, clearToken, loadAll, send, translateParagraphs, searchAll, downloadAttachment };
})();
