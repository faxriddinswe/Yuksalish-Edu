"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, FileSpreadsheet, Check } from "lucide-react";
import { api, errorText } from "@/lib/api/client";
import { money } from "@/lib/formatting";
import { ErrorBox, Loading } from "@/components/ui";
import {
  FieldControl,
  useDebounce,
} from "@/features/resources/resource-manager";
import { downloadFinancialReport } from "./download";
import { reportFilters, todayMonth } from "./report-dashboard";

const contents = [
  ["Statistika", "Dashboarddagi barcha sonlar va summalar"],
  ["Hisoblar", "Har bir fan va oy uchun hisob, to‘lov va qoldiq"],
  ["O‘quvchilar", "Har o‘quvchining jami summasi va to‘lov holati"],
  ["Tushumlar", "Haqiqiy to‘lov sanasi va fan bo‘yicha taqsimot"],
  ["Oldingi qarz", "Oldingi oylardan qolgan ochiq hisoblar"],
  ["Tuzatishlar", "Hisob summasiga kiritilgan o‘zgarish va sabablar"],
  [
    "Ustozlar — davr / sana",
    "Ustoz to‘lovlari oy va haqiqiy to‘lov sanasi bo‘yicha alohida",
  ],
  ["Izohlar", "Filtrlar va ko‘rsatkichlarning aniq ma’nosi"],
];

export function ExportCenter() {
  const [month, setMonth] = useState(todayMonth);
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [search, setSearch] = useState("");
  const debounced = useDebounce(search.trim(), 180);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const params = new URLSearchParams({
    month: `${month}-01`,
    ...filters,
    ...(debounced ? { search: debounced } : {}),
  });
  const preview = useQuery({
    queryKey: ["financial-report", params.toString()],
    queryFn: ({ signal }) =>
      api<Record<string, string | number>>(`reports/financial/?${params}`, {
        signal,
      }),
  });
  async function download() {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await downloadFinancialReport(params);
      setNotice(
        "Excel hisobot yuklab olindi. Sonlar, sanalar va summalar faylda alohida ustunlarda saqlandi.",
      );
    } catch (error) {
      setError(errorText(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="breadcrumb">Moliya / Excel</span>
          <h1>Excel hisobotlar</h1>
          <p>
            Statistika va uning tafsilotlari bazadan bitta Excel faylga olinadi.
          </p>
        </div>
        <button
          className="btn"
          disabled={busy || preview.isError || search.trim() !== debounced}
          onClick={download}
        >
          <Download size={18} aria-hidden="true" />
          {busy ? "Hisobot tayyorlanmoqda…" : "Excel yuklab olish"}
        </button>
      </div>
      {error && <ErrorBox message={error} />}
      {notice && (
        <div className="notice success" role="status">
          {notice}
        </div>
      )}
      <section
        className="panel export-filters"
        aria-label="Excel hisobot filtrlari"
      >
        <div className="section-heading">
          <h2>Hisobotni tanlang</h2>
          <button
            className="text-link"
            onClick={() => {
              setFilters({});
              setSearch("");
            }}
          >
            Filtrlarni tozalash
          </button>
        </div>
        <div className="report-controls">
          <div className="field">
            <label htmlFor="export-month">Hisobot oyi</label>
            <input
              id="export-month"
              type="month"
              value={month}
              onChange={(event) => {
                if (event.target.value) setMonth(event.target.value);
              }}
            />
          </div>
          {reportFilters.map((field) => (
            <FieldControl
              key={field.key}
              field={field}
              value={filters[field.key] || ""}
              onChange={(value) =>
                setFilters((old) =>
                  Object.fromEntries(
                    Object.entries({
                      ...old,
                      [field.key]: String(value || ""),
                    }).filter(([, value]) => value),
                  ),
                )
              }
            />
          ))}
          <div className="field">
            <label htmlFor="export-search">O‘quvchi ismi yoki telefoni</label>
            <input
              id="export-search"
              type="search"
              placeholder="Barcha o‘quvchilar"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
        </div>
      </section>
      {preview.isLoading ? (
        <Loading />
      ) : preview.isError ? (
        <ErrorBox
          message={errorText(preview.error)}
          retry={() => preview.refetch()}
        />
      ) : (
        preview.data && (
          <div className="accounting-metrics">
            <article className="panel">
              <span>Tanlangan hisoblar</span>
              <strong>{preview.data.invoice_count}</strong>
              <small>{preview.data.student_count} nafar o‘quvchi</small>
            </article>
            <article className="panel">
              <span>Shu oy tushumi</span>
              <strong>{money(preview.data.cash_received)}</strong>
              <small>Haqiqiy to‘lov sanasi bo‘yicha</small>
            </article>
            <article className="panel">
              <span>Hisoblar qoldig‘i</span>
              <strong>{money(preview.data.remaining)}</strong>
              <small>Tanlangan oy uchun</small>
            </article>
          </div>
        )
      )}
      <section className="panel export-contents">
        <div className="section-heading">
          <h2>Fayl ichidagi varaqlar</h2>
          <FileSpreadsheet size={24} aria-hidden="true" />
        </div>
        <div className="export-sheet-grid">
          {contents.map(([title, description]) => (
            <div key={title}>
              <Check size={18} aria-hidden="true" />
              <span>
                <strong>{title}</strong>
                <small>{description}</small>
              </span>
            </div>
          ))}
        </div>
        <p className="muted">
          Faylda summalar hisoblash mumkin bo‘lgan sonlar sifatida saqlanadi.
          Bekor qilingan to‘lovlar tushumga qo‘shilmaydi. Yuklab olish vaqtida
          bazadagi eng so‘nggi holat olinadi.
        </p>
      </section>
    </>
  );
}
