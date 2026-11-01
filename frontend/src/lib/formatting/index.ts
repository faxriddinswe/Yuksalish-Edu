export const money = (value: unknown) =>
  value === null || value === undefined
    ? "Belgilanmagan"
    : `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 })
        .formatToParts(Number(value))
        .map((part) =>
          part.type === "group"
            ? " "
            : part.type === "decimal"
              ? ","
              : part.value,
        )
        .join("")} so‘m`;
export function dateTime(value: unknown) {
  if (!value) return "—";
  const str = String(value);
  const parts = new Intl.DateTimeFormat("en-GB", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    ...(str.includes("T")
      ? { hour: "2-digit", minute: "2-digit", hourCycle: "h23" as const }
      : {}),
    timeZone: "Asia/Tashkent",
  }).formatToParts(new Date(str.includes("T") ? str : `${str}T00:00:00+05:00`));
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value;
  return `${part("day")}.${part("month")}.${part("year")}${str.includes("T") ? `, ${part("hour")}:${part("minute")}` : ""}`;
}
export const statusLabels: Record<string, string> = {
  ACTIVE: "Faol",
  INACTIVE: "Nofaol",
  ARCHIVED: "Arxiv",
  NEW: "Yangi",
  CONTACTED: "Bog‘lanilgan",
  ENROLLED: "Qabul qilingan",
  CLOSED: "Yopilgan",
  PENDING: "Belgilanishi kerak",
  CONFIRMED: "Tasdiqlangan",
  PAID: "To‘langan",
  PARTIAL: "Qisman to‘langan",
  UNPAID: "To‘lanmagan",
  OVERDUE: "Muddati o‘tgan",
  WAITING: "Muddati kelmagan",
  PRESENT: "Qatnashgan",
  ABSENT: "Qatnashmagan",
  LATE: "Kechikkan",
  EXCUSED: "Sababli",
  SCHEDULED: "Rejalangan",
  COMPLETED: "Yakunlangan",
  CANCELLED: "Bekor qilingan",
  POSTED: "Kiritilgan",
  VOID: "Bekor qilingan",
  ENDED: "Yakunlangan",
  DRAFT: "Qoralama",
  PUBLISHED: "E’lon qilingan",
  RUNNING: "Tayyorlanmoqda",
  FAILED: "Xato",
};
export const roleLabels: Record<string, string> = {
  OWNER_ADMIN: "Rahbar",
  ADMINISTRATOR: "Administrator",
  ACCOUNTANT: "Buxgalter",
  TEACHER: "O‘qituvchi",
  STUDENT: "O‘quvchi",
  PARENT: "Ota-ona",
};
