"use client";
import Link from "next/link";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowUpRight, Download, FilePlus2 } from "lucide-react";
import { api, errorText } from "@/lib/api/client";
import { money } from "@/lib/formatting";
import { ErrorBox, Loading, Modal } from "@/components/ui";
import {
  RecordForm,
  FieldControl,
} from "@/features/resources/resource-manager";
import type { Field } from "@/features/resources/config";
import { downloadFinancialReport } from "./download";
export const todayMonth = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tashkent",
    year: "numeric",
    month: "2-digit",
  }).format(new Date());
export const reportFilters: Field[] = [
  { key: "subject", label: "Fan", source: "subjects/" },
  { key: "group", label: "Guruh", source: "groups/" },
  { key: "teacher", label: "Ustoz", source: "staff/teachers/" },
];
export function ReportDashboard({ compact = false }: { compact?: boolean }) {
  const [month, setMonth] = useState(todayMonth);
  const [scope, setScope] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [generate, setGenerate] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const client = useQueryClient();
  const params = new URLSearchParams({ month: `${month}-01`, ...scope });
  const query = useQuery({
    queryKey: ["financial-report", params.toString()],
    queryFn: () =>
      api<Record<string, string | number>>(`reports/financial/?${params}`),
  });
  const data = query.data;
  const cards = [
    ["billed", "Oy uchun hisoblangan", ""],
    ["cash_received", "Shu oy ichida tushgan pul", "payments"],
    ["paid_for_month", "Shu oy hisoblari uchun to‘langan", ""],
    ["remaining", "Hisoblar qoldig‘i", ""],
    ["previous_debt", "Oldingi oylardan qarz", "PREVIOUS"],
    ["overdue_amount", "Muddati o‘tgan summa", "OVERDUE"],
  ] as const;
  async function exportFile() {
    setError("");
    setNotice("");
    setDownloading(true);
    try {
      await downloadFinancialReport(params);
      setNotice(
        "Excel hisobot yuklab olindi. Statistika va barcha tafsilotlar alohida varaqlarda.",
      );
    } catch (e) {
      setError(errorText(e));
    } finally {
      setDownloading(false);
    }
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="breadcrumb">Moliya / Umumiy ko‘rinish</span>
          <h1>{compact ? "Moliyaviy holat" : "Moliyaviy hisobot"}</h1>
          <p>Tushum, hisoblar va qoldiqlarni bir-biridan ajratib kuzating.</p>
        </div>
        <div className="heading-actions">
          <button className="btn secondary" onClick={() => setGenerate(true)}>
            <FilePlus2 size={17} />
            Hisoblar chiqarish
          </button>
          <button className="btn" disabled={downloading} onClick={exportFile}>
            <Download size={17} />
            {downloading ? "Tayyorlanmoqda…" : "Excel eksport"}
          </button>
        </div>
      </div>
      {error && <ErrorBox message={error} />}{" "}
      {notice && (
        <div className="notice success" role="status">
          {notice}
          <Link className="text-link" href="/kabinet/exports">
            Eksportlarni ochish →
          </Link>
        </div>
      )}
      <div className="report-controls">
        <div className="field">
          <label htmlFor="report-month">Hisobot oyi</label>
          <input
            id="report-month"
            type="month"
            required
            value={month}
            onChange={(e) => {
              if (e.target.value) setMonth(e.target.value);
            }}
          />
        </div>
        {!compact &&
          reportFilters.map((f) => (
            <FieldControl
              key={f.key}
              field={f}
              value={scope[f.key] || ""}
              onChange={(v) =>
                setScope((old) =>
                  Object.fromEntries(
                    Object.entries({ ...old, [f.key]: String(v || "") }).filter(
                      ([, value]) => value,
                    ),
                  ),
                )
              }
            />
          ))}
      </div>
      {query.isLoading ? (
        <Loading />
      ) : query.isError ? (
        <ErrorBox
          message={errorText(query.error)}
          retry={() => query.refetch()}
        />
      ) : (
        data && (
          <>
            <div className="metric-grid">
              {cards.map(([key, label, state], i) => (
                <Link
                  className={`metric-card ${i === 0 ? "featured" : ""}`}
                  key={key}
                  href={
                    state === "payments"
                      ? `/kabinet/payments?from=${month}-01&to=${month}-${new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0).getDate()}`
                      : `/kabinet/invoices?${new URLSearchParams({ ...Object.fromEntries(params), ...(state ? { state } : {}) })}`
                  }
                >
                  <span>
                    {label}
                    <ArrowUpRight size={17} />
                  </span>
                  <strong>{money(data[key])}</strong>
                  <small>
                    {key === "cash_received"
                      ? "To‘lovning haqiqiy sanasi bo‘yicha"
                      : key === "paid_for_month"
                        ? "To‘lov sanasidan qat’i nazar"
                        : "Tegishli hisoblarni ko‘rish"}
                  </small>
                </Link>
              ))}
            </div>
            <div className="report-lower">
              <div className="panel">
                <div className="section-heading">
                  <h2>O‘quvchilar to‘lov holati</h2>
                  <span className="muted">{data.student_count} nafar</span>
                </div>
                {(
                  [
                    ["paid_students", "To‘liq to‘laganlar", "PAID", "green"],
                    [
                      "partial_students",
                      "Qisman to‘laganlar",
                      "PARTIAL",
                      "amber",
                    ],
                    [
                      "unpaid_students",
                      "To‘lamagan / belgilanmagan",
                      "UNPAID",
                      "gray",
                    ],
                  ] as const
                ).map(([key, label, state, color]) => (
                  <Link
                    className="chart-row"
                    href={`/kabinet/invoices?${params}&student_state=${state}`}
                    key={key}
                  >
                    <span>
                      {label}
                      <b>{data[key]}</b>
                    </span>
                    <div className="chart-track">
                      <div
                        className={color}
                        style={{
                          width: `${(Number(data[key]) / Math.max(Number(data.student_count), 1)) * 100}%`,
                        }}
                      />
                    </div>
                  </Link>
                ))}
                <p className="muted small-copy">
                  Har bir o‘quvchi tanlangan davrda bir marta sanaladi. Ikki
                  fandan biri to‘langan bo‘lsa umumiy holat qisman to‘langan.
                </p>
              </div>
              <div className="panel summary-panel">
                <h2>E’tibor talab qiladiganlar</h2>
                <Link href={`/kabinet/invoices?${params}&state=PENDING`}>
                  <span>Birinchi hisobi belgilanmagan</span>
                  <strong>{data.pending_first_invoices}</strong>
                  <ArrowUpRight size={18} />
                </Link>
                <Link href={`/kabinet/invoices?${params}&state=OVERDUE`}>
                  <span>Muddati o‘tgan o‘quvchilar</span>
                  <strong>{data.overdue_students}</strong>
                  <ArrowUpRight size={18} />
                </Link>
                <Link href={`/kabinet/invoices?${params}&state=WAITING`}>
                  <span>Muddati kelmagan qoldiq</span>
                  <strong>{data.waiting_students}</strong>
                  <ArrowUpRight size={18} />
                </Link>
                <div className="summary-totals">
                  <span>
                    Jami o‘quvchilar <b>{data.total_students}</b>
                  </span>
                  <span>
                    Faol o‘quvchilar <b>{data.active_students}</b>
                  </span>
                  <span>
                    Tanlangan oy hisoblari <b>{data.invoice_count}</b>
                  </span>
                </div>
              </div>
            </div>
          </>
        )
      )}
      <Modal
        open={generate}
        onClose={() => setGenerate(false)}
        title="Oylik hisoblarni chiqarish"
        description="Faol a’zoliklar tekshiriladi. Birinchi oy summasi avtomatik belgilanmaydi. Takroriy hisob yaratilmaydi."
      >
        <RecordForm
          fields={[
            {
              key: "month",
              label: "Oy (oyning birinchi sanasi)",
              type: "date",
              required: true,
            },
          ]}
          initial={{ id: 0, month: `${month}-01` }}
          onSubmit={async (values) => {
            const response = await api<{ created: number }>(
              "billing/invoices/generate/",
              { method: "POST", body: JSON.stringify(values) },
            );
            setNotice(`${response.created} ta yangi hisob yaratildi.`);
            setGenerate(false);
            await client.invalidateQueries();
          }}
        />
      </Modal>
    </>
  );
}
