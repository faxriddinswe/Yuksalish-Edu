import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { accessibleSection } from "@/components/layout/dashboard-shell";
import { isStudentCabinet } from "@/lib/auth/access";
import {
  PaymentBalance,
  paymentSummaryMessage,
  type PersonalPaymentSummary,
} from "@/features/billing/student-payments";
import type { User } from "@/types";

afterEach(cleanup);
const user = (roles: string[]): User => ({
  id: 1,
  phone: "+998901234567",
  full_name: "O‘quvchi",
  roles,
  extra_permissions: [],
  is_active: true,
});
const summary: PersonalPaymentSummary = {
  invoice_count: 2,
  pending_count: 0,
  balance: "0.00",
  overdue_balance: "0.00",
  upcoming_balance: "0.00",
  subjects: [],
};

describe("O‘quvchi kabineti", () => {
  it("To‘lovlar tarixini ochadi, hisoblar va o‘quvchilar ro‘yxatini yopadi", () => {
    const student = user(["STUDENT"]);
    expect(isStudentCabinet(student)).toBe(true);
    expect(accessibleSection(student, "payments")).toBe(true);
    expect(accessibleSection(student, "invoices")).toBe(false);
    expect(accessibleSection(student, "students")).toBe(false);
  });
  it.each(["OWNER_ADMIN", "ADMINISTRATOR", "ACCOUNTANT", "PARENT"])(
    "%s aralash rolida tegishli vakolatlar saqlanadi",
    (role) => {
      const mixed = user(["STUDENT", role]);
      expect(isStudentCabinet(mixed)).toBe(false);
      expect(accessibleSection(mixed, "invoices")).toBe(true);
      expect(accessibleSection(mixed, "students")).toBe(true);
    },
  );
  it("Belgilanmagan summani qarz yo‘q deb ko‘rsatmaydi", () => {
    render(<PaymentBalance data={{ ...summary, pending_count: 1 }} />);
    expect(screen.getByRole("heading")).toHaveTextContent(
      "To‘lov summasi belgilanishi kutilmoqda",
    );
    expect(screen.queryByText("Qarzdorlik yo‘q")).not.toBeInTheDocument();
  });
  it("Ma’lumotsiz va to‘langan holatlarni ajratadi", () => {
    expect(paymentSummaryMessage({ ...summary, invoice_count: 0 })).toBe(
      "To‘lov holati hali shakllanmagan",
    );
    expect(paymentSummaryMessage(summary)).toBe("Qarzdorlik yo‘q");
  });
  it("Muddati o‘tmagan qoldiqni muddati o‘tgan qarzdan ajratadi", () => {
    expect(
      paymentSummaryMessage({
        ...summary,
        balance: "200000",
        upcoming_balance: "200000",
      }),
    ).toBe("To‘lov kutilmoqda");
    render(
      <PaymentBalance
        data={{
          ...summary,
          balance: "200000",
          overdue_balance: "150000",
          upcoming_balance: "50000",
        }}
      />,
    );
    expect(screen.getByRole("heading")).toHaveTextContent(
      "Muddati o‘tgan qarzingiz bor",
    );
    expect(screen.getByText("200 000 so‘m")).toBeVisible();
    expect(screen.getByText("150 000 so‘m")).toBeVisible();
    expect(screen.getByText("50 000 so‘m")).toBeVisible();
  });
});
