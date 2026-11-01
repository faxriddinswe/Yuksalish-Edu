"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useSyncExternalStore } from "react";
import {
  LayoutDashboard,
  Users,
  BookOpen,
  CalendarDays,
  CreditCard,
  Bell,
  Settings,
  LogOut,
  Menu,
  X,
  ChevronRight,
  GraduationCap,
  FileText,
  Shield,
  UserRound,
  ChartNoAxesCombined,
  type LucideIcon,
} from "lucide-react";
import {
  isAccountantCabinet,
  isStudentCabinet,
  isTeacherCabinet,
  isParentCabinet,
  cabinetRole,
  cabinetTitles,
  canOpenSection,
} from "@/lib/auth/access";
import { CenterSocialLinks } from "@/components/layout/center-social-links";
import { api, errorText } from "@/lib/api/client";
import { roleLabels } from "@/lib/formatting";
import { useCabinetUser } from "./cabinet-session";
import { announceSessionChange } from "@/lib/auth/session-events";
import type { User } from "@/types";
const subscribeHydration = () => () => {};
const navigation: { title: string; items: [string, string, LucideIcon][] }[] = [
  {
    title: "Asosiy",
    items: [
      ["", "Bosh sahifa", LayoutDashboard],
      ["notifications", "Bildirishnomalar", Bell],
    ],
  },
  {
    title: "Markaz boshqaruvi",
    items: [
      ["leads", "Murojaatlar", FileText],
      ["students", "O‘quvchilar", Users],
      ["parents", "Ota-onalar", UserRound],
      ["parent-links", "Farzandlar va vasiylar", Users],
      ["staff", "Xodimlar / takliflar", Shield],
    ],
  },
  {
    title: "Ta’lim",
    items: [
      ["groups", "Guruhlar", GraduationCap],
      ["enrollments", "Guruh a’zoliklari", Users],
      ["lessons", "Darslar va jadval", CalendarDays],
      ["attendance", "Davomat", BookOpen],
      ["schedule", "Haftalik jadval", CalendarDays],
      ["rooms", "Xonalar", BookOpen],
      ["teachers", "Ustozlar", GraduationCap],
      ["subjects", "Fanlar", BookOpen],
      ["courses", "Kurslar", BookOpen],
    ],
  },
  {
    title: "Moliya",
    items: [
      ["reports", "Moliyaviy hisobot", ChartNoAxesCombined],
      ["record-payment", "To‘lov kiritish", CreditCard],
      ["invoices", "Oylik hisoblar", FileText],
      ["payments", "To‘lovlar tarixi", CreditCard],
      ["adjustments", "Tuzatishlar", FileText],
      ["prices", "Fan narxlari", CreditCard],
      ["opening-balance", "Boshlang‘ich qarz", FileText],
      ["exports", "Excel eksportlar", FileText],
    ],
  },
  {
    title: "Boshqaruv",
    items: [
      ["achievements", "Sertifikatlar", GraduationCap],
      ["faqs", "Savol-javob", BookOpen],
      ["audit", "Amallar tarixi", Shield],
      ["settings", "Markaz sozlamalari", Settings],
      ["profile", "Profil va parol", UserRound],
      ["center", "Markaz haqida", BookOpen],
    ],
  },
];
export function accessibleSection(user: User, key: string) {
  return canOpenSection(user, key);
}
export function DashboardShell({ children }: { children: React.ReactNode }) {
  const user = useCabinetUser();
  const [menu, setMenu] = useState(false);
  const [error, setError] = useState("");
  const pathname = usePathname();
  const hydrated = useSyncExternalStore(
    subscribeHydration,
    () => true,
    () => false,
  );
  const [leaving, setLeaving] = useState(false);
  const client = useQueryClient();
  const unread = useQuery({
    queryKey: ["notification-unread-count", user.id],
    queryFn: () => api<{ unread_count: number }>("notifications/unread-count/"),
    refetchInterval: 60000,
    refetchOnWindowFocus: "always",
  });
  const active = pathname.split("/")[2] || "";
  const menuBody = (
    <>
      <Link className="wordmark" href="/kabinet">
        Yuksalish<span> Edu</span>
        <small>BOSHQARUV PLATFORMASI</small>
      </Link>
      <nav aria-label="Kabinet bo‘limlari">
        {navigation.map((group) => {
          const items = group.items.filter(([key]) =>
            accessibleSection(user, key),
          );
          return items.length ? (
            <div className="nav-group" key={group.title}>
              <p>
                {isTeacherCabinet(user) && group.title === "Markaz boshqaruvi"
                  ? "O‘quvchilarim"
                  : group.title}
              </p>
              {items.map(([key, label, Icon]) => (
                <Link
                  key={key}
                  href={`/kabinet${key ? `/${key}` : ""}`}
                  className={active === key ? "active" : ""}
                  aria-current={active === key ? "page" : undefined}
                  onClick={() => setMenu(false)}
                >
                  <Icon size={18} aria-hidden="true" />
                  {isParentCabinet(user) && key === "students"
                    ? "Farzandlarim"
                    : label}
                  {active === key && <ChevronRight size={14} />}
                </Link>
              ))}
            </div>
          ) : null;
        })}
      </nav>
      <div className="sidebar-footer">
        <CenterSocialLinks compact />
        <Link href="/" className="text-link">
          Ochiq saytga ↗
        </Link>
        <p>Yuksalish Edu · Ichki boshqaruv</p>
      </div>
    </>
  );
  async function leave() {
    setLeaving(true);
    try {
      await api("auth/session/", { method: "DELETE" });
      client.clear();
      announceSessionChange();
      window.location.replace("/kirish");
    } catch (e) {
      setError(errorText(e));
      setLeaving(false);
    }
  }
  const mobileKeys = [
    "",
    isAccountantCabinet(user) ? "teachers" : "lessons",
    ...(isStudentCabinet(user)
      ? ["payments"]
      : accessibleSection(user, "record-payment")
        ? ["record-payment"]
        : accessibleSection(user, "attendance")
          ? ["attendance"]
          : ["invoices"]),
    "notifications",
  ];
  return (
    <div className="dashboard">
      <aside className="sidebar">{menuBody}</aside>
      {menu && (
        <div className="drawer-backdrop" onClick={() => setMenu(false)}>
          <aside className="mobile-drawer" onClick={(e) => e.stopPropagation()}>
            <button
              className="icon-btn drawer-close"
              aria-label="Menyuni yopish"
              onClick={() => setMenu(false)}
            >
              <X />
            </button>
            {menuBody}
          </aside>
        </div>
      )}
      <div className="workspace">
        <header className="dashboard-header">
          <div className="header-greeting">
            <button
              className="icon-btn dashboard-menu"
              aria-label="Kabinet menyusini ochish"
              disabled={!hydrated}
              onClick={() => setMenu(true)}
            >
              <Menu />
            </button>
            <span>
              Yuksalish Edu <span className="header-divider">/</span>{" "}
              <strong>
                {cabinetTitles[cabinetRole(user)] || "Shaxsiy kabinet"}
              </strong>
            </span>
          </div>
          <div className="header-account">
            <Link
              className="icon-btn"
              aria-label="Bildirishnomalar"
              href="/kabinet/notifications"
            >
              <Bell size={20} />
              {!!unread.data?.unread_count && (
                <span className="notification-badge" aria-hidden="true">
                  {unread.data.unread_count > 99
                    ? "99+"
                    : unread.data.unread_count}
                </span>
              )}
            </Link>
            <Link className="account-chip" href="/kabinet/profile">
              <span className="avatar">{user.full_name.charAt(0)}</span>
              <span>
                <strong>{user.full_name}</strong>
                <small>
                  {roleLabels[cabinetRole(user)] || "Rol biriktirilmagan"}
                </small>
              </span>
            </Link>
            <button
              className="icon-btn"
              onClick={leave}
              disabled={!hydrated || leaving}
              aria-label="Tizimdan chiqish"
            >
              <LogOut size={18} />
            </button>
          </div>
        </header>
        <main id="main" className="dashboard-main">
          {error && (
            <div className="notice error" role="alert">
              {error}
            </div>
          )}
          {children}
        </main>
        <footer className="workspace-footer">
          <div className="workspace-brand">
            Yuksalish Edu <span>Ichki hisob va boshqaruv tizimi</span>
          </div>
          <CenterSocialLinks />
        </footer>
      </div>
      <nav
        className="mobile-bottom-nav"
        aria-label="Asosiy kabinet navigatsiyasi"
      >
        {mobileKeys
          .filter((key) => accessibleSection(user, key))
          .map((key) => {
            const item = navigation
              .flatMap((g) => g.items)
              .find((i) => i[0] === key);
            if (!item) return null;
            const Icon = item[2];
            return (
              <Link
                href={`/kabinet${key ? `/${key}` : ""}`}
                key={key}
                className={active === key ? "active" : ""}
              >
                <Icon size={20} />
                <span>
                  {key === "record-payment"
                    ? "To‘lov"
                    : key === "payments"
                      ? "To‘lovlar"
                      : key === "notifications"
                        ? "Xabarlar"
                        : key === "lessons"
                          ? "Jadval"
                          : item[1]}
                </span>
              </Link>
            );
          })}
        <button disabled={!hydrated} onClick={() => setMenu(true)}>
          <Menu size={20} />
          <span>Yana</span>
        </button>
      </nav>
    </div>
  );
}
