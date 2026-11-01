import { test, expect } from "@playwright/test";

for (const collection of [
  { path: "/kurslar", heading: /yo‘nalishni toping/, filter: "subject" },
  { path: "/ustozlar", heading: /yoningizdagi ustozlar/, filter: "subjects" },
  { path: "/natijalar", heading: /haqiqiy yutuqlar/, filter: "subject" },
]) {
  test(`${collection.path}: eskirgan sahifa raqami filtr va qidiruvni buzmaydi`, async ({
    page,
  }) => {
    const subjects = await (
      await page.request.get("/api/v1/public/subjects/")
    ).json();
    const subject = subjects.results[0];
    expect(subject).toBeTruthy();
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));

    for (const number of [
      "999999",
      "0",
      "-2",
      "no-page",
      "1.5",
      "9007199254740993",
    ]) {
      const query = new URLSearchParams({
        [collection.filter]: String(subject.id),
        search: "Mavjud emas — pagination regressiya",
        page: number,
      });
      await page.goto(`${collection.path}?${query}`);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(
        collection.heading,
      );
      await expect(page.getByLabel("Qidirish", { exact: true })).toHaveValue(
        query.get("search")!,
      );
      await expect(
        page.getByRole("link", { name: subject.name, exact: true }),
      ).toHaveAttribute("aria-current", "page");
      await expect(
        page.getByRole("heading", { name: "Ma’lumotni yuklab bo‘lmadi" }),
      ).toHaveCount(0);
    }
    expect(errors).toEqual([]);
  });
}
