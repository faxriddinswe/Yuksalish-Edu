"use client";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  isFinance,
  isAccountantCabinet,
  isStudentCabinet,
  isTeacherCabinet,
  isParentCabinet,
  cabinetRole,
  cabinetTitles,
} from "@/lib/auth/access";
import { StudentGroups } from "@/features/education/student-groups";
import { TeacherGroups } from "@/features/education/teacher-groups";
import { TeacherSchedule } from "@/features/education/teacher-schedule";
import { NotificationCenter } from "@/features/notifications/notification-center";
import {
  StudentPayments,
  StudentPaymentOverview,
} from "@/features/billing/student-payments";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BookOpen,
  CalendarDays,
  ArrowUpRight,
  Bell,
  Clock,
} from "lucide-react";
import { api, errorText } from "@/lib/api/client";
import { money, dateTime, roleLabels } from "@/lib/formatting";
import { Loading, ErrorBox, Empty, Status } from "@/components/ui";
import { resources } from "@/features/resources/config";
import {
  ResourceManager,
  RecordForm,
} from "@/features/resources/resource-manager";
import { accessibleSection } from "@/components/layout/dashboard-shell";
import { ReportDashboard } from "@/features/reports/report-dashboard";
import { ExportCenter } from "@/features/reports/export-center";
import { TeacherFinance } from "@/features/billing/teacher-finance";
import { PaymentForm, OpeningBalance } from "@/features/billing/payment-form";
import { RollCall } from "@/features/education/roll-call";
import { CenterPage, CenterSettings } from "@/features/center";
import type { User, Row, Page } from "@/types";
import { useCabinetUser } from "@/components/layout/cabinet-session";
import { ManagementOverview } from "@/features/management-overview";

export function DashboardPage({
  section,
  initialFilters = {},
}: {
  section: string;
  initialFilters?: Record<string, string>;
}) {
  const user = useCabinetUser();
  return (
    <DashboardContent
      section={section}
      initialFilters={initialFilters}
      user={user}
    />
  );
}
export function DashboardContent({
  section,
  initialFilters = {},
  user,
}: {
  section: string;
  initialFilters?: Record<string, string>;
  user: User;
}) {
  if (!cabinetRole(user) && !["profile", "center"].includes(section))
    return (
      <section className="panel">
        <h1>Rol biriktirilmagan</h1>
        <p>
          Kabinet vazifalarini ochish uchun administratorga murojaat qiling.
        </p>
        <Link href="/kabinet/profile">Profil</Link>
      </section>
    );
  if (section === "invoices" && isStudentCabinet(user))
    redirect("/kabinet/payments");
  if (!accessibleSection(user, section))
    return (
      <div className="panel">
        <span className="eyebrow">403</span>
        <h1>Kirishga ruxsat yo‘q</h1>
        <p>
          Bu bo‘lim uchun vakolatingiz yo‘q. Kerak bo‘lsa markaz rahbariga
          murojaat qiling.
        </p>
        <Link className="btn" href="/kabinet">
          Bosh sahifaga
        </Link>
      </div>
    );
  if (!section)
    return ["OWNER_ADMIN", "ADMINISTRATOR"].includes(cabinetRole(user)) ? (
      <ManagementOverview user={user} />
    ) : isFinance(user) ? (
      <>
        <ReportDashboard compact />
      </>
    ) : (
      <>
        <PersonalOverview user={user} />
      </>
    );
  if (section === "payments" && isStudentCabinet(user))
    return <StudentPayments user={user} />;
  if (section === "groups" && (isStudentCabinet(user) || isParentCabinet(user)))
    return <StudentGroups user={user} />;
  if (isTeacherCabinet(user) && section === "groups")
    return <TeacherGroups user={user} />;
  if (isTeacherCabinet(user) && ["lessons", "attendance"].includes(section))
    return (
      <TeacherSchedule
        user={user}
        attendanceMode={section === "attendance"}
        initialGroup={initialFilters.group}
      />
    );
  if (section === "notifications") return <NotificationCenter user={user} />;
  if (section === "reports") return <ReportDashboard />;
  if (
    section === "teacher-finance" ||
    (section === "teachers" && isAccountantCabinet(user))
  )
    return (
      <TeacherFinance
        user={user}
        initialTeacher={initialFilters.teacher}
        initialMonth={initialFilters.month}
      />
    );
  if (section === "exports") return <ExportCenter />;
  if (section === "record-payment")
    return <PaymentForm user={user} initialStudent={initialFilters.student} />;
  if (section === "opening-balance") return <OpeningBalance />;
  if (section === "roll-call")
    return <RollCall initialLesson={initialFilters.lesson} />;
  if (section === "profile") return <Profile user={user} />;
  if (section === "center") return <CenterPage />;
  if (section === "settings") return <CenterSettings user={user} />;
  if (resources[section])
    return (
      <ResourceManager
        section={section}
        key={section}
        user={user}
        initialFilters={initialFilters}
      />
    );
  return (
    <div className="panel">
      <h1>Sahifa topilmadi</h1>
      <Link className="text-link" href="/kabinet">
        Bosh sahifaga qaytish
      </Link>
    </div>
  );
}
function Profile({ user }: { user: User }) {
  const [notice, setNotice] = useState("");
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Profil va xavfsizlik</h1>
          <p>Akkaunt ma’lumotlari va parolni boshqarish.</p>
        </div>
      </div>
      <div className="detail-grid">
        <div className="panel">
          <div className="profile-summary">
            <span className="avatar large">{user.full_name[0]}</span>
            <h2>{user.full_name}</h2>
            <p>{user.phone}</p>
            <p>{user.roles.map((r) => roleLabels[r]).join(" · ")}</p>
          </div>
          <p className="muted">
            {user.roles.includes("OWNER_ADMIN")
              ? "Akkauntlar va vakolatlarni Xodimlar bo‘limidan boshqaring."
              : "Telefon, rol yoki farzand bog‘lanishini o‘zgartirish uchun markazdagi mas’ul xodimga murojaat qiling."}
          </p>
          <h3>PWA sifatida o‘rnatish</h3>
          <p className="muted">
            Android/Chrome: brauzer menyusidan “Ilovani o‘rnatish”.
            iPhone/Safari: ulashish menyusi → “Bosh ekranga qo‘shish”.
            Qo‘llab-quvvatlash qurilmaga bog‘liq. Shaxsiy ma’lumotlar offline
            saqlanmaydi.
          </p>
        </div>
        <div className="panel">
          <h2>Parolni o‘zgartirish</h2>
          {notice && (
            <div className="notice success" role="status">
              {notice}
            </div>
          )}
          <RecordForm
            fields={[
              {
                key: "old_password",
                label: "Amaldagi parol",
                type: "password",
                required: true,
              },
              {
                key: "new_password",
                label: "Yangi parol (kamida 10 belgi)",
                type: "password",
                required: true,
              },
            ]}
            onSubmit={async (values) => {
              await api("me/", {
                method: "PATCH",
                body: JSON.stringify(values),
              });
              setNotice(
                "Parol o‘zgartirildi. Boshqa qurilmalardagi avvalgi sessiyalar bekor bo‘ladi.",
              );
            }}
          />
        </div>
      </div>
    </>
  );
}
function PersonalOverview({ user }: { user: User }) {
  const isOffice = user.roles.includes("ADMINISTRATOR");
  const isTeacher = user.roles.includes("TEACHER");
  const isParent = user.roles.includes("PARENT");
  const [child, setChild] = useState("");
  const children = useQuery({
    queryKey: ["my-children", user.id],
    queryFn: () => api<Page<Row>>("parents/links/?page_size=50"),
    enabled: isParent,
  });
  const selected =
    child ||
    (children.data?.results[0] ? String(children.data.results[0].student) : "");
  const groups = useQuery({
    queryKey: ["overview-groups", user.id, selected],
    queryFn: () =>
      api<Page<Row>>(
        selected ? `enrollments/?student=${selected}&status=ACTIVE` : "groups/",
      ),
  });
  const lessons = useQuery({
    queryKey: ["overview-lessons", user.id, selected],
    queryFn: () =>
      api<Page<Row>>(
        `lessons/?from=${new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tashkent" }).format(new Date())}&page_size=5${selected ? `&student=${selected}` : ""}`,
      ),
  });
  const notifications = useQuery({
    queryKey: ["overview-notifications", user.id, selected],
    refetchInterval: 60000,
    refetchOnWindowFocus: "always",
    queryFn: () =>
      api<Page<Row>>(
        `notifications/?page_size=5${selected ? `&student=${selected}` : ""}`,
      ),
  });
  const leads = useQuery({
    queryKey: ["overview-leads", user.id],
    queryFn: () => api<Page<Row>>("leads/?status=NEW&page_size=5"),
    enabled: isOffice,
  });
  const invoices = useQuery({
    queryKey: ["overview-invoices", user.id, selected],
    queryFn: () =>
      api<Page<Row>>(
        `billing/invoices/?page_size=5${selected ? `&student=${selected}` : ""}`,
      ),
    enabled: !isOffice && !isTeacher && !isStudentCabinet(user),
  });
  const attendance = useQuery({
    queryKey: ["overview-attendance", user.id, selected],
    queryFn: () =>
      api<Page<Row>>(
        `attendance/?page_size=5${selected ? `&student=${selected}` : ""}`,
      ),
    enabled: !isOffice && !isTeacher && (!isParent || !!selected),
    refetchInterval: 15000,
    refetchOnWindowFocus: "always",
  });
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="breadcrumb">
            Yuksalish Edu / {cabinetTitles[cabinetRole(user)]}
          </span>
          <h1>Assalomu alaykum, {user.full_name.split(" ")[0]}.</h1>
          <p>
            {isOffice
              ? "Bugungi ishlarni bir joyda boshqaring."
              : isTeacher
                ? "Darslaringiz va guruhlaringiz shu yerda."
                : "Ta’lim jadvali, davomat va to‘lovlaringizni kuzating."}
          </p>
        </div>
        <span className="today-label">
          <CalendarDays size={18} />
          {dateTime(new Date().toISOString())}
        </span>
      </div>
      {isParent && (
        <div className="panel child-picker">
          <label htmlFor="child-select">Farzandni tanlang</label>
          <select
            id="child-select"
            value={selected}
            onChange={(e) => setChild(e.target.value)}
          >
            {children.data?.results.map((r) => (
              <option value={String(r.student)} key={r.id}>
                {String(r.student_name)}
              </option>
            ))}
          </select>
          {children.isError && <ErrorBox message={errorText(children.error)} />}{" "}
          {!children.isLoading && !children.data?.count && (
            <p>
              Hozircha farzand biriktirilmagan. Administratorga murojaat qiling.
            </p>
          )}
        </div>
      )}
      <div className="metric-grid personal-metrics">
        <Link href="/kabinet/groups" className="metric-card">
          <span>
            Guruhlar <BookOpen size={19} />
          </span>
          <strong>{groups.data?.count ?? "…"}</strong>
          <small>Ta’lim yo‘nalishlari</small>
        </Link>
        <Link href="/kabinet/lessons" className="metric-card">
          <span>
            Kelgusi darslar <CalendarDays size={19} />
          </span>
          <strong>{lessons.data?.count ?? "…"}</strong>
          <small>Jadvalni ochish</small>
        </Link>
        <Link
          href={isOffice ? "/kabinet/leads" : "/kabinet/notifications"}
          className="metric-card"
        >
          <span>
            {isOffice ? "Yangi murojaatlar" : "Bildirishnomalar"}{" "}
            <Bell size={19} />
          </span>
          <strong>
            {isOffice
              ? (leads.data?.count ?? "…")
              : (notifications.data?.count ?? "…")}
          </strong>
          <small>
            {isOffice ? "Bog‘lanishni kutayotganlar" : "Shaxsiy xabarlar"}
          </small>
        </Link>
      </div>
      <div className="overview-grid">
        <section className="panel">
          <div className="section-heading">
            <h2>Yaqin darslar</h2>
            <Link className="text-link" href="/kabinet/lessons">
              Jadval <ArrowUpRight size={16} />
            </Link>
          </div>
          {lessons.isLoading ? (
            <Loading />
          ) : lessons.isError ? (
            <ErrorBox message={errorText(lessons.error)} />
          ) : !lessons.data?.count ? (
            <Empty text="Rejalashtirilgan darslar yo‘q." />
          ) : (
            lessons.data.results.map((r) => (
              <div className="upcoming-lesson" key={r.id}>
                <div className="date-tile">
                  <Clock size={22} />
                </div>
                <div>
                  <strong>{String(r.group_name)}</strong>
                  <p>
                    {dateTime(r.starts_at)} · {String(r.room_name)}
                  </p>
                  <Status value={r.status} />
                </div>
                {isTeacher && (
                  <Link
                    className="btn secondary"
                    href={`/kabinet/roll-call?lesson=${r.id}`}
                  >
                    Davomat
                  </Link>
                )}
              </div>
            ))
          )}
        </section>
        <section className="panel">
          <h2>{isOffice ? "Tezkor amallar" : "Bildirishnomalar"}</h2>
          {isOffice ? (
            <div className="quick-actions">
              {[
                ["students", "O‘quvchi ro‘yxatga olish"],
                ["parents", "Ota-ona akkaunti"],
                ["enrollments", "Guruhga yozish"],
                ["schedule", "Jadval tuzish"],
                ["staff", "Akkaunt taklifi"],
              ].map(([href, title]) => (
                <Link href={`/kabinet/${href}`} key={href}>
                  {title}
                  <ArrowUpRight size={18} />
                </Link>
              ))}
            </div>
          ) : notifications.isError ? (
            <ErrorBox message={errorText(notifications.error)} />
          ) : notifications.data?.results.length ? (
            notifications.data.results.map((r) => (
              <div className="notification-preview" key={r.id}>
                <strong>{String(r.title)}</strong>
                <p>{String(r.message)}</p>
                <small>{dateTime(r.created_at)}</small>
              </div>
            ))
          ) : (
            <Empty text="Yangi bildirishnomalar yo‘q." />
          )}
        </section>
      </div>
      {!isOffice && !isTeacher && (
        <section className="panel attendance-overview">
          <div className="section-heading">
            <h2>So‘nggi davomat</h2>
            <Link className="text-link" href="/kabinet/attendance">
              Barcha davomat <ArrowUpRight size={16} aria-hidden="true" />
            </Link>
          </div>
          {attendance.isLoading ? (
            <Loading />
          ) : attendance.isError ? (
            <ErrorBox
              message={errorText(attendance.error)}
              retry={() => attendance.refetch()}
            />
          ) : attendance.data?.results.length ? (
            attendance.data.results.map((record) => (
              <div className="attendance-preview" key={record.id}>
                <div>
                  <strong>
                    {String(record.course_name)} · {String(record.group_name)}
                  </strong>
                  <p>
                    {dateTime(record.lesson_date)}
                    {isParent ? ` · ${record.student_name}` : ""}
                  </p>
                </div>
                <Status value={record.status} />
              </div>
            ))
          ) : (
            <Empty text="Saqlangan davomat hali yo‘q. O‘qituvchi belgilagach shu yerda ko‘rinadi." />
          )}
        </section>
      )}
      {isStudentCabinet(user) && <StudentPaymentOverview user={user} />}
      {!isOffice && !isTeacher && !isStudentCabinet(user) && (
        <section className="panel invoices-preview">
          <div className="section-heading">
            <h2>Hisoblar holati</h2>
            <Link
              className="text-link"
              href={`/kabinet/invoices${selected ? `?student=${selected}` : ""}`}
            >
              Barcha hisoblar <ArrowUpRight size={16} />
            </Link>
          </div>
          {invoices.isError ? (
            <ErrorBox message={errorText(invoices.error)} />
          ) : invoices.data?.results.length ? (
            <div className="invoice-cards">
              {invoices.data.results.map((r) => (
                <article key={r.id}>
                  <strong>{String(r.subject_name)}</strong>
                  <p>{dateTime(r.month)}</p>
                  <Status value={r.payment_state} />
                  <div>
                    Qoldiq <b>{money(r.balance)}</b>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <Empty text="Hisoblar hali chiqarilmagan." />
          )}
        </section>
      )}
    </>
  );
}
