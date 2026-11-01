import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { Providers } from "@/components/layout/providers";
import { ResourceManager } from "@/features/resources/resource-manager";
import { canWrite } from "@/features/resources/config";
import { accessibleSection } from "@/components/layout/dashboard-shell";
import { api } from "@/lib/api/client";
import { publicApi, publicPage } from "@/lib/api/server";
import Results from "@/app/(public)/natijalar/page";
import type { User } from "@/types";

vi.mock("@/lib/api/client", async (original) => ({
  ...(await original<typeof import("@/lib/api/client")>()),
  api: vi.fn(),
}));
vi.mock("@/lib/api/server", () => ({
  publicApi: vi.fn(),
  publicPage: vi.fn(),
  pageMetadata: () => ({}),
}));
const actor = (role: string): User => ({
  id: 1,
  full_name: "Test",
  phone: "+998901234567",
  roles: [role],
  extra_permissions: [],
  is_active: true,
});
const empty = { count: 0, next: null, previous: null, results: [] };
afterEach(cleanup);
beforeEach(() => vi.clearAllMocks());

it("Administrator texnik boshqaruvni, buxgalter faqat moliyaviy amallarni boshqaradi", () => {
  for (const section of [
    "staff",
    "students",
    "parents",
    "teachers",
    "courses",
    "achievements",
    "settings",
  ]) {
    expect(canWrite(actor("ADMINISTRATOR"), section)).toBe(true);
    expect(canWrite(actor("ACCOUNTANT"), section)).toBe(false);
  }
  expect(accessibleSection(actor("ACCOUNTANT"), "reports")).toBe(true);
  expect(accessibleSection(actor("ADMINISTRATOR"), "reports")).toBe(false);
  expect(accessibleSection(actor("ACCOUNTANT"), "staff")).toBe(false);
  expect(accessibleSection(actor("OWNER_ADMIN"), "staff")).toBe(true);
});

it("Administrator akkaunt yarata oladi, rahbar va moliyaviy istisno vakolatlarini bermaydi", async () => {
  vi.mocked(api).mockResolvedValue(empty);
  render(
    <Providers>
      <ResourceManager section="staff" user={actor("ADMINISTRATOR")} />
    </Providers>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Yangi yozuv" }));
  const dialog = screen.getByRole("dialog");
  expect(
    within(dialog).getByRole("checkbox", { name: "Buxgalter" }),
  ).toBeInTheDocument();
  expect(
    within(dialog).queryByRole("checkbox", { name: "Rahbar" }),
  ).not.toBeInTheDocument();
  expect(
    within(dialog).queryByText("Qo‘shimcha vakolatlar"),
  ).not.toBeInTheDocument();
});

it("Administrator hisoblar sahifasi o‘quvchi tanlamasdan yopiq moliya so‘rovini yubormaydi", async () => {
  vi.mocked(api).mockResolvedValue(empty);
  render(
    <Providers>
      <ResourceManager section="invoices" user={actor("ADMINISTRATOR")} />
    </Providers>,
  );
  expect(screen.getByLabelText("O‘quvchini tanlang")).toBeInTheDocument();
  await waitFor(() =>
    expect(vi.mocked(api).mock.calls.length).toBeGreaterThan(0),
  );
  expect(
    vi
      .mocked(api)
      .mock.calls.some(([path]) => path.startsWith("billing/invoices/")),
  ).toBe(false);
});

it("O‘chirish tasdiqlangandan keyin DELETE yuboriladi va ro‘yxat yangilanadi", async () => {
  let deleted = false;
  vi.mocked(api).mockImplementation(async (path, options) => {
    if (options?.method === "DELETE") {
      deleted = true;
      return null;
    }
    return path.startsWith("content/faqs/") && !deleted
      ? {
          ...empty,
          count: 1,
          results: [
            {
              id: 8,
              question: "Test savol",
              answer: "Javob",
              publication_status: "DRAFT",
            },
          ],
        }
      : empty;
  });
  render(
    <Providers>
      <ResourceManager section="faqs" user={actor("ADMINISTRATOR")} />
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
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});

it("Har bir fan alohida ko‘rsatiladi va bir safar aynan 40 ta sertifikat olinadi", async () => {
  vi.mocked(publicApi).mockResolvedValue({
    ...empty,
    count: 2,
    results: [
      { id: 1, name: "Matematika", slug: "math" },
      { id: 2, name: "Kimyo", slug: "chemistry" },
    ],
  });
  vi.mocked(publicPage).mockImplementation(async (_path, params) => {
    const subject = params.get("subject");
    const results = Array.from({ length: 40 }, (_, index) => ({
      id: Number(subject) * 40 + index,
      title: `Natija ${index + 1}`,
      display_name: "Sinov",
      description: "Test ma’lumoti",
      score: "57 ball · B2",
      is_sample: true,
      image: "/media/test.jpg",
      subject: Number(subject),
      subject_name: subject === "1" ? "Matematika" : "Kimyo",
      teacher_name: "",
      achieved_on: null,
    }));
    return {
      data: { ...empty, count: 42, next: "?page=2", results },
      page: "1",
    };
  });
  render(await Results({ searchParams: Promise.resolve({}) }));
  expect(
    screen.getByRole("heading", { name: "Matematika", level: 2 }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole("heading", { name: "Kimyo", level: 2 }),
  ).toBeInTheDocument();
  expect(screen.getAllByRole("article")).toHaveLength(80);
  expect(screen.getAllByText("57 ball · B2")).toHaveLength(80);
  expect(screen.getAllByText("Namuna")).toHaveLength(80);
  expect(screen.getAllByText("Ko‘rsatilmagan")).toHaveLength(80);
  expect(
    screen.getAllByRole("link", { name: /Barcha 42 ta natijani/ }),
  ).toHaveLength(2);
  expect(vi.mocked(publicPage)).toHaveBeenCalledTimes(2);
  for (const [path, params] of vi.mocked(publicPage).mock.calls) {
    expect(path).toBe("achievements/");
    expect(params.get("page_size")).toBe("40");
  }
});
