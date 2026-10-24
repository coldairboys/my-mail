/* My Mail · Gmail 接入层（v4.1 · 隐式流程 + 列表懒加载）
   安全模型：
   - 登录走 OAuth 2.0 隐式流程（response_type=token），密码只在 Google 官方页面输入
   - 本文件只用 Client ID（公开标识），不需要、也不能使用 client_secret：
     Google 对「Web 应用」类型客户端在授权码换令牌时强制要求 client_secret，
     纯静态网页无法安全持有密钥，故授权码 + PKCE 流程在本项目不可用（v4 曾误用，已改回）
   - 流程：生成 state → 跳转 Google 授权 → 回调 URL 片段带 #access_token → 前端收取并立即清理 URL
   - access_token 只存 sessionStorage（关标签页即失效，约 1 小时），不写 localStorage、不上传任何服务器
   - 邮件数据只在浏览器内存里，页面关掉即消失
   - 权限范围：gmail.readonly（只读）+ gmail.send（发送）
   性能模型（v4.1）：
   - 列表只拉 format=metadata（头部 + 摘要 + 标签），点开邮件才 format=full 补正文，
     首屏 API 调用从「列表数 × 每页封数」降到「列表数 + 点开的几封」
   - 六个文件夹列表并发拉取（此前串行排队） */
import { bytesToB64url } from "./utils.js";
import { toEmail, bodyParagraphs, htmlPart, collectParts } from "./mail-parse.js";
import { translateParagraphs } from "./translate.js";

(function () {
  "use strict";
  const CFG = window.MYMAIL_CONFIG || {};

  function createGmailClient(suffix, providerName) {
    const TOKEN_KEY = "mymail-gmail-token" + suffix;
    const EXP_KEY = "mymail-gmail-token-exp" + suffix;
    const VERIFIER_KEY = "mymail-gmail-verifier" + suffix;
    const STATE_KEY = "mymail-gmail-state" + suffix;

    const configured = () => Boolean(CFG.GOOGLE_CLIENT_ID);

    // ---------- Token 存取 ----------
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
      try {
        sessionStorage.removeItem(TOKEN_KEY);
        sessionStorage.removeItem(EXP_KEY);
        sessionStorage.removeItem(VERIFIER_KEY);
        sessionStorage.removeItem(STATE_KEY);
        sessionStorage.removeItem("mymail-login-target");
      } catch (e) {}
    }

    // ---------- PKCE helpers ----------

    function redirectUri() {
      return window.location.origin + window.location.pathname;
    }

    // 隐式流程的令牌收取：URL 片段带 #access_token= 时收取并立即清理
    function consumeLegacyHashToken() {
      if (!window.location.hash || !window.location.hash.includes("access_token=")) return false;
      try {
        const p = new URLSearchParams(window.location.hash.slice(1));
        const token = p.get("access_token");
        if (token) {
          storeToken(token, Number(p.get("expires_in") || 3600));
          history.replaceState(null, "", window.location.pathname + window.location.search);
          return true;
        }
        history.replaceState(null, "", window.location.pathname + window.location.search);
      } catch (e) {}
      return false;
    }

    // ---------- 发起授权（隐式流程） ----------
    async function startRedirectLogin() {
      if (!configured()) throw new Error("尚未配置 GOOGLE_CLIENT_ID（见 README 的接入步骤）");
      // 隐式流程仅需随机 state 防 CSRF
      const state = bytesToB64url(crypto.getRandomValues(new Uint8Array(24))).slice(0, 24);
      try {
        sessionStorage.setItem(STATE_KEY, state);
        sessionStorage.setItem("mymail-login-target", suffix);
      } catch (e) {}
      const u = new URL("https://accounts.google.com/o/oauth2/v2/auth");
      u.searchParams.set("client_id", CFG.GOOGLE_CLIENT_ID);
      u.searchParams.set("redirect_uri", redirectUri());
      u.searchParams.set("response_type", "token");
      u.searchParams.set("scope", CFG.GMAIL_SCOPES);
      u.searchParams.set("state", state);
      u.searchParams.set("include_granted_scopes", "true");
      u.searchParams.set("prompt", "select_account");
      window.location.assign(u.toString());
    }

    // 兼容旧版 implicit 流程残留的 hash token：返回是否收到（新流程回调走 consumeRedirectCode）
    function consumeRedirectToken() {
      return consumeLegacyHashToken();
    }

    function consumeRedirectError() {
      const q = new URLSearchParams(window.location.search);
      const qsError = q.get("error");
      if (qsError) {
        // 清理 URL 上的 error 参数，避免刷新重复提示
        q.delete("error");
        q.delete("error_description");
        q.delete("error_uri");
        q.delete("state");
        const clean =
          window.location.pathname + (q.toString() ? "?" + q.toString() : "") + window.location.hash;
        history.replaceState(null, "", clean);
        return (
          qsError +
          (q.get("error_description") ? "：" + String(q.get("error_description")).slice(0, 160) : "")
        );
      }
      if (window.location.hash && window.location.hash.includes("error=")) {
        const p = new URLSearchParams(window.location.hash.slice(1));
        const err = p.get("error");
        if (err) {
          history.replaceState(null, "", window.location.pathname + window.location.search);
          return err;
        }
      }
      return null;
    }

    // 消费回调中的 ?code=，校验 state 后用 verifier 换取 token；返回 { ok, error } 或 null（无回调）
    async function consumeRedirectCode() {
      // 隐式流程：令牌经 URL 片段返回
      if (window.location.hash && window.location.hash.includes("access_token=")) {
        const ok = consumeLegacyHashToken();
        return ok ? { ok: true } : null;
      }
      const q = new URLSearchParams(window.location.search);
      const code = q.get("code");
      const err = q.get("error");
      // state parameter cleaned below
      if (!code && !err) return null;
      // 无论成功失败，先清理 URL 上的敏感参数，避免 code/state 进历史
      const cleanParams = new URLSearchParams(window.location.search);
      cleanParams.delete("code");
      cleanParams.delete("state");
      cleanParams.delete("scope");
      cleanParams.delete("error");
      cleanParams.delete("error_description");
      const cleanUrl =
        window.location.pathname +
        (cleanParams.toString() ? "?" + cleanParams.toString() : "") +
        window.location.hash;
      history.replaceState(null, "", cleanUrl);

      if (err)
        return {
          error:
            err + (q.get("error_description") ? "：" + String(q.get("error_description")).slice(0, 160) : ""),
        };
      if (!code) return null;

      // 走到这里说明回跳带的是旧版授权码流程的 ?code=：该流程已停用
      // （Google 对 Web 应用客户端换令牌强制要求 client_secret，静态网页无法使用）。
      // URL 上的 code/state 已在上方清理，这里只提示重新登录——新登录走隐式流程。
      try {
        sessionStorage.removeItem(VERIFIER_KEY);
        sessionStorage.removeItem(STATE_KEY);
      } catch (e) {}
      return { error: "登录方式已更新，请重新点击登录" };
    }

    async function api(path, options = {}) {
      let token = getStoredToken();
      if (!token) throw new Error("登录已过期，请重新登录");
      const resp = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/" + path, {
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
            window.MyMailNotifyAuthExpired(providerName);
          } catch (e) {}
        }
        throw new Error("登录已过期，请重新登录");
      }
      if (!resp.ok) {
        let msg = "Gmail 接口返回 " + resp.status;
        try {
          const j = await resp.json();
          if (j.error && j.error.message) msg += "：" + j.error.message;
        } catch (e) {}
        throw new Error(msg);
      }
      return resp.status === 204 ? {} : resp.json();
    }

    /* ---------- 邮件列表（metadata：头部 + 摘要 + 标签） ---------- */
    const METADATA_QS =
      "format=metadata" +
      ["From", "To", "Subject", "List-Unsubscribe"].map((n) => "&metadataHeaders=" + n).join("");

    async function fetchList(params) {
      const qs = new URLSearchParams(params).toString();
      const data = await api("messages?" + qs);
      const ids = (data.messages || []).map((m) => m.id);
      // 并发拉取（6 路队列，避免 cursor 竞态）：用索引队列 worker 消费
      const msgs = [];
      const queue = ids.slice();
      async function worker() {
        while (queue.length) {
          const id = queue.shift();
          try {
            msgs.push(await api("messages/" + id + "?" + METADATA_QS));
          } catch (e) {}
        }
      }
      await Promise.all(Array.from({ length: Math.min(6, queue.length || 0) }, worker));
      return msgs;
    }

    async function loadAll() {
      const profile = await api("profile");
      const byIdMap = new Map();
      const jobs = [
        { labelIds: "INBOX", maxResults: String(window.MyMailFetchCount || 40) },
        { labelIds: "SENT", maxResults: "20" },
        { labelIds: "DRAFT", maxResults: "20" },
        { labelIds: "SPAM", maxResults: "20" },
        { labelIds: "TRASH", maxResults: "20" },
        { labelIds: "STARRED", maxResults: "40" },
      ];
      // 六个文件夹并发拉取；单个列表失败不再拖垮整个登录
      const results = await Promise.all(jobs.map((job) => fetchList(job).catch(() => [])));
      for (const msgs of results) {
        for (const raw of msgs) {
          const em = toEmail(raw, undefined, providerName);
          if (byIdMap.has(em.id)) {
            const prev = byIdMap.get(em.id);
            prev.starred = prev.starred || em.starred;
          } else byIdMap.set(em.id, em);
        }
      }
      return { profile, emails: [...byIdMap.values()] };
    }

    // 点开列表邮件时补全正文 / 附件（列表只拉了 metadata，bodyLoaded=false）
    async function fetchFull(id) {
      const msg = await api("messages/" + id + "?format=full");
      const atts = [];
      collectParts(msg.payload, [], atts);
      return { body: bodyParagraphs(msg), bodyHtml: htmlPart(msg), attachments: atts };
    }

    function utf8ToB64Url(str) {
      return bytesToB64url(new TextEncoder().encode(str));
    }
    async function send({ to, cc, bcc, subject, body, threadId }) {
      // MIME 头里的非 ASCII（中文主题/地址）必须做 RFC 2047 encoded-word 编码，
      // 否则收件端看到的是乱码。纯 ASCII 直接放行，避免无谓编码。
      const encodeHeader = (value) => {
        const str = String(value || "");
        if (/^[\x20-\x7E]*$/.test(str)) return str;
        return "=?UTF-8?B?" + utf8ToB64Url(str) + "?=";
      };
      const headers = ["To: " + to];
      if (cc && String(cc).trim()) headers.push("Cc: " + String(cc).trim());
      if (bcc && String(bcc).trim()) headers.push("Bcc: " + String(bcc).trim());
      headers.push("Subject: " + encodeHeader(subject));
      headers.push("Content-Type: text/plain; charset=UTF-8");
      const raw = [...headers, "", body || ""].join("\r\n");
      const payload = { raw: utf8ToB64Url(raw) };
      if (threadId) payload.threadId = threadId;
      return api("messages/send", { method: "POST", body: JSON.stringify(payload) });
    }

    async function searchAll(q) {
      const msgs = await fetchList({ q, maxResults: "30" });
      return msgs.map((raw) => toEmail(raw, undefined, providerName));
    }
    async function downloadAttachment(messageId, attachmentId) {
      const r = await api("messages/" + messageId + "/attachments/" + attachmentId);
      return r.data || "";
    }

    return {
      configured,
      startRedirectLogin,
      consumeRedirectToken,
      consumeRedirectError,
      consumeRedirectCode,
      getStoredToken,
      clearToken,
      loadAll,
      fetchFull,
      send,
      // 翻译实现在共享模块 translate.js（Outlook 同用），这里保留同名入口
      translateParagraphs,
      searchAll,
      downloadAttachment,
      suffix,
      providerName,
    };
  }

  window.MyMailGmail = createGmailClient("", "gmail");
  window.MyMailGmail2 = createGmailClient("2", "gmail2");
  window.createGmailClient = createGmailClient;
})();
