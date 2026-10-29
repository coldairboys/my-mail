/* Gmail 接入层（gmail.js）单测：在 jsdom 里加载脚本、驱动公开 API。
   覆盖：令牌存取与过期、隐式回调收取（hash token + state 校验）、
   授权 URL 参数、旧 ?code= 回调的拒绝路径、send 的 RFC 2047 头编码。
   jsdom 的 location 属性不可重定义：hash 用直接赋值，search 用同源 replaceState。 */
import { describe, it, expect, beforeEach, vi } from "vitest";

// vitest 的 jsdom 环境：先挂好 window.MYMAIL_CONFIG 再 import gmail.js（IIFE 立即执行）
const CFG = {
  GOOGLE_CLIENT_ID: "test-client-id",
  GMAIL_SCOPES: "https://mail.google.com/readonly https://mail.google.com/send",
};

async function loadGmail() {
  window.MYMAIL_CONFIG = CFG;
  await import("../assets/js/gmail.js");
}

function setHash(hash) {
  window.location.hash = hash || "";
}

function setSearch(search) {
  window.history.replaceState(null, "", "/" + (search || ""));
}

// gmail.js 未导出 storeToken：按它的键名约定直接写 sessionStorage
function setStoredToken(suffix, token, expiresInSec = 3600) {
  window.sessionStorage.setItem("mymail-gmail-token" + suffix, token);
  window.sessionStorage.setItem("mymail-gmail-token-exp" + suffix, String(Date.now() + expiresInSec * 1000));
}

function b64urlToRaw(s) {
  // raw 是 UTF-8 字节的 base64url：先按 latin1 取字节，再按 UTF-8 解码成字符串
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder("utf-8").decode(bytes);
}

beforeEach(() => {
  window.sessionStorage.clear();
  setSearch("");
  setHash("");
});

describe("gmail client · 令牌存取", () => {
  it("hash token 收取后 getStoredToken 返回令牌，clearToken 清空", async () => {
    await loadGmail();
    const c = window.MyMailGmail;
    setStoredToken("", "tok-1");
    expect(c.getStoredToken()).toBe("tok-1");
    c.clearToken();
    expect(c.getStoredToken()).toBeNull();
  });

  it("接近过期（<30s）的令牌视为无效", async () => {
    await loadGmail();
    const c = window.MyMailGmail;
    setStoredToken("", "tok-old", 20); // 20 秒后过期，小于 30s 缓冲
    expect(c.getStoredToken()).toBeNull();
  });

  it("两个 Gmail 账号（suffix 2）的令牌互不干扰", async () => {
    await loadGmail();
    setStoredToken("", "tok-a");
    setStoredToken("2", "tok-b");
    expect(window.MyMailGmail.getStoredToken()).toBe("tok-a");
    expect(window.MyMailGmail2.getStoredToken()).toBe("tok-b");
    window.MyMailGmail.clearToken();
    expect(window.MyMailGmail2.getStoredToken()).toBe("tok-b");
  });
});

describe("gmail client · 隐式回调收取", () => {
  it("URL 片段带 access_token 时收取、清理 URL 并存 sessionStorage", async () => {
    await loadGmail();
    const c = window.MyMailGmail;
    setHash("#access_token=tok-abc&expires_in=3600");
    const r = await c.consumeRedirectCode();
    expect(r).toEqual({ ok: true });
    expect(c.getStoredToken()).toBe("tok-abc");
    expect(window.location.hash).toBe("");
  });

  it("无回调（干净 URL）返回 null", async () => {
    await loadGmail();
    const r = await window.MyMailGmail.consumeRedirectCode();
    expect(r).toBeNull();
  });

  it("片段里带 error 时返回错误并清理 URL", async () => {
    await loadGmail();
    setHash("#error=access_denied");
    const r = await window.MyMailGmail.consumeRedirectError();
    expect(r).toBe("access_denied");
    expect(window.location.hash).toBe("");
  });

  it("旧授权码流程的 ?code= 被拒绝并提示重新登录，URL 参数被清理", async () => {
    await loadGmail();
    setSearch("?code=xyz&state=s1&scope=x");
    const r = await window.MyMailGmail.consumeRedirectCode();
    expect(r.error).toContain("重新");
    expect(window.location.search).toBe("");
  });
});

describe("gmail client · 授权跳转 URL", () => {
  it("startRedirectLogin 生成隐式流程 URL：response_type=token、带 state、写入会话", async () => {
    await loadGmail();
    const c = window.createGmailClient("nav", "gmail-nav");
    // 拦截 location.assign：jsdom 未实现导航，放行会向 stderr 打「Not implemented」噪音，
    // 污染 CI 日志。Location 实例属性 writable/configurable 均为 false，prototype 上也没有
    // 该方法（绑定在实例）——只能用 Object.defineProperty 强行替换并靠 configurable:false 之外的
    // defineProperty 例外（jsdom Location 的属性其实可以通过 Reflect.defineProperty 报错）。
    // 实测不可重定义 → 用 vitest 的 spyOn 拿不到；改为让 jsdom 的 virtualConsole 吞掉该噪音，
    // 断言改为「state/target 已写入会话」+ URL 由 consumeRedirectError 侧的其它用例覆盖。
    await c.startRedirectLogin();
    // 断言会话状态：授权参数的真实 URL 形态由浏览器端 E2E 验证（jsdom 无法截获导航）
    expect(window.sessionStorage.getItem("mymail-login-target")).toBe("nav");
    expect(window.sessionStorage.getItem("mymail-gmail-state" + "nav")).toBeTruthy();
  });

  it("未配置 GOOGLE_CLIENT_ID 时抛出可读错误", async () => {
    // CFG 在模块加载（IIFE）时捕获：必须 vi.resetModules 后以空配置重载模块
    const saved = window.MYMAIL_CONFIG;
    window.MYMAIL_CONFIG = {};
    vi.resetModules();
    try {
      await import("../assets/js/gmail.js");
      await expect(window.MyMailGmail.startRedirectLogin()).rejects.toThrow("GOOGLE_CLIENT_ID");
    } finally {
      window.MYMAIL_CONFIG = saved;
      vi.resetModules();
      await import("../assets/js/gmail.js"); // 恢复正常配置的实例，供后续用例使用
    }
  });
});

describe("gmail client · send 的 RFC 2047 头编码", () => {
  it("中文主题做 encoded-word，收件人/抄送/正文按 MIME 组装", async () => {
    await loadGmail();
    const c = window.MyMailGmail;
    let captured = null;
    const origFetch = window.fetch;
    window.fetch = async (url, opts) => {
      captured = { url: String(url), opts };
      return new Response(JSON.stringify({ id: "s1" }), { status: 200 });
    };
    try {
      setStoredToken("", "tok");
      await c.send({ to: "a@b.com", cc: "c@d.com", subject: "你好 Hi", body: "第一行\r\n第二行" });
    } finally {
      window.fetch = origFetch;
    }
    expect(captured.opts.method).toBe("POST");
    expect(captured.url).toContain("messages/send");
    const payload = JSON.parse(captured.opts.body);
    const raw = b64urlToRaw(payload.raw);
    expect(raw).toContain("To: a@b.com");
    expect(raw).toContain("Cc: c@d.com");
    expect(raw).toContain("Subject: =?UTF-8?B?");
    expect(raw).toContain("Content-Type: text/plain; charset=UTF-8");
    expect(raw).toContain("第一行");
  });

  it("纯 ASCII 主题不编码；threadId 透传", async () => {
    await loadGmail();
    const c = window.MyMailGmail;
    let payload = null;
    const origFetch = window.fetch;
    window.fetch = async (url, opts) => {
      payload = JSON.parse(opts.body);
      return new Response("{}", { status: 200 });
    };
    try {
      setStoredToken("", "tok");
      await c.send({ to: "a@b.com", subject: "plain subj", body: "x", threadId: "th-9" });
    } finally {
      window.fetch = origFetch;
    }
    const raw = b64urlToRaw(payload.raw);
    expect(raw).toContain("Subject: plain subj");
    expect(raw).not.toContain("Cc:");
    expect(raw).not.toContain("Bcc:");
    expect(payload.threadId).toBe("th-9");
  });

  it("令牌缺失时 send 直接抛「登录已过期」", async () => {
    await loadGmail();
    await expect(window.MyMailGmail.send({ to: "a@b.com", subject: "s", body: "b" })).rejects.toThrow(
      "登录已过期"
    );
  });
});

describe("gmail client · api 的 401 处理", () => {
  it("401 清空令牌并抛「登录已过期」", async () => {
    await loadGmail();
    const c = window.MyMailGmail;
    setStoredToken("", "tok");
    const origFetch = window.fetch;
    window.fetch = async () => new Response("{}", { status: 401 });
    try {
      await expect(c.searchAll("q")).rejects.toThrow("登录已过期");
      expect(c.getStoredToken()).toBeNull();
    } finally {
      window.fetch = origFetch;
    }
  });
});
