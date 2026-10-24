import { describe, it, expect, vi } from "vitest";
import { esc, initialOf, colorOf, strHash, fmtSize, debounce, bytesToB64url } from "../assets/js/utils.js";

describe("esc", () => {
  it("转义 HTML 特殊字符", () => {
    expect(esc(`<img src=x onerror="a&'b'">`)).toBe(
      "&lt;img src=x onerror=&quot;a&amp;&#39;b&#39;&quot;&gt;"
    );
  });
  it("null / undefined 返回空串", () => {
    expect(esc(null)).toBe("");
    expect(esc(undefined)).toBe("");
  });
  it("数字照常转字符串", () => {
    expect(esc(42)).toBe("42");
  });
});

describe("initialOf", () => {
  it("取首字母并大写,空值回退问号", () => {
    expect(initialOf("alice")).toBe("A");
    expect(initialOf(" 张三 ")).toBe("张");
    expect(initialOf("")).toBe("?");
  });
});

describe("strHash / colorOf", () => {
  it("同一输入哈希稳定,不同输入大概率不同", () => {
    expect(strHash("alice@gmail.com")).toBe(strHash("alice@gmail.com"));
    expect(strHash("a")).not.toBe(strHash("b"));
  });
  it("colorOf 稳定且落在色板内", () => {
    const c = colorOf("bob@x.com");
    expect(c).toBe(colorOf("bob@x.com"));
    expect(c).toMatch(/^#[0-9a-f]{6}$/i);
  });
});

describe("bytesToB64url", () => {
  it("基础编码并去掉填充", () => {
    expect(bytesToB64url(new TextEncoder().encode("hello"))).toBe("aGVsbG8");
  });
  it("大数组分块转换结果与一次性编码一致(>32KB,验证不栈溢出)", () => {
    const bytes = new Uint8Array(40000).fill(65);
    const expected = btoa("A".repeat(40000)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    expect(bytesToB64url(bytes)).toBe(expected);
  });
});

describe("fmtSize", () => {
  it("B / KB / MB 分档", () => {
    expect(fmtSize(512)).toBe("512 B");
    expect(fmtSize(2048)).toBe("2 KB");
    expect(fmtSize(2097152)).toBe("2.0 MB");
  });
  it("0 与空值", () => {
    expect(fmtSize(0)).toBe("0 B");
  });
});

describe("debounce", () => {
  it("连续调用只执行最后一次", () => {
    vi.useFakeTimers();
    let n = 0;
    const d = debounce(() => n++, 100);
    d();
    d();
    d();
    vi.advanceTimersByTime(150);
    expect(n).toBe(1);
    vi.useRealTimers();
  });
  it("flush 立即执行", () => {
    let n = 0;
    const d = debounce(() => n++, 100);
    d();
    d.flush();
    expect(n).toBe(1);
  });
});
