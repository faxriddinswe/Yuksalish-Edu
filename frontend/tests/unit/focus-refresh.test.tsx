import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { focusManager } from "@tanstack/react-query";
import { Providers } from "@/components/layout/providers";
import { DashboardContent } from "@/features/dashboard";
import { NotificationCenter } from "@/features/notifications/notification-center";
import { api } from "@/lib/api/client";
import type { User } from "@/types";

vi.mock("@/lib/api/client", async (original) => ({
  ...(await original<typeof import("@/lib/api/client")>()),
  api: vi.fn(),
}));

const empty = { count: 0, next: null, previous: null, results: [] };
let changed = false;
let user: User;

beforeEach(() => {
  changed = false;
  user = {
    id: 1,
    full_name: "Sinov foydalanuvchisi",
    phone: "+998901234567",
    roles: ["STUDENT"],
    extra_permissions: [],
    is_active: true,
  };
  focusManager.setFocused(true);
  vi.mocked(api).mockImplementation(async (path) => {
    if (path === "me/") return user;
    if (path.startsWith("attendance/"))
      return {
        ...empty,
        count: 1,
        results: [
          {
            id: 1,
            student_name: "Sinov o‘quvchisi",
            group_name: "Guruh 1",
            course_name: "Matematika",
            lesson_date: "2026-10-30T09:00:00Z",
            status: changed ? "ABSENT" : "PRESENT",
            note: "",
          },
        ],
      };
    if (path.startsWith("notifications/"))
      return {
        ...empty,
        count: 1,
        results: [
          {
            id: 1,
            title: changed ? "Yangilangan e’lon" : "Avvalgi e’lon",
            message: "Markaz xabari",
            kind: "ANNOUNCEMENT",
            created_at: "2026-10-30T09:00:00Z",
            read_at: null,
          },
        ],
      };
    if (path.startsWith("parents/links/"))
      return {
        ...empty,
        count: 1,
        results: [{ id: 1, student: 1, student_name: "Sinov o‘quvchisi" }],
      };
    if (path === "public/settings/") return null;
    if (path.startsWith("billing/payments/summary/"))
      return {
        invoice_count: 0,
        pending_count: 0,
        balance: "0",
        overdue_balance: "0",
        upcoming_balance: "0",
        subjects: [],
      };
    return empty;
  });
});

afterEach(() => {
  cleanup();
  focusManager.setFocused(undefined);
  vi.clearAllMocks();
});

async function returnToCabinet() {
  await act(async () => {
    focusManager.setFocused(false);
    changed = true;
    focusManager.setFocused(true);
  });
}

describe("Kabinetga qaytilganda ma’lumotlar yangilanishi", () => {
  for (const role of ["STUDENT", "PARENT"]) {
    it.each(["attendance", ""])(
      `${role}: %s davomatini intervalni kutmasdan oladi`,
      async (section) => {
        user.roles = [role];
        render(
          <Providers>
            <DashboardContent user={user} section={section} />
          </Providers>,
        );
        await screen.findByText("Qatnashgan");
        await returnToCabinet();
        await waitFor(() =>
          expect(screen.getByText("Qatnashmagan")).toBeVisible(),
        );
      },
    );
  }

  it("Bildirishnomalarni 60 soniyalik intervalni kutmasdan oladi", async () => {
    render(
      <Providers>
        <NotificationCenter user={user} />
      </Providers>,
    );
    await screen.findByRole("heading", { name: "Avvalgi e’lon" });
    await returnToCabinet();
    await waitFor(() =>
      expect(
        screen.getByRole("heading", { name: "Yangilangan e’lon" }),
      ).toBeVisible(),
    );
  });
});
