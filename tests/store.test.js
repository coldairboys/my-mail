import { describe, it, expect, vi, beforeEach } from "vitest";

const KEY = "mymail-state-v2";

// store.js 在 import 时读 localStorage,所以每个用例都重置模块后再动态导入
async function freshStore() {
  vi.resetModules();
  return import("../assets/js/store.js");
}

describe("store 持久化", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("无存储时用默认值 + 新版种子邮件", async () => {
    const { state, SEED_VERSION } = await freshStore();
    expect(state.themeMode).toBe("auto");
    expect(state.autoRefreshSec).toBe(0);
    expect(state.translateNoticeShown).toBe(false);
    expect(state.seedVersion).toBe(SEED_VERSION);
    expect(state.emails.length).toBeGreaterThan(0);
  });

  it("合并已存偏好:用户数据保留,缺失项由 DEFAULTS 补齐", async () => {
    localStorage.setItem(KEY, JSON.stringify({ emails: [{ id: "x" }], themeMode: "dark", seedVersion: 99 }));
    const { state } = await freshStore();
    expect(state.themeMode).toBe("dark");
    expect(state.emails).toHaveLength(1); // seedVersion 已是最新,不动用户邮件
    expect(state.fetchCount).toBe(40);
  });

  it("旧种子数据升级为新版演示邮件,但偏好保留", async () => {
    localStorage.setItem(
      KEY,
      JSON.stringify({ emails: [{ id: "old-mail" }], seedVersion: 1, themeMode: "dark" })
    );
    const { state, SEED_VERSION } = await freshStore();
    expect(state.seedVersion).toBe(SEED_VERSION);
    expect(state.emails.some((m) => m.id === "old-mail")).toBe(false);
    expect(state.emails.length).toBeGreaterThan(1);
    expect(state.themeMode).toBe("dark");
  });

  it("损坏的存储不抛错,回退到默认值", async () => {
    localStorage.setItem(KEY, "{not-json");
    const { state } = await freshStore();
    expect(state.themeMode).toBe("auto");
    expect(state.emails.length).toBeGreaterThan(0);
  });

  it("src() 按视图返回对应邮箱,unified 聚合所有在线账号", async () => {
    const { state, accounts, ui, src } = await freshStore();
    ui.view = "demo";
    expect(src()).toBe(state.emails);
    const g = accounts.get("gmail");
    g.on = true;
    g.emails = [{ id: "g1" }];
    ui.view = "gmail";
    expect(src()[0].id).toBe("g1");
    ui.view = "unified";
    expect(src()[0].id).toBe("g1");
  });

  it("svcOf 按账号映射服务,未知账号回落 Gmail 客户端", async () => {
    const { svcOf } = await freshStore();
    window.MyMailGmail = { tag: "gmail" };
    window.MyMailGmail2 = { tag: "gmail2" };
    window.MyMailOutlook = { tag: "outlook" };
    expect(svcOf("gmail2").tag).toBe("gmail2");
    expect(svcOf("outlook").tag).toBe("outlook");
    expect(svcOf("gmail").tag).toBe("gmail");
    expect(svcOf("unknown").tag).toBe("gmail");
  });
});
