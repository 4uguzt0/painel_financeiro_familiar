import { describe, expect, it } from "vitest";
import { dayHeading, formatDateBR, monthLabel, monthRange, shiftMonth, todayISO } from "./dates";

describe("datas", () => {
  it("usa o fuso de Brasília (23h de Brasília ainda é o mesmo dia)", () => {
    // 2026-10-10 01:30 UTC = 2026-10-09 22:30 em Brasília
    expect(todayISO(new Date("2026-10-10T01:30:00Z"))).toBe("2026-10-09");
  });
  it("navega meses atravessando o ano", () => {
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(monthRange("2026-12")).toEqual({ start: "2026-12-01", end: "2027-01-01" });
  });
  it("formata em pt-BR", () => {
    expect(monthLabel("2026-10")).toBe("outubro de 2026");
    expect(formatDateBR("2026-10-09")).toBe("09/10/2026");
    expect(dayHeading("2026-10-09", "2026-10-09")).toBe("Hoje");
    expect(dayHeading("2026-10-08", "2026-10-09")).toBe("Ontem");
    expect(dayHeading("2026-10-06", "2026-10-09")).toBe("terça, 06/10");
  });
});
