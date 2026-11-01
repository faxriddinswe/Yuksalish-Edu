"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowUpRight,
  CalendarDays,
  CreditCard,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  Clock,
  TriangleAlert,
} from "lucide-react";
import { api, errorText } from "@/lib/api/client";
import { dateTime, money } from "@/lib/formatting";
import { Loading, ErrorBox, Empty, Status } from "@/components/ui";
import type { Page, User } from "@/types";

export type PersonalPaymentSummary = {
  invoice_count: number;
  pending_count: number;
  balance: string;
  overdue_balance: string;
  upcoming_balance: string;
  subjects: { id: number; name: string }[];
};
type PaymentAllocation = {
  invoice: number;
  amount: string;
  subject: number;
  subject_name: string;
  month: string;
  course_names: string[];
};
type PersonalPayment = {
  id: number;
  amount: string;
  paid_on: string;
  status: "POSTED" | "VOID";
  allocations: PaymentAllocation[];
};

export function paymentSummaryMessage(data: PersonalPaymentSummary) {
  if (Number(data.overdue_balance) > 0) return "Muddati o‘tgan qarzingiz bor";
  if (Number(data.balance) > 0) return "To‘lov kutilmoqda";
  if (data.pending_count) return "To‘lov summasi belgilanishi kutilmoqda";
  if (!data.invoice_count) return "To‘lov holati hali shakllanmagan";
  return "Qarzdorlik yo‘q";
}
function usePaymentSummary(userId: number, subject = "") {
  return useQuery({
    queryKey: ["personal-payment-summary", userId, subject],
    queryFn: () =>
      api<PersonalPaymentSummary>(
        `billing/payments/summary/${subject ? `?subject=${subject}` : ""}`,
      ),
  });
}
function periodLabel(value: string) {
  const [year, month] = value.split("-");
  const months = [
    "yanvar",
    "fevral",
    "mart",
    "aprel",
    "may",
    "iyun",
    "iyul",
    "avgust",
    "sentabr",
    "oktabr",
    "noyabr",
    "dekabr",
  ];
  return `${year}-yil ${months[Number(month) - 1]}`;
}
export function PaymentBalance({ data }: { data: PersonalPaymentSummary }) {
  const overdue = Number(data.overdue_balance) > 0;
  const waiting =
    Number(data.balance) > 0 || data.pending_count > 0 || !data.invoice_count;
  const Icon = overdue ? TriangleAlert : waiting ? Clock : CircleCheck;
  return (
    <section
      className="panel student-balance"
      aria-label="To‘lov va qarzdorlik holati"
    >
      <div
        className={`balance-status ${overdue ? "overdue" : waiting ? "waiting" : "clear"}`}
      >
        <Icon size={23} aria-hidden="true" />
        <h2>{paymentSummaryMessage(data)}</h2>
      </div>
      <div className="student-balance-metrics">
        <div>
          <span>Jami qolgan summa</span>
          <strong>{money(data.balance)}</strong>
        </div>
        <div>
          <span>Muddati o‘tgan qarz</span>
          <strong>{money(data.overdue_balance)}</strong>
        </div>
        <div>
          <span>Muddati kelmagan qoldiq</span>
          <strong>{money(data.upcoming_balance)}</strong>
        </div>
      </div>
      {data.pending_count > 0 && (
        <p className="notice pending-payment-note">
          <strong>
            {data.pending_count} ta fan/davr uchun summa hali belgilanmagan.
          </strong>{" "}
          Buxgalter belgilagach umumiy holatga qo‘shiladi. Yuqoridagi summalar
          faqat tasdiqlangan ma’lumotlarni qamrab oladi.
        </p>
      )}
      {!data.invoice_count && (
        <p className="muted">
          Markaz hali to‘lov ma’lumotlarini kiritmagan. Holatni administrator
          bilan aniqlashtiring.
        </p>
      )}
    </section>
  );
}
export function StudentPaymentOverview({ user }: { user: User }) {
  const summary = usePaymentSummary(user.id);
  return (
    <div className="student-payments-overview">
      <div className="section-heading">
        <h2>To‘lov holati</h2>
        <Link className="text-link" href="/kabinet/payments">
          To‘lovlar tarixi
          <ArrowUpRight size={17} aria-hidden="true" />
        </Link>
      </div>
      {summary.isLoading ? (
        <Loading />
      ) : summary.isError ? (
        <ErrorBox
          message={errorText(summary.error)}
          retry={() => summary.refetch()}
        />
      ) : (
        <PaymentBalance data={summary.data!} />
      )}
    </div>
  );
}
export function StudentPayments({ user }: { user: User }) {
  const [subject, setSubject] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const summary = usePaymentSummary(user.id, subject);
  const params = new URLSearchParams({
    page: String(page),
    ...(subject ? { subject } : {}),
    ...(from ? { from } : {}),
    ...(to ? { to } : {}),
    ...(status ? { status } : {}),
  });
  const history = useQuery({
    queryKey: ["personal-payment-history", user.id, params.toString()],
    queryFn: () => api<Page<PersonalPayment>>(`billing/payments/?${params}`),
  });
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="breadcrumb">Shaxsiy kabinet / To‘lovlar</span>
          <h1>To‘lovlar tarixi</h1>
          <p>Qachon, qaysi kursga va qancha to‘laganingizni kuzating.</p>
        </div>
      </div>
      <div
        className="panel student-payment-filters"
        aria-label="To‘lovlar filtrlari"
      >
        <div className="field">
          <label htmlFor="payment-subject">Kurs / fan</label>
          <select
            id="payment-subject"
            value={subject}
            onChange={(event) => {
              setSubject(event.target.value);
              setPage(1);
            }}
          >
            <option value="">Barcha kurslar</option>
            {summary.data?.subjects.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="payment-from">To‘lov sanasidan</label>
          <input
            id="payment-from"
            type="date"
            value={from}
            max={to || undefined}
            onChange={(event) => {
              setFrom(event.target.value);
              setPage(1);
            }}
          />
        </div>
        <div className="field">
          <label htmlFor="payment-to">To‘lov sanasigacha</label>
          <input
            id="payment-to"
            type="date"
            value={to}
            min={from || undefined}
            onChange={(event) => {
              setTo(event.target.value);
              setPage(1);
            }}
          />
        </div>
        <div className="field">
          <label htmlFor="payment-status">To‘lov holati</label>
          <select
            id="payment-status"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              setPage(1);
            }}
          >
            <option value="">Barchasi</option>
            <option value="POSTED">Kiritilgan</option>
            <option value="VOID">Bekor qilingan</option>
          </select>
        </div>
        <button
          className="btn secondary"
          onClick={() => {
            setSubject("");
            setFrom("");
            setTo("");
            setStatus("");
            setPage(1);
          }}
        >
          Filtrlarni tozalash
        </button>
      </div>
      <p className="muted balance-scope">
        {subject ? "Tanlangan kurs bo‘yicha" : "Barcha kurslar bo‘yicha"} qoldiq
        barcha davrlarni qamrab oladi. Sana va holat filtrlari quyidagi
        to‘lovlar tarixiga qo‘llanadi.
      </p>
      {summary.isLoading ? (
        <Loading />
      ) : summary.isError ? (
        <ErrorBox
          message={errorText(summary.error)}
          retry={() => summary.refetch()}
        />
      ) : (
        <PaymentBalance data={summary.data!} />
      )}
      <section
        className="payment-history-section"
        aria-label="Amalga oshirilgan to‘lovlar"
      >
        <div className="section-heading">
          <h2>Amalga oshirilgan to‘lovlar</h2>
          <span className="muted">{history.data?.count ?? "…"} ta to‘lov</span>
        </div>
        {history.isLoading ? (
          <Loading />
        ) : history.isError ? (
          <ErrorBox
            message={errorText(history.error)}
            retry={() => history.refetch()}
          />
        ) : !history.data?.count ? (
          <Empty text="Bu tanlov bo‘yicha to‘lovlar topilmadi. Hali to‘lamagan bo‘lsangiz, qoldiq holatini yuqorida ko‘rishingiz mumkin." />
        ) : (
          <div className="student-payment-list">
            {history.data.results.map((payment) => (
              <article
                className={`panel student-payment-card ${payment.status === "VOID" ? "void-payment" : ""}`}
                key={payment.id}
              >
                <header>
                  <div className="payment-receipt-title">
                    <span className="feature-icon">
                      <CreditCard size={22} aria-hidden="true" />
                    </span>
                    <div>
                      <span>Jami to‘lov</span>
                      <h3>{money(payment.amount)}</h3>
                    </div>
                  </div>
                  <Status value={payment.status} />
                </header>
                <p className="payment-paid-on">
                  <CalendarDays size={17} aria-hidden="true" />
                  <span>
                    To‘lov sanasi:{" "}
                    <time dateTime={payment.paid_on}>
                      {dateTime(payment.paid_on)}
                    </time>
                  </span>
                </p>
                <ul
                  className="payment-allocation-list"
                  aria-label="To‘lov qilingan kurslar"
                >
                  {payment.allocations.map((allocation) => (
                    <li key={allocation.invoice}>
                      <div>
                        <strong>
                          {allocation.course_names.length
                            ? allocation.course_names.join(" · ")
                            : allocation.subject_name}
                        </strong>
                        <span>
                          {allocation.subject_name} ·{" "}
                          {periodLabel(allocation.month)}
                        </span>
                      </div>
                      <strong>{money(allocation.amount)}</strong>
                    </li>
                  ))}
                </ul>
                {payment.status === "VOID" && (
                  <p className="muted">
                    Bu to‘lov bekor qilingan va qarzni qoplashga hisoblanmaydi.
                  </p>
                )}
              </article>
            ))}
          </div>
        )}
        {history.data && (history.data.next || history.data.previous) && (
          <nav className="pagination" aria-label="To‘lovlar sahifalari">
            <span>{page}-sahifa</span>
            <button
              className="icon-btn"
              disabled={!history.data.previous}
              onClick={() => setPage(page - 1)}
              aria-label="Oldingi sahifa"
            >
              <ChevronLeft aria-hidden="true" />
            </button>
            <button
              className="icon-btn"
              disabled={!history.data.next}
              onClick={() => setPage(page + 1)}
              aria-label="Keyingi sahifa"
            >
              <ChevronRight aria-hidden="true" />
            </button>
          </nav>
        )}
      </section>
    </>
  );
}
