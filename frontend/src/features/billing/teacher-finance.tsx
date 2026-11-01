"use client";
import { isFinance } from "@/lib/auth/access";

import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowUpRight,
  Plus,
  Users,
  GraduationCap,
  Wallet,
} from "lucide-react";
import { api, errorText } from "@/lib/api/client";
import { dateTime, money } from "@/lib/formatting";
import { tashkentDay } from "@/lib/formatting/calendar";
import { ErrorBox, Empty, Loading, Modal, Status } from "@/components/ui";
import { useDebounce } from "@/features/resources/resource-manager";
import { ListPagination } from "@/features/education/teacher-groups";
import { todayMonth } from "@/features/reports/report-dashboard";
import type { Page, User } from "@/types";

type Teacher = {
  id: number;
  full_name: string;
  phone: string;
  is_active: boolean;
  account_active: boolean;
  subject_names: string[];
  student_count: number;
  group_count: number;
  paid_for_month: string;
  total_paid: string;
};
type Payout = {
  id: number;
  teacher_name: string;
  amount: string;
  month: string;
  paid_on: string;
  status: string;
  note: string;
  entered_by_name: string;
  void_reason: string;
};

export function TeacherFinance({
  user,
  initialTeacher = "",
  initialMonth,
}: {
  user: User;
  initialTeacher?: string;
  initialMonth?: string;
}) {
  const [month, setMonth] = useState(initialMonth?.slice(0, 7) || todayMonth());
  const [selected, setSelected] = useState(initialTeacher);
  const [search, setSearch] = useState("");
  const term = useDebounce(search.trim(), 180);
  const [page, setPage] = useState(1);
  const [historyPage, setHistoryPage] = useState(1);
  const [allMonths, setAllMonths] = useState(false);
  const [form, setForm] = useState(false);
  const [notice, setNotice] = useState("");
  const [voiding, setVoiding] = useState<Payout | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ["teacher-finance", month, term, page],
    queryFn: ({ signal }) =>
      api<Page<Teacher>>(
        `staff/teacher-finance/?${new URLSearchParams({ month: `${month}-01`, search: term, page: String(page) })}`,
        { signal },
      ),
    enabled: !selected,
  });
  const detail = useQuery({
    queryKey: ["teacher-finance-detail", selected, month],
    queryFn: () =>
      api<Teacher>(`staff/teacher-finance/${selected}/?month=${month}-01`),
    enabled: !!selected,
  });
  const history = useQuery({
    queryKey: ["teacher-payouts", selected, month, allMonths, historyPage],
    queryFn: () =>
      api<Page<Payout>>(
        `billing/teacher-payments/?${new URLSearchParams({ teacher: selected, page: String(historyPage), ...(allMonths ? {} : { month: `${month}-01` }) })}`,
      ),
    enabled: !!selected,
  });
  const teacher = detail.data;
  const canCorrect =
    isFinance(user) ||
    user.extra_permissions.includes("billing.correct_finance");
  async function refresh() {
    await client.invalidateQueries();
  }
  function choose(id: number) {
    setSelected(String(id));
    setHistoryPage(1);
    setNotice("");
  }
  return (
    <>
      {selected && (
        <button
          className="btn secondary back-to-groups"
          onClick={() => {
            setSelected("");
            setNotice("");
          }}
        >
          <ArrowLeft size={18} aria-hidden="true" />
          Ustozlarga qaytish
        </button>
      )}
      <div className="page-heading">
        <div>
          <span className="breadcrumb">Moliya / Ustozlar</span>
          <h1>
            {selected ? teacher?.full_name || "Ustoz to‘lovlari" : "Ustozlar"}
          </h1>
          <p>
            Ustozga berilgan oylik va avanslar, to‘lov sanalari va faol
            o‘quvchilar soni.
          </p>
        </div>
        {teacher && (
          <button
            className="btn"
            disabled={!teacher.is_active || !teacher.account_active}
            onClick={() => setForm(true)}
          >
            <Plus size={18} aria-hidden="true" />
            Ustozga to‘lov kiritish
          </button>
        )}
      </div>
      {notice && (
        <div className="notice success" role="status">
          {notice}
        </div>
      )}
      <div className="panel teacher-finance-controls">
        <div className="field">
          <label htmlFor="teacher-payment-month">To‘lov davri</label>
          <input
            id="teacher-payment-month"
            type="month"
            value={month}
            onChange={(event) => {
              if (event.target.value) {
                setMonth(event.target.value);
                setHistoryPage(1);
              }
            }}
          />
        </div>
        {!selected && (
          <div className="field">
            <label htmlFor="teacher-finance-search">
              Ustoz ismi yoki telefoni
            </label>
            <input
              id="teacher-finance-search"
              type="search"
              value={search}
              placeholder="Ustozni qidirish…"
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
            />
          </div>
        )}
        {selected && (
          <label className="checkbox">
            <input
              type="checkbox"
              checked={allMonths}
              onChange={(event) => {
                setAllMonths(event.target.checked);
                setHistoryPage(1);
              }}
            />
            Barcha oylar tarixi
          </label>
        )}
      </div>
      {!selected ? (
        query.isLoading ? (
          <Loading />
        ) : query.isError ? (
          <ErrorBox
            message={errorText(query.error)}
            retry={() => query.refetch()}
          />
        ) : !query.data?.results.length ? (
          <Empty text="Ustoz topilmadi. Qidiruvni o‘zgartiring." />
        ) : (
          <>
            <p className="muted">
              {query.data.count} ta ustoz · Faol o‘quvchilar bugungi holat
              bo‘yicha noyob odamlar sifatida sanaladi.
            </p>
            <div className="teacher-finance-grid">
              {query.data.results.map((item) => (
                <article className="panel teacher-finance-card" key={item.id}>
                  <div className="teacher-finance-heading">
                    <span className="avatar">{item.full_name[0]}</span>
                    <div>
                      <h2>{item.full_name}</h2>
                      <p>
                        {item.subject_names.join(" · ") ||
                          "Fan biriktirilmagan"}
                      </p>
                      <small>{item.phone}</small>
                    </div>
                  </div>
                  {(!item.is_active || !item.account_active) && (
                    <Status value="INACTIVE" />
                  )}
                  <dl>
                    <div>
                      <dt>
                        <Users size={16} aria-hidden="true" />
                        Faol o‘quvchilar
                      </dt>
                      <dd>{item.student_count}</dd>
                    </div>
                    <div>
                      <dt>
                        <GraduationCap size={16} aria-hidden="true" />
                        Faol guruhlar
                      </dt>
                      <dd>{item.group_count}</dd>
                    </div>
                    <div>
                      <dt>
                        <Wallet size={16} aria-hidden="true" />
                        Tanlangan oy uchun berilgan
                      </dt>
                      <dd>{money(item.paid_for_month)}</dd>
                    </div>
                  </dl>
                  <button
                    className="btn secondary full-width"
                    onClick={() => choose(item.id)}
                  >
                    To‘lovlar va tarix
                    <ArrowUpRight size={17} aria-hidden="true" />
                  </button>
                </article>
              ))}
            </div>
            <ListPagination data={query.data} page={page} onChange={setPage} />
          </>
        )
      ) : detail.isLoading ? (
        <Loading />
      ) : detail.isError ? (
        <ErrorBox
          message={errorText(detail.error)}
          retry={() => detail.refetch()}
        />
      ) : (
        teacher && (
          <>
            <div className="accounting-metrics">
              <article className="panel">
                <span>Faol o‘quvchilar</span>
                <strong>{teacher.student_count}</strong>
                <small>
                  {teacher.group_count} ta faol guruh · noyob odamlar
                </small>
              </article>
              <article className="panel">
                <span>Tanlangan oy uchun berilgan</span>
                <strong>{money(teacher.paid_for_month)}</strong>
                <small>{dateTime(`${month}-01`)} davri</small>
              </article>
              <article className="panel">
                <span>Barcha davrda berilgan</span>
                <strong>{money(teacher.total_paid)}</strong>
                <small>Bekor qilingan to‘lovlarsiz</small>
              </article>
            </div>
            <section className="panel">
              <div className="section-heading">
                <h2>To‘lovlar tarixi</h2>
                <span className="muted">
                  {history.data?.count || 0} ta yozuv
                </span>
              </div>
              {history.isLoading ? (
                <Loading />
              ) : history.isError ? (
                <ErrorBox
                  message={errorText(history.error)}
                  retry={() => history.refetch()}
                />
              ) : !history.data?.results.length ? (
                <Empty text="Bu davr uchun to‘lov yozilmagan." />
              ) : (
                <div className="teacher-payout-list">
                  {history.data.results.map((payment) => (
                    <article className="teacher-payout-row" key={payment.id}>
                      <div>
                        <strong>{money(payment.amount)}</strong>
                        <Status value={payment.status} />
                        <dl>
                          <div>
                            <dt>Haqiqiy to‘lov sanasi</dt>
                            <dd>{dateTime(payment.paid_on)}</dd>
                          </div>
                          <div>
                            <dt>To‘lov davri</dt>
                            <dd>{dateTime(payment.month)}</dd>
                          </div>
                          <div>
                            <dt>Kiritgan xodim</dt>
                            <dd>{payment.entered_by_name}</dd>
                          </div>
                        </dl>
                        {payment.note && (
                          <p className="payout-note">{payment.note}</p>
                        )}
                        {payment.void_reason && (
                          <p className="payout-note">
                            Bekor qilish sababi: {payment.void_reason}
                          </p>
                        )}
                      </div>
                      {payment.status === "POSTED" && canCorrect && (
                        <button
                          className="btn secondary"
                          onClick={() => {
                            setVoiding(payment);
                            setReason("");
                            setError("");
                          }}
                        >
                          Bekor qilish
                        </button>
                      )}
                    </article>
                  ))}
                </div>
              )}
              {history.data && (
                <ListPagination
                  data={history.data}
                  page={historyPage}
                  onChange={setHistoryPage}
                />
              )}
            </section>
            <p className="muted">
              Bu yerda haqiqatan berilgan pullar qayd etiladi. Oylik stavkasi,
              hisoblangan ish haqi yoki qarz avtomatik aniqlanmaydi.
            </p>
          </>
        )
      )}
      {teacher && form && (
        <PayoutForm
          teacher={teacher}
          month={month}
          onClose={() => setForm(false)}
          onSaved={async () => {
            setForm(false);
            setNotice("Ustoz to‘lovi saqlandi.");
            await refresh();
          }}
        />
      )}
      <Modal
        open={!!voiding}
        onClose={() => {
          if (!busy) setVoiding(null);
        }}
        title="Ustoz to‘lovini bekor qilish"
        description="Yozuv tarixda saqlanadi va jami summalardan chiqariladi."
      >
        <form
          onSubmit={async (event) => {
            event.preventDefault();
            if (!voiding) return;
            setBusy(true);
            setError("");
            try {
              await api(`billing/teacher-payments/${voiding.id}/void/`, {
                method: "POST",
                body: JSON.stringify({ reason }),
              });
              setVoiding(null);
              setNotice("To‘lov bekor qilindi; tarixi saqlandi.");
              await refresh();
            } catch (error) {
              setError(errorText(error));
            } finally {
              setBusy(false);
            }
          }}
        >
          <div className="field">
            <label htmlFor="payout-void-reason">Bekor qilish sababi</label>
            <textarea
              id="payout-void-reason"
              required
              maxLength={2000}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          </div>
          {error && <ErrorBox message={error} />}
          <button className="btn" disabled={busy || !reason.trim()}>
            {busy ? "Saqlanmoqda…" : "Bekor qilishni tasdiqlash"}
          </button>
        </form>
      </Modal>
    </>
  );
}

function PayoutForm({
  teacher,
  month,
  onClose,
  onSaved,
}: {
  teacher: Teacher;
  month: string;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [period, setPeriod] = useState(month);
  const [paidOn, setPaidOn] = useState(tashkentDay);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [review, setReview] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const requests = useRef<Record<string, string>>({});
  async function submit() {
    setBusy(true);
    setError("");
    const body = JSON.stringify({
      teacher: teacher.id,
      month: `${period}-01`,
      paid_on: paidOn,
      amount,
      note,
    });
    const key = requests.current[body] || crypto.randomUUID();
    requests.current[body] = key;
    try {
      await api("billing/teacher-payments/", {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body,
      });
      await onSaved();
    } catch (error) {
      setError(errorText(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      open
      onClose={() => {
        if (!busy) onClose();
      }}
      title="Ustozga to‘lov kiritish"
      description={`${teacher.full_name} uchun berilgan oylik yoki avansni qayd eting.`}
    >
      {review ? (
        <>
          <dl className="detail-list">
            <div>
              <dt>Ustoz</dt>
              <dd>{teacher.full_name}</dd>
            </div>
            <div>
              <dt>Summa</dt>
              <dd className="price">{money(amount)}</dd>
            </div>
            <div>
              <dt>To‘lov davri</dt>
              <dd>{dateTime(`${period}-01`)}</dd>
            </div>
            <div>
              <dt>Haqiqiy sana</dt>
              <dd>{dateTime(paidOn)}</dd>
            </div>
            {note && (
              <div>
                <dt>Izoh</dt>
                <dd>{note}</dd>
              </div>
            )}
          </dl>
          {error && <ErrorBox message={error} />}
          <div className="heading-actions">
            <button
              className="btn secondary"
              disabled={busy}
              onClick={() => setReview(false)}
            >
              Tahrirlash
            </button>
            <button className="btn" disabled={busy} onClick={submit}>
              {busy ? "Saqlanmoqda…" : "Tasdiqlash va saqlash"}
            </button>
          </div>
        </>
      ) : (
        <form
          className="payout-form"
          onSubmit={(event) => {
            event.preventDefault();
            setReview(true);
          }}
        >
          <div className="field">
            <label htmlFor="payout-period">To‘lov davri</label>
            <input
              id="payout-period"
              type="month"
              required
              value={period}
              onChange={(event) => setPeriod(event.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="payout-date">Haqiqiy to‘lov sanasi</label>
            <input
              id="payout-date"
              type="date"
              required
              max={tashkentDay()}
              value={paidOn}
              onChange={(event) => setPaidOn(event.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="payout-amount">Summa (so‘m)</label>
            <input
              id="payout-amount"
              type="number"
              required
              min="0.01"
              max="999999999999.99"
              step="0.01"
              inputMode="decimal"
              placeholder="Masalan, 1500000"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="payout-note">Izoh / oylik yoki avans</label>
            <textarea
              id="payout-note"
              maxLength={500}
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
          </div>
          <button className="btn full-width">To‘lovni tekshirish</button>
        </form>
      )}
    </Modal>
  );
}
