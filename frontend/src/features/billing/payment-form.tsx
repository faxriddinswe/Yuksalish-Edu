"use client";
import { isFinance } from "@/lib/auth/access";
import { useState, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, errorText } from "@/lib/api/client";
import { money, dateTime } from "@/lib/formatting";
import { RecordForm } from "@/features/resources/resource-manager";
import { Modal, ErrorBox, Loading, Empty } from "@/components/ui";
import type { Page, Row, User } from "@/types";
import { StudentPicker } from "./student-picker";
function localDay() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tashkent",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
export function sumAmounts(values: string[]) {
  let cents = 0n;
  for (const value of values) {
    if (!/^\d+(\.\d{1,2})?$/.test(value)) continue;
    const [a, b = ""] = value.split(".");
    cents += BigInt(a) * 100n + BigInt(b.padEnd(2, "0"));
  }
  return `${cents / 100n}.${String(cents % 100n).padStart(2, "0")}`;
}
export function PaymentForm({
  user,
  initialStudent = "",
}: {
  user: User;
  initialStudent?: string;
}) {
  const [student, setStudent] = useState(initialStudent);
  const [mode, setMode] = useState("quick");
  const [amount, setAmount] = useState("");
  const [page, setPage] = useState(1);
  const [allocations, setAllocations] = useState<Record<string, string>>({});
  const [paidOn, setPaidOn] = useState(localDay);
  const [note, setNote] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);
  const requests = useRef<Record<string, string>>({});
  const client = useQueryClient();
  const invoices = useQuery({
    queryKey: ["payment-invoices", student, page],
    queryFn: () =>
      api<Page<Row>>(
        `billing/invoices/?student=${student}&page=${page}&state=OUTSTANDING`,
      ),
    enabled: !!student && mode === "allocated",
  });
  const studentQuery = useQuery({
    queryKey: ["student", student],
    queryFn: () => api<Row>(`students/${student}/`),
    enabled: !!student,
  });
  const options = useQuery({
    queryKey: ["payment-options", student],
    queryFn: () =>
      api<{ balance: string; invoice_count: number; pending_count: number }>(
        `billing/payments/options/?student=${student}`,
      ),
    enabled: !!student,
  });
  const total =
    mode === "quick" ? amount : sumAmounts(Object.values(allocations));
  const validAmount =
    /^\d+(\.\d{1,2})?$/.test(total) &&
    Number(total) > 0 &&
    Number(total) <= 999999999999.99;
  const canBackdate =
    isFinance(user) ||
    user.extra_permissions.includes("billing.backdate_payment");
  async function submit() {
    setSaving(true);
    setError("");
    const body = {
      student: Number(student),
      amount: total,
      paid_on: paidOn,
      note,
      ...(mode === "allocated"
        ? {
            allocations: Object.entries(allocations)
              .filter(([, v]) => Number(v) > 0)
              .map(([invoice, amount]) => ({
                invoice: Number(invoice),
                amount,
              })),
          }
        : {}),
    };
    const fingerprint = JSON.stringify(body);
    const key = requests.current[fingerprint] || crypto.randomUUID();
    requests.current[fingerprint] = key;
    try {
      await api("billing/payments/", {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: fingerprint,
      });
      setSuccess(
        `${studentQuery.data?.full_name}: ${money(total)} to‘lov saqlandi.`,
      );
      setConfirm(false);
      setAllocations({});
      setAmount("");
      setNote("");
      requests.current = {};
      await client.invalidateQueries();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setSaving(false);
    }
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="breadcrumb">Moliya / Qo‘lda kiritish</span>
          <h1>To‘lov kiritish</h1>
          <p>O‘quvchini toping, summani kiriting va to‘lovni tasdiqlang.</p>
        </div>
      </div>
      {success && (
        <div className="notice success" role="status">
          {success}
        </div>
      )}
      <div className="payment-layout">
        <div className="panel">
          <div className="step-label">
            1 <strong>O‘quvchini toping</strong>
          </div>
          <StudentPicker
            value={student}
            disabled={saving}
            onChange={(v) => {
              setStudent(v);
              setPage(1);
              setAllocations({});
              setAmount("");
              setError("");
              setSuccess("");
            }}
          />
          {studentQuery.isError && (
            <ErrorBox
              message={errorText(studentQuery.error)}
              retry={() => studentQuery.refetch()}
            />
          )}
          {studentQuery.data && (
            <div className="selected-student">
              <span className="avatar">
                {String(studentQuery.data.full_name)[0]}
              </span>
              <div>
                <strong>{String(studentQuery.data.full_name)}</strong>
                <p>
                  ID: {studentQuery.data.id} ·{" "}
                  {String(studentQuery.data.phone || "Telefon biriktirilmagan")}
                </p>
              </div>
            </div>
          )}
          <div className="step-label">
            2 <strong>To‘lov summasi</strong>
          </div>
          <fieldset className="payment-modes">
            <legend className="sr-only">To‘lov usuli</legend>
            <label>
              <input
                type="radio"
                name="payment-mode"
                checked={mode === "quick"}
                onChange={() => setMode("quick")}
              />{" "}
              Tez to‘lov
            </label>
            <label>
              <input
                type="radio"
                name="payment-mode"
                checked={mode === "allocated"}
                onChange={() => setMode("allocated")}
              />{" "}
              Hisoblar bo‘yicha
            </label>
          </fieldset>
          {student && options.isError && (
            <ErrorBox
              message={errorText(options.error)}
              retry={() => options.refetch()}
            />
          )}
          {student && options.data && (
            <div className="payment-balance">
              <span>Jami ochiq qoldiq</span>
              <strong>{money(options.data.balance)}</strong>
              {options.data.pending_count > 0 && (
                <small>
                  {options.data.pending_count} ta hisob summasi hali
                  belgilanmagan.
                </small>
              )}
            </div>
          )}
          {mode === "quick" ? (
            <div className="quick-payment">
              <label htmlFor="quick-amount">To‘lov summasi (so‘m)</label>
              <input
                id="quick-amount"
                type="number"
                min="0.01"
                step="0.01"
                inputMode="decimal"
                max={options.data?.balance}
                placeholder="Masalan, 300000"
                disabled={
                  !student ||
                  saving ||
                  !options.data ||
                  Number(options.data.balance) <= 0
                }
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
              />
              <p className="muted">
                Summa eng eski muddati kelgan ochiq hisoblardan boshlab
                avtomatik taqsimlanadi. Qoldiqdan ortiq to‘lov qabul qilinmaydi.
              </p>
              {student && options.data && Number(options.data.balance) <= 0 && (
                <Empty text="Tasdiqlangan ochiq hisob yo‘q. Belgilanmagan birinchi hisob bo‘lsa, avval summasini tasdiqlang." />
              )}
              {validAmount &&
                options.data &&
                Number(amount) > Number(options.data.balance) && (
                  <ErrorBox message="Summa ochiq qoldiqdan katta. Summani kamaytiring." />
                )}
            </div>
          ) : (
            <>
              {!student ? (
                <Empty text="Avval o‘quvchini tanlang." />
              ) : invoices.isLoading ? (
                <Loading />
              ) : invoices.isError ? (
                <ErrorBox message={errorText(invoices.error)} />
              ) : !invoices.data?.results.length ? (
                <Empty text="To‘lash uchun tasdiqlangan ochiq hisob yo‘q. Birinchi hisob belgilanmagan bo‘lsa avval uni tasdiqlang." />
              ) : (
                <div className="allocation-list">
                  {invoices.data.results.map((invoice) => (
                    <div className="allocation-row" key={invoice.id}>
                      <div>
                        <strong>{String(invoice.subject_name)}</strong>
                        <p>
                          {dateTime(invoice.month)} · Muddat:{" "}
                          {dateTime(invoice.due_date)}
                        </p>
                        <span>
                          Qoldiq: <b>{money(invoice.balance)}</b>
                        </span>
                      </div>
                      <div>
                        <label htmlFor={`alloc-${invoice.id}`}>
                          Ushbu hisobga (so‘m)
                        </label>
                        <input
                          id={`alloc-${invoice.id}`}
                          type="number"
                          min="0"
                          max={String(invoice.balance)}
                          step="0.01"
                          inputMode="decimal"
                          value={allocations[invoice.id] || ""}
                          placeholder="0"
                          onChange={(e) =>
                            setAllocations((v) => ({
                              ...v,
                              [invoice.id]: e.target.value,
                            }))
                          }
                        />
                        <button
                          className="text-link"
                          onClick={() =>
                            setAllocations((v) => ({
                              ...v,
                              [invoice.id]: String(invoice.balance),
                            }))
                          }
                        >
                          Qoldiqni to‘liq
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {invoices.data &&
                (invoices.data.next || invoices.data.previous) && (
                  <div className="pagination">
                    <button
                      className="btn secondary"
                      disabled={!invoices.data.previous}
                      onClick={() => setPage(page - 1)}
                    >
                      Oldingi
                    </button>
                    <button
                      className="btn secondary"
                      disabled={!invoices.data.next}
                      onClick={() => setPage(page + 1)}
                    >
                      Keyingi
                    </button>
                  </div>
                )}
            </>
          )}
        </div>
        <aside className="panel payment-summary">
          <div className="step-label">
            3 <strong>Tekshiring va tasdiqlang</strong>
          </div>
          <label htmlFor="paid-on">To‘lovning haqiqiy sanasi</label>
          <input
            id="paid-on"
            type="date"
            value={paidOn}
            min={canBackdate ? undefined : localDay()}
            max={localDay()}
            onChange={(e) => setPaidOn(e.target.value)}
          />
          <label htmlFor="payment-note">Izoh / ma’lumotnoma</label>
          <textarea
            id="payment-note"
            value={note}
            maxLength={500}
            onChange={(e) => setNote(e.target.value)}
          />
          <div className="payment-total">
            <span>Jami to‘lov</span>
            <strong>{money(total)}</strong>
          </div>
          <p className="muted">
            Server tasdiqlagach to‘lov tarixda ko‘rinadi. Saqlashdan oldin
            o‘quvchi, sana va summani tekshiring.
          </p>
          <button
            className="btn"
            disabled={
              !student ||
              !validAmount ||
              !paidOn ||
              !studentQuery.data ||
              saving ||
              (mode === "quick" &&
                (!options.data || Number(total) > Number(options.data.balance)))
            }
            onClick={() => {
              setError("");
              setConfirm(true);
            }}
          >
            To‘lovni tekshirish
          </button>
        </aside>
      </div>
      <Modal
        open={confirm}
        onClose={() => {
          if (!saving) setConfirm(false);
        }}
        title="To‘lovni tasdiqlash"
        description="O‘quvchi, summa va sanani yana bir bor tekshiring."
      >
        <dl className="detail-list">
          <div>
            <dt>O‘quvchi</dt>
            <dd>{String(studentQuery.data?.full_name || "")}</dd>
          </div>
          <div>
            <dt>Summa</dt>
            <dd className="price">{money(total)}</dd>
          </div>
          <div>
            <dt>To‘lov sanasi</dt>
            <dd>{dateTime(paidOn)}</dd>
          </div>
          {Object.entries(allocations)
            .filter(([, v]) => mode === "allocated" && Number(v) > 0)
            .map(([id, value]) => (
              <div key={id}>
                <dt>Hisob #{id}</dt>
                <dd>{money(value)}</dd>
              </div>
            ))}
        </dl>
        {mode === "quick" && (
          <p className="muted">
            Ochiq hisoblarga eng eski muddatdan boshlab taqsimlanadi.
          </p>
        )}
        {error && <ErrorBox message={error} />}
        <button className="btn full-width" disabled={saving} onClick={submit}>
          {saving ? "Saqlanmoqda…" : "Tasdiqlash va saqlash"}
        </button>
      </Modal>
    </>
  );
}
export function OpeningBalance() {
  const [done, setDone] = useState("");
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Boshlang‘ich qarzdorlik</h1>
          <p>Eski qarz alohida davr, fan, sana va sabab bilan qayd etiladi.</p>
        </div>
      </div>
      <div className="panel narrow">
        {done && (
          <div className="notice success" role="status">
            {done}
          </div>
        )}
        <RecordForm
          fields={[
            {
              key: "student",
              label: "O‘quvchi",
              source: "students/",
              required: true,
            },
            {
              key: "subject",
              label: "Fan",
              source: "subjects/",
              required: true,
            },
            {
              key: "month",
              label: "Davr (oyning birinchi sanasi)",
              type: "date",
              required: true,
            },
            {
              key: "amount",
              label: "Qarz summasi (so‘m)",
              type: "number",
              min: 1,
              required: true,
            },
            {
              key: "due_date",
              label: "Asl to‘lov muddati",
              type: "date",
              required: true,
            },
            {
              key: "as_of",
              label: "Qaysi sana holatiga",
              type: "date",
              required: true,
            },
            {
              key: "reason",
              label: "Asos / sabab",
              type: "textarea",
              required: true,
            },
          ]}
          onSubmit={async (data) => {
            await api("billing/invoices/opening-balance/", {
              method: "POST",
              body: JSON.stringify(data),
            });
            setDone(
              "Boshlang‘ich qarz saqlandi. Hisoblar ro‘yxatida ko‘rishingiz mumkin.",
            );
          }}
        />
      </div>
    </>
  );
}
