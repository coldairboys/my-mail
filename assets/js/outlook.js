/* My Mail · Outlook 接入层（Microsoft Graph · v4）
   与 Gmail 层相同的安全模型：OAuth 只在微软官方页面完成；Client ID 是公开标识；
   令牌只存 sessionStorage；邮件只在内存。授权走 PKCE 整页跳转（SPA 推荐方式，
   不需要、也不使用 client_secret）。权限：Mail.Read + Mail.Send + User.Read。
   v4 修复：searchAll 的 OData 编码（用 encodeURIComponent 包裹整个搜索短语）。 */
import { bytesToB64url as b64url } from "./utils.js";
import { parseHtmlToText } from "./mail-parse.js";

(function () {
  "use strict";
  const CFG = window.MYMAIL_CONFIG || {};
  const TOKEN_KEY = "mymail-ms-token";
  const EXP_KEY = "mymail-ms-token-exp";
  const VERIFIER_KEY = "mymail-ms-verifier";
  const STATE_KEY = "mymail-ms-state";
  const AUTH_BASE = "https://login.microsoftonline.com/consumers/oauth2/v2.0";
  const GRAPH = "https://graph.microsoft.com/v1.0/me";
  const SCOPES =
    "https://graph.microsoft.com/User.Read https://graph.microsoft.com/Mail.Read https://graph.microsoft.com/Mail.Send";

  const configured = () => Boolean(CFG.MS_CLIENT_ID);
  const redirectUri = () => window.location.origin + window.location.pathname;

  function storeToken(t, expSec) {
    try {
      sessionStorage.setItem(TOKEN_KEY, t);
      sessionStorage.setItem(EXP_KEY, String(Date.now() + (expSec || 3600) * 1000));
    } catch (e) {}
  }
  function getStoredToken() {
    try {
      const t = sessionStorage.getItem(TOKEN_KEY);
      const exp = Number(sessionStorage.getItem(EXP_KEY) || 0);
      if (t && exp > Date.now() + 30_000) return t;
    } catch (e) {}
    return null;
  }
  function clearToken() {
    try {
      sessionStorage.removeItem(TOKEN_KEY);
      sessionStorage.removeItem(EXP_KEY);
      sessionStorage.removeItem(VERIFIER_KEY);
      sessionStorage.removeItem(STATE_KEY);
    } catch (e) {}
  }

  function randomState(len) {
    const b = crypto.getRandomValues(new Uint8Array(len));
    return b64url(b).slice(0, len);
  }
  async function startRedirectLogin() {
    const verifier = b64url(crypto.getRandomValues(new Uint8Array(48)));
    const state = randomState(24);
    try {
      sessionStorage.setItem(VERIFIER_KEY, verifier);
      sessionStorage.setItem(STATE_KEY, state);
    } catch (e) {}
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
    const u = new URL(AUTH_BASE + "/authorize");
    u.searchParams.set("client_id", CFG.MS_CLIENT_ID);
    u.searchParams.set("response_type", "code");
    u.searchParams.set("redirect_uri", redirectUri());
    u.searchParams.set("scope", SCOPES);
    u.searchParams.set("code_challenge", b64url(digest));
    u.searchParams.set("code_challenge_method", "S256");
    u.searchParams.set("state", state);
    u.searchParams.set("prompt", "select_account");
    window.location.assign(u.toString());
  }
  async function consumeRedirectCode() {
    const q = new URLSearchParams(window.location.search);
    const code = q.get("code");
    const err = q.get("error");
    const state = q.get("state");
    if (!code && !err) return null;
    // 清理 URL 敏感参数
    const clean = new URLSearchParams(window.location.search);
    clean.delete("code");
    clean.delete("state");
    clean.delete("session_state");
    clean.delete("error");
    clean.delete("error_description");
    history.replaceState(
      null,
      "",
      window.location.pathname + (clean.toString() ? "?" + clean.toString() : "") + window.location.hash
    );
    if (err)
      return {
        error:
          err + (q.get("error_description") ? "：" + String(q.get("error_description")).slice(0, 160) : ""),
      };
    if (!code) return null;
    // 校验 state
    let expected = null;
    try {
      expected = sessionStorage.getItem(STATE_KEY);
    } catch (e) {}
    if (expected && state !== expected) return { error: "登录校验失败（state 不匹配），请重新登录" };
    const verifier = (() => {
      try {
        return sessionStorage.getItem(VERIFIER_KEY);
      } catch (e) {
        return null;
      }
    })();
    if (!verifier) return { error: "授权校验信息丢失，请重新登录" };
    const body = new URLSearchParams({
      client_id: CFG.MS_CLIENT_ID,
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri(),
      code_verifier: verifier,
      scope: SCOPES,
    });
    const r = await fetch(AUTH_BASE + "/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok || !data.access_token)
      return { error: "令牌交换失败：" + (data.error_description || data.error || r.status) };
    storeToken(data.access_token, Number(data.expires_in || 3600));
    try {
      sessionStorage.removeItem(VERIFIER_KEY);
      sessionStorage.removeItem(STATE_KEY);
    } catch (e) {}
    return { ok: true };
  }

  async function api(path, options = {}) {
    const token = getStoredToken();
    if (!token) throw new Error("Outlook 登录已过期，请重新登录");
    const resp = await fetch(GRAPH + "/" + path, {
      ...options,
      headers: {
        Authorization: "Bearer " + token,
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
    });
    if (resp.status === 401) {
      clearToken();
      // 通知 UI 层给出「重新登录」入口（app-init.js 注入），再抛错由调用方提示
      if (typeof window.MyMailNotifyAuthExpired === "function") {
        try {
          window.MyMailNotifyAuthExpired("outlook");
        } catch (e) {}
      }
      throw new Error("Outlook 登录已过期，请重新登录");
    }
    if (!resp.ok && resp.status !== 202) {
      let msg = "Graph 接口返回 " + resp.status;
      try {
        const j = await resp.json();
        if (j.error && j.error.message) msg += "：" + j.error.message;
      } catch (e) {}
      throw new Error(msg);
    }
    return resp.status === 202 || resp.status === 204 ? {} : resp.json();
  }

  /* ---------- 解析 ---------- */
  const SELECT =
    "id,subject,bodyPreview,receivedDateTime,isRead,importance,flag,hasAttachments,from,toRecipients,parentFolderId";
  function fmtDate(iso) {
    const d = new Date(iso || Date.now());
    const pad = (n) => String(n).padStart(2, "0");
    return {
      ts: d.getTime(),
      date: `${d.getMonth() + 1}月${d.getDate()}日`,
      time: `${d.getMonth() + 1}月${d.getDate()}日 ${pad(d.getHours())}:${pad(d.getMinutes())}`,
    };
  }
  function toEmail(msg, folder, archived) {
    const f = fmtDate(msg.receivedDateTime);
    const fromEa = (msg.from && msg.from.emailAddress) || {};
    const toEa = (msg.toRecipients && msg.toRecipients[0] && msg.toRecipients[0].emailAddress) || {};
    return {
      id: msg.id,
      provider: "outlook",
      ts: f.ts,
      from: fromEa.name || fromEa.address || "(未知)",
      address: fromEa.address || "",
      to: toEa.name || toEa.address || "我",
      date: f.date,
      time: f.time,
      subject: msg.subject || "(无主题)",
      snippet: msg.bodyPreview || "",
      label: null,
      folder,
      archived: Boolean(archived),
      unread: !msg.isRead,
      starred: Boolean(msg.flag && msg.flag.flagStatus === "flagged"),
      important: msg.importance === "high",
      category: null,
      body: msg.bodyPreview ? [msg.bodyPreview] : ["(无正文)"],
      bodyZh: null,
      bodyLoaded: false,
      hasAttachments: Boolean(msg.hasAttachments),
      attachments: [],
    };
  }
  async function fetchFolder(wellKnown, folder, top, archived) {
    const data = await api(
      `mailFolders/${wellKnown}/messages?$top=${top}&$orderby=receivedDateTime desc&$select=${SELECT}`
    );
    return (data.value || []).map((m) => toEmail(m, folder, archived));
  }
  async function loadAll() {
    const profile = await api("");
    let total = null;
    try {
      const c = await api("messages?$count=true&$top=0", { headers: { ConsistencyLevel: "eventual" } });
      total = c["@odata.count"];
    } catch (e) {}
    const emails = [];
    const jobs = [
      ["inbox", "inbox", window.MyMailFetchCount || 40, false],
      ["sentitems", "sent", 20, false],
      ["drafts", "drafts", 20, false],
      ["junkemail", "spam", 20, false],
      ["deleteditems", "trash", 20, false],
      ["archive", "inbox", 20, true],
    ];
    for (const [wk, folder, top, arch] of jobs) {
      try {
        emails.push(...(await fetchFolder(wk, folder, top, arch)));
      } catch (e) {}
    }
    // 已标记（星标）可能不在上述文件夹里，单独补拉
    try {
      const data = await api(`messages?$filter=flag/flagStatus eq 'flagged'&$top=30&$select=${SELECT}`);
      const seen = new Set(emails.map((m) => m.id));
      for (const m of data.value || []) if (!seen.has(m.id)) emails.push(toEmail(m, "inbox", true));
    } catch (e) {}
    return {
      profile: { emailAddress: profile.mail || profile.userPrincipalName || "", messagesTotal: total },
      emails,
    };
  }
  async function fetchFull(id) {
    const msg = await api(`messages/${id}?$select=body`);
    let body = ["(无正文)"];
    let bodyHtml = null;
    if (msg.body && msg.body.content) {
      if (msg.body.contentType === "html") {
        bodyHtml = msg.body.content;
        // DOMParser 替代 innerHTML：独立文档，不触发资源加载/脚本执行语义，且可单测
        const text = parseHtmlToText(msg.body.content);
        body = text
          .split(/\n{2,}/)
          .map((p) => p.trim())
          .filter(Boolean);
        if (!body.length) body = [text.trim() || "(无正文)"];
      } else
        body = msg.body.content
          .split(/\n{2,}/)
          .map((p) => p.trim())
          .filter(Boolean);
    }
    let attachments = [];
    try {
      const data = await api(`messages/${id}/attachments?$select=id,name,contentType,size`);
      attachments = (data.value || []).map((a) => ({
        filename: a.name,
        mimeType: a.contentType,
        size: a.size || 0,
        attachmentId: a.id,
      }));
    } catch (e) {}
    return { body: body.length ? body : ["(无正文)"], bodyHtml, attachments };
  }
  // 支持抄送/密送：逗号或分号分隔的地址列表，跳过空项
  function toRecipients(list) {
    return String(list || "")
      .split(/[,;]/)
      .map((s) => s.trim())
      .filter(Boolean)
      .map((address) => ({ emailAddress: { address } }));
  }
  async function send({ to, cc, bcc, subject, body }) {
    const message = {
      subject: subject || "",
      body: { contentType: "Text", content: body || "" },
      toRecipients: toRecipients(to),
    };
    const ccList = toRecipients(cc);
    const bccList = toRecipients(bcc);
    if (ccList.length) message.ccRecipients = ccList;
    if (bccList.length) message.bccRecipients = bccList;
    await api("sendMail", {
      method: "POST",
      body: JSON.stringify({ message, saveToSentItems: true }),
    });
    return {};
  }
  // 修复：OData $search 需要将整个搜索表达式 URL 编码，而不是只编码关键词后包引号
  async function searchAll(q) {
    const phrase = String(q || "").replace(/"/g, "");
    if (!phrase.trim()) return [];
    const encoded = encodeURIComponent('"' + phrase + '"');
    const data = await api(`messages?$search=${encoded}&$top=30&$select=${SELECT}`, {
      headers: { ConsistencyLevel: "eventual" },
    });
    return (data.value || []).map((m) => toEmail(m, "inbox", false));
  }
  async function downloadAttachment(messageId, attachmentId) {
    const token = getStoredToken();
    const resp = await fetch(`${GRAPH}/messages/${messageId}/attachments/${attachmentId}/$value`, {
      headers: { Authorization: "Bearer " + token },
    });
    if (!resp.ok) throw new Error("附件下载返回 " + resp.status);
    const buf = await resp.arrayBuffer();
    let bin = "";
    const bytes = new Uint8Array(buf);
    for (let i = 0; i < bytes.length; i += 0x8000)
      bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(bin);
  }

  window.MyMailOutlook = {
    configured,
    startRedirectLogin,
    consumeRedirectCode,
    getStoredToken,
    clearToken,
    loadAll,
    fetchFull,
    send,
    searchAll,
    downloadAttachment,
  };
})();
