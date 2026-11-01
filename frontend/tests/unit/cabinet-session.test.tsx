import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CabinetSession,
  useCabinetUser,
  identityKey,
} from "@/components/layout/cabinet-session";
import { api } from "@/lib/api/client";
import { canOpenSection, cabinetRole } from "@/lib/auth/access";
import {
  sessionStorageKey,
  announceSessionChange,
} from "@/lib/auth/session-events";
import type { User } from "@/types";

vi.mock("next/navigation", () => ({ usePathname: () => "/kabinet" }));
vi.mock("@/lib/api/client", async (original) => ({
  ...(await original<typeof import("@/lib/api/client")>()),
  api: vi.fn(),
}));
const user: User = {
  id: 7,
  full_name: "O‘quvchi",
  phone: "+998901111111",
  roles: ["STUDENT"],
  extra_permissions: [],
  is_active: true,
};
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function PrivateView() {
  const actual = useCabinetUser();
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ["private"],
    queryFn: async () => `${actual.id}-shaxsiy`,
  });
  return (
    <>
      <p>{actual.full_name}</p>
      <p>{query.data}</p>
      <input aria-label="Yozilayotgan matn" />
      <button
        onClick={() => client.setQueryData(["private"], "Mahalliy qiymat")}
      >
        Kesh
      </button>
    </>
  );
}

describe("Kabinet sessiyasi va rollar ajratilishi", () => {
  it("O‘z tabida chiqish boshlanganda guard ikkinchi tekshiruv yoki yo‘naltirishni boshlamaydi", async () => {
    vi.mocked(api).mockResolvedValue(user);
    render(
      <CabinetSession user={user}>
        <PrivateView />
      </CabinetSession>,
    );
    const input = await screen.findByLabelText("Yozilayotgan matn");
    announceSessionChange();
    await waitFor(() => expect(input).not.toBeVisible());
    fireEvent.focus(window);
    expect(api).toHaveBeenCalledTimes(1);
  });
  it("Shaxsiy UI tasdiqlangan /me javobidan keyin ochiladi, qayta tekshirish formani yo‘qotmaydi", async () => {
    let resolve!: (value: User) => void;
    vi.mocked(api).mockImplementation(
      () =>
        new Promise<User>((done) => {
          resolve = done;
        }),
    );
    render(
      <CabinetSession user={user}>
        <PrivateView />
      </CabinetSession>,
    );
    expect(screen.queryByText(user.full_name)).not.toBeInTheDocument();
    expect(
      screen.queryByLabelText("Yozilayotgan matn"),
    ).not.toBeInTheDocument();
    resolve(user);
    const input = await screen.findByLabelText("Yozilayotgan matn");
    fireEvent.change(input, { target: { value: "Saqlanmagan izoh" } });
    fireEvent(
      window,
      new StorageEvent("storage", {
        key: sessionStorageKey,
        newValue: "identity-changed",
      }),
    );
    await waitFor(() => expect(input).not.toBeVisible());
    resolve(user);
    await waitFor(() => expect(input).toBeVisible());
    expect(input).toHaveValue("Saqlanmagan izoh");
    expect(api).toHaveBeenCalledTimes(2);
  });

  it("Yangi sessiya xuddi shu kalitdagi oldingi shaxsiy keshni olmaydi", async () => {
    vi.mocked(api).mockResolvedValue(user);
    const first = render(
      <CabinetSession user={user}>
        <PrivateView />
      </CabinetSession>,
    );
    await screen.findByText("7-shaxsiy");
    fireEvent.click(screen.getByRole("button", { name: "Kesh" }));
    expect(await screen.findByText("Mahalliy qiymat")).toBeInTheDocument();
    first.unmount();
    const other = { ...user, id: 8, full_name: "Keyingi o‘quvchi" };
    vi.mocked(api).mockResolvedValue(other);
    render(
      <CabinetSession user={other}>
        <PrivateView />
      </CabinetSession>,
    );
    await screen.findByText("8-shaxsiy");
    expect(screen.queryByText("Mahalliy qiymat")).not.toBeInTheDocument();
    expect(identityKey(user)).not.toBe(
      identityKey({ ...user, roles: ["OWNER_ADMIN"] }),
    );
  });

  it("/me tekshiruvi ishlamasa eski shaxsiy ma’lumotlarni yashiradi", async () => {
    vi.mocked(api).mockResolvedValue(user);
    render(
      <CabinetSession user={user}>
        <PrivateView />
      </CabinetSession>,
    );
    const input = await screen.findByLabelText("Yozilayotgan matn");
    vi.mocked(api).mockRejectedValue(new Error("Aloqa yo‘q"));
    fireEvent.focus(window);
    await waitFor(() => expect(input).not.toBeVisible());
    await screen.findByRole("alert");
    vi.mocked(api).mockResolvedValue(user);
    fireEvent.focus(window);
    await waitFor(() => expect(input).toBeVisible());
  });

  it("Shaxsiy va moliyaviy rollar boshqaruv bo‘limlarini ochmaydi; nofaol akkaunt yopiladi", () => {
    for (const role of ["STUDENT", "PARENT", "TEACHER", "ACCOUNTANT"]) {
      const actor = { ...user, roles: [role] };
      expect(cabinetRole(actor)).toBe(role);
      for (const section of [
        "staff",
        "settings",
        "audit",
        "leads",
        "parents",
        "schedule",
      ])
        expect(canOpenSection(actor, section), `${role}:${section}`).toBe(
          false,
        );
    }
    const student = { ...user };
    for (const section of [
      "students",
      "reports",
      "exports",
      "record-payment",
      "prices",
      "achievements",
      "adjustments",
    ])
      expect(canOpenSection(student, section), section).toBe(false);
    expect(
      canOpenSection(
        { ...user, roles: ["OWNER_ADMIN"], is_active: false },
        "staff",
      ),
    ).toBe(false);
    expect(
      canOpenSection({ ...user, roles: ["OWNER_ADMIN"] }, "roll-call"),
    ).toBe(true);
    expect(
      canOpenSection({ ...user, roles: ["OWNER_ADMIN"] }, "teacher-finance"),
    ).toBe(true);
  });
});
