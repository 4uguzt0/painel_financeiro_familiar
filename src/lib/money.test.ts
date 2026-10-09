import { describe, expect, it } from "vitest";
import { formatBRL, maskFromDigits, parseBRL } from "./money";

describe("parseBRL", () => {
  it.each([
    ["57", 5700],
    ["57,9", 5790],
    ["57,90", 5790],
    ["1.234,56", 123456],
    ["R$ 1.234,56", 123456],
    ["1234.5", 123450],
    ["1.234", 123400],
    ["0,01", 1],
  ])("%s -> %i centavos", (input, cents) => {
    expect(parseBRL(input)).toBe(cents);
  });

  it.each(["", "abc", "1,234,5", "12,345", "-5"])("rejeita %j", (input) => {
    expect(parseBRL(input)).toBeNull();
  });
});

describe("formatBRL", () => {
  it("formata centavos em reais", () => {
    expect(formatBRL(123456)).toBe("R$ 1.234,56");
    expect(formatBRL(0)).toBe("R$ 0,00");
    expect(formatBRL(-5000)).toBe("-R$ 50,00");
  });
});

describe("maskFromDigits", () => {
  it("preenche da direita como app de banco", () => {
    expect(maskFromDigits("5")).toEqual({ text: "0,05", cents: 5 });
    expect(maskFromDigits("5790")).toEqual({ text: "57,90", cents: 5790 });
    expect(maskFromDigits("R$ 1.234,56")).toEqual({ text: "1.234,56", cents: 123456 });
    expect(maskFromDigits("")).toEqual({ text: "", cents: 0 });
  });
});
