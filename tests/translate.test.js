import { describe, it, expect } from "vitest";
import { splitSegments } from "../assets/js/translate.js";

describe("splitSegments", () => {
  it("短段落原样返回单块", () => {
    expect(splitSegments("你好，世界")).toEqual(["你好，世界"]);
  });
  it("空值返回单块空串", () => {
    expect(splitSegments("")).toEqual([""]);
  });
  it("超长段落按句读切块且每块 ≤480 字", () => {
    const para = Array.from({ length: 80 }, (_, i) => `这是第${i}句话，用来撑长度。`).join("");
    const segs = splitSegments(para);
    expect(segs.length).toBeGreaterThan(1);
    expect(segs.every((s) => s.length <= 480)).toBe(true);
    expect(segs.join("")).toBe(para); // 切块不丢字
  });
  it("无句读的超长文本硬切不丢字", () => {
    const para = "A".repeat(1200);
    const segs = splitSegments(para);
    expect(segs.every((s) => s.length <= 480)).toBe(true);
    expect(segs.join("")).toBe(para);
  });
});

describe("translateParagraphs 容错与缓存", () => {
  it("接口失败时回退到原文，不崩溃", async () => {
    const { translateParagraphs } = await import("../assets/js/translate.js");
    // globalThis.fetch mock 抛错
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => {
      throw new Error("Network offline");
    };
    try {
      const res = await translateParagraphs(["Hello world", "Good morning"], "zh-CN");
      expect(res).toEqual(["Hello world", "Good morning"]);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
