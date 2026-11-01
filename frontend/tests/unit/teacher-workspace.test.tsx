import { describe, it, expect } from "vitest";
import { accessibleSection } from "@/components/layout/dashboard-shell";
import { isTeacherCabinet } from "@/lib/auth/access";
import { tashkentDay, shiftDay } from "@/lib/formatting/calendar";
import type { User } from "@/types";
const teacher: User = {
  id: 1,
  full_name: "Test Ustoz",
  phone: "+998901234567",
  roles: ["TEACHER"],
  extra_permissions: [],
  is_active: true,
};

describe("O‘qituvchi kabineti", () => {
  it("Keraksiz menyular va bevosita sahifa kirishini yashiradi", () => {
    for (const section of [
      "parents",
      "staff",
      "teachers",
      "enrollments",
      "rooms",
      "schedule",
      "courses",
      "subjects",
    ])
      expect(accessibleSection(teacher, section), section).toBe(false);
    for (const section of [
      "",
      "groups",
      "lessons",
      "attendance",
      "roll-call",
      "notifications",
      "students",
      "achievements",
      "profile",
    ])
      expect(accessibleSection(teacher, section), section).toBe(true);
  });
  it("Qo‘shimcha rahbar roli vakolatlarini cheklamaydi", () => {
    const mixed = { ...teacher, roles: ["TEACHER", "OWNER_ADMIN"] };
    expect(isTeacherCabinet(mixed)).toBe(false);
    expect(accessibleSection(mixed, "rooms")).toBe(true);
    expect(accessibleSection(mixed, "students")).toBe(true);
  });
  it("Sana chegarasini Toshkent vaqti bilan oladi", () => {
    expect(tashkentDay(new Date("2026-10-29T19:00:00Z"))).toBe("2026-10-30");
    expect(tashkentDay(new Date("2026-10-29T18:59:59Z"))).toBe("2026-10-29");
  });
  it("7 kunlik jadval oy va yil chegaralaridan o‘tadi", () => {
    expect(shiftDay("2026-10-30", 6)).toBe("2026-11-05");
    expect(shiftDay("2026-12-30", 6)).toBe("2027-01-05");
    expect(shiftDay("2026-11-05", -6)).toBe("2026-10-30");
  });
});
