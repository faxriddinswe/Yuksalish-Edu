import { describe, it, expect } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { afterEach } from "vitest";
import { phoneSchema, leadSchema } from "@/lib/validation";
import { sumAmounts } from "@/features/billing/payment-form";
import { Status } from "@/components/ui";
import { accessibleSection } from "@/components/layout/dashboard-shell";
import { money, dateTime } from "@/lib/formatting";
import type { User } from "@/types";
afterEach(cleanup);
describe("Pul va formatlar", () => {
  it("Kasrli summalarni aniq qo‘shadi", () => {
    expect(sumAmounts(["0.10", "0.20", "300000"])).toBe("300000.30");
  });
  it("Bo‘sh summalarni nol deb yig‘adi", () => {
    expect(sumAmounts(["", "0"])).toBe("0.00");
  });
  it("Belgilanmagan hisobni nol demaydi", () => {
    expect(money(null)).toBe("Belgilanmagan");
  });
  it("Toshkent sanasini ishlatadi", () => {
    expect(dateTime("2026-10-09T20:00:00Z")).toBe("10.10.2026, 01:00");
    expect(dateTime("2026-10-09")).toBe("09.10.2026");
  });
  it("Pulni brauzerning o‘zbek lokali mavjudligidan mustaqil formatlaydi", () => {
    expect(money("300000.00")).toBe("300 000 so‘m");
    expect(money("300000.25")).toBe("300 000,25 so‘m");
  });
});
describe("Forma validatsiyasi", () => {
  it("O‘zbek raqamini qabul qiladi", () => {
    expect(phoneSchema.safeParse("+998 90 123 45 67").success).toBe(true);
  });
  it("Noto‘g‘ri telefonni rad etadi", () => {
    expect(phoneSchema.safeParse("123").success).toBe(false);
    expect(phoneSchema.safeParse("+123456789").success).toBe(false);
  });
  it("Roziliksiz murojaatni rad etadi", () => {
    expect(
      leadSchema.safeParse({
        full_name: "Test",
        phone: "901234567",
        course: "",
        comment: "",
        consent: false,
        website: "",
      }).success,
    ).toBe(false);
  });
});
describe("Rol navigatsiyasi", () => {
  const user = (roles: string[], extra_permissions: string[] = []): User => ({
    id: 1,
    phone: "+998901234567",
    full_name: "Test",
    roles,
    extra_permissions,
    is_active: true,
  });
  it("Administrator moliyaviy hisobotni ko‘rmaydi", () =>
    expect(accessibleSection(user(["ADMINISTRATOR"]), "reports")).toBe(false));
  it("Aniq vakolat to‘lov kiritishni ochadi", () =>
    expect(
      accessibleSection(
        user(["ADMINISTRATOR"], ["billing.record_payment"]),
        "record-payment",
      ),
    ).toBe(true));
  it("Aralash rollar vakolatlari birlashadi", () =>
    expect(accessibleSection(user(["PARENT", "ACCOUNTANT"]), "reports")).toBe(
      true,
    ));
  it("O‘quvchiga audit ochilmaydi", () =>
    expect(accessibleSection(user(["STUDENT"]), "audit")).toBe(false));
});
it("Holat faqat rang orqali berilmaydi", () => {
  render(<Status value="OVERDUE" />);
  expect(screen.getByText("Muddati o‘tgan")).toBeVisible();
});
