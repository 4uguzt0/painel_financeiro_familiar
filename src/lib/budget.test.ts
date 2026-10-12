import { describe, expect, it } from "vitest";
import { budgetLevel, budgetMessage } from "./budget";

describe("orçamento", () => {
  it("classifica as faixas de alerta", () => {
    expect(budgetLevel(0.5)).toBe("ok");
    expect(budgetLevel(0.8)).toBe("warning");
    expect(budgetLevel(0.999)).toBe("warning");
    expect(budgetLevel(1)).toBe("over");
    expect(budgetLevel(1.4)).toBe("over");
  });

  it("monta a frase do aviso", () => {
    expect(budgetMessage("Mercado", 100000, 50000)).toBeNull();
    expect(budgetMessage("Mercado", 100000, 85000)).toBe("Mercado já usou 85% do orçamento. Restam R$ 150,00.");
    expect(budgetMessage("Lazer", 20000, 25000)).toBe("Lazer passou do orçamento em R$ 50,00.");
    expect(budgetMessage("Lazer", 20000, 20000)).toBe("Lazer: orçamento do mês usado por completo.");
  });
});
