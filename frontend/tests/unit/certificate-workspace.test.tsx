import { afterEach, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
  waitFor,
} from "@testing-library/react";
import { Providers } from "@/components/layout/providers";
import { ResourceManager } from "@/features/resources/resource-manager";
import { accessibleSection } from "@/components/layout/dashboard-shell";
import { canWrite } from "@/features/resources/config";
import { api } from "@/lib/api/client";
import type { User } from "@/types";

vi.mock("@/lib/api/client", async (original) => ({
  ...(await original<typeof import("@/lib/api/client")>()),
  api: vi.fn(),
}));
const empty = { count: 0, next: null, previous: null, results: [] };
const actor = (role: string): User => ({
  id: 1,
  full_name: "Sinov",
  phone: "+998901234567",
  roles: [role],
  extra_permissions: [],
  is_active: true,
});
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

it("O‘qituvchi sertifikat boshqaradi va o‘quvchilarni o‘qiydi; texnik yoki o‘quvchi yozuvini tahrirlamaydi", () => {
  const teacher = actor("TEACHER");
  expect(accessibleSection(teacher, "achievements")).toBe(true);
  expect(accessibleSection(teacher, "students")).toBe(true);
  expect(canWrite(teacher, "achievements")).toBe(true);
  expect(canWrite(teacher, "students")).toBe(false);
  for (const section of ["staff", "settings", "faqs", "subjects", "reports"])
    expect(accessibleSection(teacher, section)).toBe(false);
});

it("O‘qituvchi formasida o‘z ustozini tanlash shart emas, o‘quvchi tanlanganda ism to‘ladi", async () => {
  vi.mocked(api).mockImplementation(async (path) =>
    path.startsWith("students/")
      ? {
          ...empty,
          count: 1,
          results: [{ id: 7, full_name: "Sinov O‘quvchi" }],
        }
      : empty,
  );
  render(
    <Providers>
      <ResourceManager section="achievements" user={actor("TEACHER")} />
    </Providers>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Yangi yozuv" }));
  const dialog = screen.getByRole("dialog");
  expect(
    within(dialog).queryByLabelText("Natijaga tayyorlagan ustoz"),
  ).not.toBeInTheDocument();
  const student = within(dialog).getByLabelText(/Sertifikat olgan o‘quvchi$/, {
    selector: "select",
  });
  await waitFor(() =>
    expect(
      within(student).getByRole("option", { name: "Sinov O‘quvchi" }),
    ).toBeInTheDocument(),
  );
  expect(student).toBeRequired();
  fireEvent.change(student, { target: { value: "7" } });
  expect(
    within(dialog).getByLabelText(/E’lon qilishga ruxsat etilgan ism/),
  ).toHaveValue("Sinov O‘quvchi");
  expect(
    within(dialog).getByLabelText("Shaxsiy ma’lumotlari tozalangan rasm"),
  ).toBeInTheDocument();
});

it("Sertifikat olganlar filtridan keyin fan, sertifikat turi va ball ko‘rinadi", async () => {
  vi.mocked(api).mockImplementation(async (path) =>
    path.startsWith("students/")
      ? {
          ...empty,
          count: 1,
          results: [
            {
              id: 7,
              full_name: "Sinov O‘quvchi",
              status: "ACTIVE",
              certificates: [
                {
                  id: 5,
                  title: "Milliy sertifikat",
                  subject_name: "Ingliz tili",
                  score: "57 ball · B2",
                  teacher_name: "Sinov Ustoz",
                },
              ],
            },
          ],
        }
      : empty,
  );
  render(
    <Providers>
      <ResourceManager section="students" user={actor("TEACHER")} />
    </Providers>,
  );
  fireEvent.change(screen.getByLabelText("Sertifikat holati"), {
    target: { value: "true" },
  });
  await waitFor(() =>
    expect(
      vi
        .mocked(api)
        .mock.calls.some(([path]) => path.includes("has_certificate=true")),
    ).toBe(true),
  );
  expect(
    await screen.findByText("Ingliz tili · Milliy sertifikat"),
  ).toBeInTheDocument();
  expect(screen.getByText("Ball / daraja: 57 ball · B2")).toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Yangi yozuv" }),
  ).not.toBeInTheDocument();
});

it("Buxgalterda sertifikat filtri ochilmaydi", async () => {
  vi.mocked(api).mockResolvedValue(empty);
  render(
    <Providers>
      <ResourceManager section="students" user={actor("ACCOUNTANT")} />
    </Providers>,
  );
  expect(screen.queryByLabelText("Sertifikat holati")).not.toBeInTheDocument();
  expect(screen.queryByLabelText("Sertifikat fani")).not.toBeInTheDocument();
});

it("O‘qituvchi o‘z sertifikatini tasdiqdan so‘ng o‘chira oladi", async () => {
  let deleted = false;
  vi.mocked(api).mockImplementation(async (path, options) => {
    if (options?.method === "DELETE") {
      deleted = true;
      return null;
    }
    return path.startsWith("content/achievements/?") && !deleted
      ? {
          ...empty,
          count: 1,
          results: [
            {
              id: 9,
              title: "Sinov sertifikati",
              score: "57",
              student_name: "Sinov",
              subject_name: "Ingliz tili",
            },
          ],
        }
      : empty;
  });
  render(
    <Providers>
      <ResourceManager section="achievements" user={actor("TEACHER")} />
    </Providers>,
  );
  fireEvent.click(await screen.findByRole("button", { name: /Tafsilot/ }));
  fireEvent.click(screen.getByRole("button", { name: "Yozuvni o‘chirish" }));
  expect(deleted).toBe(false);
  fireEvent.click(
    screen.getByRole("button", { name: "O‘chirishni tasdiqlash" }),
  );
  await waitFor(() => expect(deleted).toBe(true));
  expect(await screen.findByRole("status")).toHaveTextContent(
    "Yozuv o‘chirildi",
  );
});
