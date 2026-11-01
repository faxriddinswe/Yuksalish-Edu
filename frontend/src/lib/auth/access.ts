import type { User } from "@/types";

const priority = [
  "OWNER_ADMIN",
  "ADMINISTRATOR",
  "ACCOUNTANT",
  "TEACHER",
  "PARENT",
  "STUDENT",
];
export function cabinetRole(user: User) {
  return priority.find((role) => user.roles.includes(role)) || "";
}
export const cabinetTitles: Record<string, string> = {
  OWNER_ADMIN: "Rahbar kabineti",
  ADMINISTRATOR: "Administrator kabineti",
  ACCOUNTANT: "Buxgalter kabineti",
  TEACHER: "O‘qituvchi kabineti",
  STUDENT: "O‘quvchi kabineti",
  PARENT: "Ota-ona kabineti",
};
const sections: Record<string, string[]> = {
  OWNER_ADMIN: [
    "leads",
    "students",
    "parents",
    "parent-links",
    "staff",
    "groups",
    "enrollments",
    "lessons",
    "attendance",
    "roll-call",
    "schedule",
    "rooms",
    "teachers",
    "teacher-finance",
    "subjects",
    "courses",
    "reports",
    "record-payment",
    "invoices",
    "payments",
    "adjustments",
    "prices",
    "opening-balance",
    "exports",
    "notifications",
    "achievements",
    "faqs",
    "audit",
    "settings",
  ],
  ADMINISTRATOR: [
    "leads",
    "students",
    "parents",
    "parent-links",
    "staff",
    "groups",
    "enrollments",
    "lessons",
    "attendance",
    "schedule",
    "rooms",
    "teachers",
    "subjects",
    "courses",
    "invoices",
    "payments",
    "prices",
    "notifications",
    "achievements",
    "faqs",
    "settings",
  ],
  ACCOUNTANT: [
    "students",
    "teachers",
    "teacher-finance",
    "reports",
    "record-payment",
    "invoices",
    "payments",
    "adjustments",
    "prices",
    "opening-balance",
    "exports",
    "notifications",
  ],
  TEACHER: [
    "students",
    "groups",
    "lessons",
    "attendance",
    "roll-call",
    "notifications",
    "achievements",
  ],
  STUDENT: ["groups", "lessons", "attendance", "payments", "notifications"],
  PARENT: [
    "students",
    "groups",
    "lessons",
    "attendance",
    "invoices",
    "payments",
    "notifications",
  ],
};
export function canOpenSection(user: User, section: string) {
  if (!user.is_active) return false;
  if (["", "profile", "center"].includes(section)) return true;
  if (user.roles.some((role) => sections[role]?.includes(section))) return true;
  return (
    (section === "record-payment" &&
      user.extra_permissions.includes("billing.record_payment")) ||
    (section === "roll-call" &&
      user.extra_permissions.includes("attendance.correct_attendance"))
  );
}

export function isOffice(user: User) {
  return user.roles.some((role) =>
    ["OWNER_ADMIN", "ADMINISTRATOR"].includes(role),
  );
}
export function isFinance(user: User) {
  return user.roles.some((role) =>
    ["OWNER_ADMIN", "ACCOUNTANT"].includes(role),
  );
}

export function canManageCertificates(user: User) {
  return isOffice(user) || user.roles.includes("TEACHER");
}
export function isAccountantCabinet(user: User) {
  return cabinetRole(user) === "ACCOUNTANT";
}

export function isTeacherCabinet(user: User) {
  return cabinetRole(user) === "TEACHER";
}

export function isStudentCabinet(user: User) {
  return cabinetRole(user) === "STUDENT";
}
export function isParentCabinet(user: User) {
  return cabinetRole(user) === "PARENT";
}
