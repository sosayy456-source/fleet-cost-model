/**
 * ตัวจับ error ของก้อนย่อยที่หายไปหลัง deploy ใหม่
 * ข้อความต่างกันตามเบราว์เซอร์ ถ้าจับไม่ครบผู้ใช้จะเจอจอ error แทนที่จะรีโหลดให้เอง
 */
import { describe, expect, it } from "vitest";
import { isStaleChunkError, stripCacheBustParam } from "./lazyPage";

describe("isStaleChunkError", () => {
  it("จับข้อความของทุกเบราว์เซอร์ได้", () => {
    const msgs = [
      // Chrome / Edge — อันที่เจอจริงบน GitHub Pages 23 ก.ย. 2569
      "Failed to fetch dynamically imported module: https://x.github.io/fleet-cost-model/assets/DemoDash-Bu-LG6Of.js",
      // Firefox
      "error loading dynamically imported module",
      // Safari
      "Importing a module script failed.",
      "Failed to load module script",
    ];
    for (const m of msgs) expect(isStaleChunkError(new Error(m))).toBe(true);
  });

  it("ไม่เหมาเอา error อื่นมาเป็นก้อนหาย", () => {
    // ถ้าจับกว้างไป บั๊กจริงจะถูกกลบด้วยการรีโหลดวนไปเรื่อย ๆ แทนที่จะโผล่ให้เห็น
    expect(isStaleChunkError(new Error("Cannot read properties of undefined"))).toBe(false);
    expect(isStaleChunkError(new Error("Failed to fetch"))).toBe(false);
    expect(isStaleChunkError(null)).toBe(false);
    expect(isStaleChunkError(undefined)).toBe(false);
  });
});

describe("stripCacheBustParam", () => {
  const BASE = "https://sosayy456-source.github.io";

  it("ลบเฉพาะ ?v= คงพารามิเตอร์อื่นไว้", () => {
    expect(stripCacheBustParam(`${BASE}/fleet-cost-model/?v=1758600000000&keep=1`))
      .toBe("/fleet-cost-model/?keep=1");
  });

  it("ลบแล้วไม่เหลือเครื่องหมายคำถามลอย ๆ", () => {
    expect(stripCacheBustParam(`${BASE}/fleet-cost-model/?v=1758600000000`))
      .toBe("/fleet-cost-model/");
  });

  it("คืน null เมื่อไม่มี ?v= จะได้ไม่ต้องแตะ history เปล่า ๆ", () => {
    expect(stripCacheBustParam(`${BASE}/fleet-cost-model/?keep=1`)).toBeNull();
    expect(stripCacheBustParam(`${BASE}/fleet-cost-model/`)).toBeNull();
  });
});
