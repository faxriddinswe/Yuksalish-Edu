import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { Providers } from "@/components/layout/providers";
import { accessibleSection } from "@/components/layout/dashboard-shell";
import { DashboardContent } from "@/features/dashboard";
import { PaymentForm } from "@/features/billing/payment-form";
import { TeacherFinance } from "@/features/billing/teacher-finance";
import { isAccountantCabinet } from "@/lib/auth/access";
import { api, ApiError } from "@/lib/api/client";
import type { User } from "@/types";

vi.mock("@/lib/api/client", async (original) => ({
  ...(await original<typeof import("@/lib/api/client")>()),
  api: vi.fn(),
}));
const user: User = {
  id: 1,
  full_name: "Buxgalter",
  phone: "+998901234567",
  roles: ["ACCOUNTANT"],
  extra_permissions: [],
  is_active: true,
};
const empty = { count: 0, next: null, previous: null, results: [] };
let paid = false;
let fail = false;
beforeEach(() => {
  paid = false;
  fail = false;
  vi.mocked(api).mockImplementation(async (path, options) => {
    if (path === "me/") return user;
    if (path.startsWith("public/settings/"))
      return { center_name: "Yuksalish", about: "Markaz bilan tanishing" };
    if (path.startsWith("reports/financial/"))
      return {
        student_count: 0,
        total_students: 0,
        active_students: 0,
        invoice_count: 0,
      };
    if (path.startsWith("students/?"))
      return {
        ...empty,
        count: 1,
        results: [
          { id: 7, full_name: "Shahzod Aliyev", phone: "+998901234567" },
        ],
      };
    if (path === "students/7/")
      return { id: 7, full_name: "Shahzod Aliyev", phone: "+998901234567" };
    if (path.startsWith("billing/payments/options/"))
      return { balance: "300.30", invoice_count: 2, pending_count: 0 };
    if (path === "billing/payments/" && options?.method === "POST") {
      if (fail) throw new ApiError(400, "Summa qoldiqdan katta.");
      return { id: 1 };
    }
    if (path.startsWith("staff/teacher-finance/"))
      return {
        id: 1,
        full_name: "Test Ustoz",
        phone: "+998901234568",
        is_active: true,
        account_active: true,
        subject_names: ["Matematika"],
        student_count: 9,
        group_count: 2,
        paid_for_month: paid ? "100000.00" : "0.00",
        total_paid: paid ? "100000.00" : "0.00",
      };
    if (path === "billing/teacher-payments/" && options?.method === "POST") {
      paid = true;
      return { id: 4 };
    }
    if (path.startsWith("billing/teacher-payments/?"))
      return paid
        ? {
            ...empty,
            count: 1,
            results: [
              {
                id: 4,
                teacher_name: "Test Ustoz",
                amount: "100000.00",
                month: "2026-10-01",
                paid_on: "2026-10-30",
                status: "POSTED",
                note: "Avans",
                entered_by_name: "Buxgalter",
                void_reason: "",
              },
            ],
          }
        : empty;
    return empty;
  });
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function payment() {
  render(
    <Providers>
      <PaymentForm user={user} />
    </Providers>,
  );
}
async function chooseStudent() {
  const search = screen.getByRole("combobox", { name: "O‘quvchini qidirish" });
  fireEvent.focus(search);
  fireEvent.change(search, { target: { value: "aLiYeV" } });
  await screen.findByRole("option", { name: /Shahzod Aliyev/ });
  fireEvent.keyDown(search, { key: "Enter" });
  await screen.findByText("Shahzod Aliyev");
  return search;
}

describe("Buxgalter ish paneli", () => {
  it("Keraksiz ta’lim bo‘limlarini menyu va bevosita kirishdan olib tashlaydi", () => {
    for (const section of [
      "lessons",
      "groups",
      "schedule",
      "rooms",
      "enrollments",
      "subjects",
      "courses",
    ])
      expect(accessibleSection(user, section)).toBe(false);
    for (const section of [
      "teachers",
      "teacher-finance",
      "students",
      "record-payment",
      "exports",
    ])
      expect(accessibleSection(user, section), section).toBe(true);
    expect(accessibleSection(user, "attendance")).toBe(false);
  });
  it("Aralash rahbar rolining ta’lim boshqaruvini saqlaydi", () => {
    const owner = { ...user, roles: ["OWNER_ADMIN", "ACCOUNTANT"] };
    expect(isAccountantCabinet(owner)).toBe(false);
    expect(accessibleSection(owner, "rooms")).toBe(true);
  });
  it("Dashboardda markaz bannerini ko‘rsatmaydi", async () => {
    const { container } = render(
      <Providers>
        <DashboardContent user={user} section="" />
      </Providers>,
    );
    await screen.findByRole("heading", { name: "Moliyaviy holat" });
    expect(container.querySelector(".dashboard-center-banner")).toBeNull();
  });
  it("Qidiruvdan klaviatura bilan tanlab, qo‘lda yozilgan summani saqlaydi", async () => {
    payment();
    await chooseStudent();
    const amount = screen.getByLabelText("To‘lov summasi (so‘m)");
    await waitFor(() => expect(amount).toBeEnabled());
    fireEvent.change(amount, { target: { value: "150.15" } });
    fireEvent.click(
      screen.getByRole("button", { name: "To‘lovni tekshirish" }),
    );
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent("Shahzod Aliyev");
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Tasdiqlash va saqlash" }),
    );
    await screen.findByText(/to‘lov saqlandi/);
    const call = vi
      .mocked(api)
      .mock.calls.find(
        ([path, options]) =>
          path === "billing/payments/" && options?.method === "POST",
      )!;
    expect(JSON.parse(String(call[1]?.body))).toMatchObject({
      student: 7,
      amount: "150.15",
    });
    expect(JSON.parse(String(call[1]?.body))).not.toHaveProperty("allocations");
  });
  it("Yangi o‘quvchi qidirilganda oldingi summa va tanlovni tozalaydi", async () => {
    payment();
    const search = await chooseStudent();
    const amount = screen.getByLabelText("To‘lov summasi (so‘m)");
    await waitFor(() => expect(amount).toBeEnabled());
    fireEvent.change(amount, { target: { value: "100" } });
    fireEvent.change(search, { target: { value: "Boshqa" } });
    expect(amount).toHaveValue(null);
    expect(amount).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "To‘lovni tekshirish" }),
    ).toBeDisabled();
  });
  it("Ortiqcha summani tasdiqlashga yubormaydi", async () => {
    payment();
    await chooseStudent();
    const amount = screen.getByLabelText("To‘lov summasi (so‘m)");
    await waitFor(() => expect(amount).toBeEnabled());
    fireEvent.change(amount, { target: { value: "301" } });
    expect(
      screen.getByRole("button", { name: "To‘lovni tekshirish" }),
    ).toBeDisabled();
    expect(screen.getByRole("alert")).toHaveTextContent("qoldiqdan katta");
  });
  it("Saqlash xatosida muvaffaqiyat xabarini ko‘rsatmaydi", async () => {
    fail = true;
    payment();
    await chooseStudent();
    const amount = screen.getByLabelText("To‘lov summasi (so‘m)");
    await waitFor(() => expect(amount).toBeEnabled());
    fireEvent.change(amount, { target: { value: "100" } });
    fireEvent.click(
      screen.getByRole("button", { name: "To‘lovni tekshirish" }),
    );
    fireEvent.click(
      within(await screen.findByRole("dialog")).getByRole("button", {
        name: "Tasdiqlash va saqlash",
      }),
    );
    await screen.findByRole("alert");
    expect(screen.queryByText(/to‘lov saqlandi/)).not.toBeInTheDocument();
  });
  it("Ustoz to‘lovi saqlangach tarix va jami summalarni yangilaydi", async () => {
    render(
      <Providers>
        <TeacherFinance
          user={user}
          initialTeacher="1"
          initialMonth="2026-10-01"
        />
      </Providers>,
    );
    fireEvent.click(
      await screen.findByRole("button", { name: "Ustozga to‘lov kiritish" }),
    );
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Summa (so‘m)"), {
      target: { value: "100000" },
    });
    fireEvent.change(within(dialog).getByLabelText("Izoh / oylik yoki avans"), {
      target: { value: "Avans" },
    });
    fireEvent.submit(
      within(dialog)
        .getByRole("button", { name: "To‘lovni tekshirish" })
        .closest("form")!,
    );
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Tasdiqlash va saqlash" }),
    );
    await screen.findByText("Ustoz to‘lovi saqlandi.");
    await screen.findByText("Avans");
    expect(
      screen.getByRole("heading", { name: "To‘lovlar tarixi" }),
    ).toBeVisible();
    expect(
      vi
        .mocked(api)
        .mock.calls.filter(
          ([path, options]) =>
            path === "billing/teacher-payments/" && options?.method === "POST",
        ),
    ).toHaveLength(1);
  });
});
