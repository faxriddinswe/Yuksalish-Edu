"use client";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { api, errorText } from "@/lib/api/client";
import { money } from "@/lib/formatting";
import { ErrorBox, Loading } from "@/components/ui";
import { cabinetRole, cabinetTitles } from "@/lib/auth/access";
import type { User } from "@/types";
type Overview = {
  students_total: number;
  students_active: number;
  groups_active: number;
  teachers_active: number;
  pending_leads: number;
  lessons_today: number;
  certified_students: number;
  financial_summary?: {
    billed: string;
    cash_received: string;
    remaining: string;
  };
};
export function ManagementOverview({ user }: { user: User }) {
  const owner = cabinetRole(user) === "OWNER_ADMIN";
  const query = useQuery({
    queryKey: ["center-overview", user.id],
    queryFn: () => api<Overview>("overview/"),
  });
  if (query.isPending) return <Loading />;
  if (query.isError)
    return (
      <ErrorBox
        message={errorText(query.error)}
        retry={() => query.refetch()}
      />
    );
  const data = query.data;
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">{cabinetTitles[cabinetRole(user)]}</span>
          <h1>
            {owner ? "Markazning umumiy holati" : "Qabul va ta’lim boshqaruvi"}
          </h1>
          <p>
            {user.full_name} ·{" "}
            {owner
              ? "Markaz faoliyati, ta’lim va moliyaviy natijalarni kuzating."
              : "Murojaatlar, ro‘yxatga olish, darslar va sayt kontenti."}
          </p>
        </div>
      </div>
      <div className="metric-grid">
        {(
          [
            ["students", "Jami o‘quvchilar", data.students_total],
            ["groups", "Faol guruhlar", data.groups_active],
            ["teachers", "Faol ustozlar", data.teachers_active],
            ["leads", "Yangi murojaatlar", data.pending_leads],
            ["lessons", "Bugungi darslar", data.lessons_today],
            [
              "students?has_certificate=true",
              "Sertifikat olganlar",
              data.certified_students,
            ],
          ] as const
        ).map(([path, title, count]) => (
          <Link key={path} href={`/kabinet/${path}`} className="metric-card">
            <span>{title}</span>
            <strong>{count}</strong>
          </Link>
        ))}
      </div>
      {owner && data.financial_summary && (
        <section className="panel">
          <div className="section-heading">
            <h2>Joriy oy moliyasi</h2>
            <Link className="text-link" href="/kabinet/reports">
              Moliyaviy hisobot
            </Link>
          </div>
          <div className="metric-grid">
            {(
              [
                ["Hisoblangan", data.financial_summary.billed],
                ["Tushum", data.financial_summary.cash_received],
                ["Qoldiq", data.financial_summary.remaining],
              ] as const
            ).map(([title, value]) => (
              <div className="metric-card" key={title}>
                <span>{title}</span>
                <strong>{money(value)}</strong>
              </div>
            ))}
          </div>
        </section>
      )}
      <section className="panel">
        <h2>{owner ? "Rahbar nazorati" : "Tezkor amallar"}</h2>
        <div className="quick-actions">
          {(owner
            ? [
                ["reports", "Moliyaviy holat"],
                ["audit", "Amallar tarixi"],
                ["staff", "Xodimlar va vakolatlar"],
              ]
            : [
                ["students", "O‘quvchi ro‘yxatga olish"],
                ["enrollments", "Guruhga yozish"],
                ["schedule", "Jadval tuzish"],
                ["staff", "Akkauntlar"],
                ["achievements", "Sertifikatlar"],
              ]
          ).map(([path, title]) => (
            <Link key={path} href={`/kabinet/${path}`}>
              {title}
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}
