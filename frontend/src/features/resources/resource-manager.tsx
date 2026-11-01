"use client";
import {
  isOffice,
  isFinance,
  canManageCertificates,
  isParentCabinet,
  isStudentCabinet,
} from "@/lib/auth/access";
import { useState, useEffect, useId } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  Search,
  ChevronLeft,
  ChevronRight,
  ArrowUpRight,
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { api, errorText } from "@/lib/api/client";
import { money, dateTime, roleLabels } from "@/lib/formatting";
import { Loading, Empty, ErrorBox, Modal, Status } from "@/components/ui";
import { ImageUpload } from "@/components/ui/image-upload";
import type { User, Row, Page } from "@/types";
import {
  resources,
  labels,
  canWrite,
  actionsFor,
  type Field,
  type RowAction,
} from "./config";

export function useDebounce(value: string, delay = 350) {
  const [result, setResult] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setResult(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return result;
}
export function ReferenceInput({
  field,
  value,
  onChange,
  inputId,
  selectedLabel,
  onSelect,
}: {
  inputId?: string;
  selectedLabel?: string;
  field: Field;
  value: string;
  onChange: (v: string) => void;
  onSelect?: (row: Row) => void;
}) {
  const [search, setSearch] = useState("");
  const debounced = useDebounce(search);
  const id = useId();
  const query = useQuery({
    queryKey: ["reference", field.source, debounced],
    queryFn: () =>
      api<Page<Row>>(
        `${field.source}?page_size=25&search=${encodeURIComponent(debounced)}`,
      ),
  });
  const rows = query.data?.results || [];
  return (
    <div className="reference-input">
      <label className="sr-only" htmlFor={`${id}-search`}>
        {field.label} qidirish
      </label>
      <input
        id={`${id}-search`}
        placeholder={`${field.label} qidirish…`}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <select
        id={inputId || id}
        value={value}
        required={field.required}
        onChange={(e) => {
          onChange(e.target.value);
          const row = rows.find((row) => String(row.id) === e.target.value);
          if (row) onSelect?.(row);
        }}
        aria-label={field.label}
      >
        <option value="">{query.isLoading ? "Yuklanmoqda…" : "Tanlang"}</option>
        {value && !rows.some((r) => String(r.id) === value) && (
          <option value={value}>
            {selectedLabel || `Tanlangan ID: ${value}`}
          </option>
        )}
        {rows.map((r) => (
          <option key={r.id} value={r.id}>
            {String(r.full_name || r.name || r.group_name || `ID ${r.id}`)}
            {r.starts_at ? ` — ${dateTime(r.starts_at)}` : ""}
            {r.phone ? ` (${r.phone})` : ""}
          </option>
        ))}
      </select>
      {query.isError && (
        <span className="field-error">{errorText(query.error)}</span>
      )}
      {(query.data?.count || 0) > 25 && (
        <small className="muted">
          Birinchi 25 natija. Nom yoki telefon bilan aniqlashtiring.
        </small>
      )}
    </div>
  );
}
function MultiReferenceInput({
  field,
  value,
  onChange,
}: {
  field: Field;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  const [search, setSearch] = useState("");
  const debounced = useDebounce(search);
  const selected = Array.isArray(value) ? value.map(Number) : [];
  const query = useQuery({
    queryKey: ["multi-reference", field.source, debounced],
    queryFn: () =>
      api<Page<Row>>(
        `${field.source}?search=${encodeURIComponent(debounced)}&page_size=25`,
      ),
  });
  return (
    <fieldset className="checkbox-grid">
      <legend>{field.label}</legend>
      <input
        aria-label={`${field.label} qidirish`}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Qidirish…"
      />
      <small>Tanlangan ID: {selected.join(", ") || "Tanlanmagan"}</small>
      {query.data?.results.map((row) => (
        <label className="checkbox" key={row.id}>
          <input
            type="checkbox"
            checked={selected.includes(row.id)}
            onChange={(e) =>
              onChange(
                e.target.checked
                  ? [...selected, row.id]
                  : selected.filter((id) => id !== row.id),
              )
            }
          />
          {String(row.full_name || row.name || row.id)}
        </label>
      ))}
      {query.isError && <ErrorBox message={errorText(query.error)} />}
    </fieldset>
  );
}
const permissionLabels = {
  "billing.record_payment": "To‘lov kiritish",
  "billing.backdate_payment": "Oldingi sanaga to‘lov",
  "billing.correct_finance": "Moliyaviy tuzatish",
  "attendance.correct_attendance": "Davomat tuzatish",
};
export function FieldControl({
  field,
  value,
  onChange,
  onReferenceSelect,
  selectedLabel,
}: {
  field: Field;
  value: unknown;
  onChange: (value: unknown) => void;
  onReferenceSelect?: (row: Row) => void;
  selectedLabel?: string;
}) {
  const controlId = useId();
  const stringValue = value == null ? "" : String(value);
  if (field.type === "multiselect")
    return (
      <MultiReferenceInput field={field} value={value} onChange={onChange} />
    );
  if (field.type === "checkbox")
    return (
      <label className="checkbox">
        <input
          id={controlId}
          type="checkbox"
          checked={!!value}
          onChange={(e) => onChange(e.target.checked)}
        />
        {field.label}
      </label>
    );
  if (field.type === "roles" || field.type === "permissions") {
    const options =
      field.options || (field.type === "roles" ? roleLabels : permissionLabels);
    const values = Array.isArray(value) ? value : [];
    return (
      <fieldset className="checkbox-grid">
        <legend>{field.label}</legend>
        {Object.entries(options).map(([key, label]) => (
          <label className="checkbox" key={key}>
            <input
              type="checkbox"
              checked={values.includes(key)}
              onChange={(e) =>
                onChange(
                  e.target.checked
                    ? [...values, key]
                    : values.filter((v) => v !== key),
                )
              }
            />
            {label}
          </label>
        ))}
      </fieldset>
    );
  }
  return (
    <div className="field">
      <label htmlFor={controlId}>
        {field.label}
        {field.required ? " *" : ""}
      </label>
      {field.source ? (
        <ReferenceInput
          inputId={controlId}
          field={field}
          value={stringValue}
          onChange={onChange}
          onSelect={onReferenceSelect}
          selectedLabel={selectedLabel}
        />
      ) : field.type === "textarea" ? (
        <textarea
          id={controlId}
          rows={3}
          value={stringValue}
          required={field.required}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : field.type === "select" ? (
        <select
          id={controlId}
          required={field.required}
          value={stringValue}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">Tanlang</option>
          {Object.entries(field.options || {}).map(([k, v]) => (
            <option value={k} key={k}>
              {v}
            </option>
          ))}
        </select>
      ) : field.type === "file" ? (
        <ImageUpload
          inputId={controlId}
          label={field.label}
          value={value}
          onChange={onChange}
        />
      ) : (
        <input
          id={controlId}
          type={field.type || "text"}
          value={stringValue}
          required={field.required}
          min={field.min}
          step={field.type === "number" ? "0.01" : undefined}
          placeholder={field.placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </div>
  );
}
export function RecordForm({
  fields,
  initial,
  onSubmit,
  submitLabel = "Saqlash",
  danger = false,
  requireStudentLink = false,
}: {
  fields: Field[];
  initial?: Record<string, unknown>;
  onSubmit: (data: Record<string, unknown>) => Promise<unknown>;
  submitLabel?: string;
  danger?: boolean;
  requireStudentLink?: boolean;
}) {
  const [values, setValues] = useState<Record<string, unknown>>(() =>
    Object.fromEntries(
      fields.map((f) => [
        f.key,
        f.type === "file"
          ? (initial?.[f.key] ?? null)
          : (initial?.[f.key] ??
            (f.type === "checkbox"
              ? f.key === "is_active"
              : f.type === "roles" ||
                  f.type === "permissions" ||
                  f.type === "multiselect"
                ? []
                : "")),
      ]),
    ),
  );
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const formFields = fields.map((field) =>
    requireStudentLink && field.key === "student"
      ? { ...field, required: field.required || !values.is_sample }
      : field,
  );
  return (
    <form
      className="form-stack record-form"
      onSubmit={async (e) => {
        e.preventDefault();
        setError("");
        setSaving(true);
        try {
          const data = Object.fromEntries(
            formFields.map((f) => {
              const value = values[f.key];
              if (f.type === "datetime-local" && value)
                return [
                  f.key,
                  String(value).endsWith("Z")
                    ? String(value)
                    : new Date(
                        `${value}${String(value).length === 16 ? ":00" : ""}+05:00`,
                      ).toISOString(),
                ];
              if (f.type === "number" && value !== "")
                return [f.key, String(value)];
              if (f.type === "multiselect")
                return [f.key, Array.isArray(value) ? value.map(Number) : []];
              if (f.source && value !== "") return [f.key, Number(value)];
              if (
                !f.required &&
                value === "" &&
                (f.type === "date" || f.type === "number" || f.source)
              )
                return [f.key, null];
              return [f.key, value];
            }),
          );
          await onSubmit(data);
        } catch (e) {
          setError(errorText(e));
        } finally {
          setSaving(false);
        }
      }}
    >
      {formFields.map((field) => (
        <FieldControl
          key={field.key}
          field={field}
          value={
            field.type === "datetime-local" &&
            String(values[field.key]).includes("Z")
              ? tashkentInput(String(values[field.key]))
              : values[field.key]
          }
          onChange={(v) => setValues((old) => ({ ...old, [field.key]: v }))}
          selectedLabel={
            initial?.[`${field.key}_name`]
              ? String(initial[`${field.key}_name`])
              : undefined
          }
          onReferenceSelect={
            field.key === "student" &&
            fields.some((item) => item.key === "display_name")
              ? (row) =>
                  setValues((old) => ({
                    ...old,
                    display_name: String(row.full_name || ""),
                  }))
              : undefined
          }
        />
      ))}
      {error && <ErrorBox message={error} />}
      <button className={`btn ${danger ? "danger" : ""}`} disabled={saving}>
        {saving ? "Saqlanmoqda…" : submitLabel}
      </button>
    </form>
  );
}
function tashkentInput(value: string) {
  const date = new Date(new Date(value).getTime() + 5 * 3600000);
  return date.toISOString().slice(0, 16);
}
export function displayValue(key: string, value: unknown): React.ReactNode {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Ha" : "Yo‘q";
  if (key === "allocations" && Array.isArray(value))
    return (
      <ul className="student-certificate-list">
        {value.map((item, index) => (
          <li key={index}>
            <strong>{item.subject_name}</strong>
            <span>
              {money(item.amount)} · {dateTime(item.month)}
            </span>
          </li>
        ))}
      </ul>
    );
  if (key === "certificates" && Array.isArray(value))
    return value.length ? (
      <ul className="student-certificate-list">
        {value.map((certificate) => (
          <li key={certificate.id}>
            <strong>
              {certificate.subject_name} · {certificate.title}
            </strong>
            <span>Ball / daraja: {certificate.score || "Kiritilmagan"}</span>
            <small>Ustoz: {certificate.teacher_name || "Ko‘rsatilmagan"}</small>
          </li>
        ))}
      </ul>
    ) : (
      <span className="muted">Sertifikat yo‘q</span>
    );
  if (
    ["image", "photo", "cover_image", "about_image"].includes(key) &&
    typeof value === "string"
  )
    return (
      <Image
        unoptimized
        className="record-thumbnail"
        src={`/api/v1/content/image-preview/?path=${encodeURIComponent(value.replace(/^\/media\//, ""))}`}
        alt="Yuklangan rasm"
        width={112}
        height={84}
      />
    );
  if (
    [
      "amount",
      "monthly_price",
      "balance",
      "paid_total",
      "adjustment_total",
      "total_amount",
    ].includes(key)
  )
    return money(value);
  if (["status", "payment_state", "publication_status"].includes(key))
    return <Status value={value} />;
  if (["roles"].includes(key) && Array.isArray(value))
    return value.map((v) => roleLabels[String(v)] || v).join(", ");
  if (key === "weekday")
    return [
      "Dushanba",
      "Seshanba",
      "Chorshanba",
      "Payshanba",
      "Juma",
      "Shanba",
      "Yakshanba",
    ][Number(value)];
  if (
    key.endsWith("_at") ||
    [
      "registered_on",
      "paid_on",
      "month",
      "start_date",
      "end_date",
      "effective_from",
      "due_date",
      "valid_from",
      "valid_until",
      "lesson_date",
    ].includes(key)
  )
    return dateTime(value);
  if (typeof value === "object")
    return <pre className="json-value">{JSON.stringify(value, null, 2)}</pre>;
  return String(value);
}
export function ResourceManager({
  section,
  user,
  initialFilters = {},
}: {
  section: string;
  user: User;
  initialFilters?: Record<string, string>;
}) {
  const baseConfig = resources[section];
  const staffConfig =
    section === "staff" && !user.roles.includes("OWNER_ADMIN")
      ? {
          ...baseConfig,
          fields: baseConfig.fields
            .filter((field) => field.key !== "extra_permissions")
            .map((field) =>
              field.key === "roles"
                ? {
                    ...field,
                    options: Object.fromEntries(
                      Object.entries(roleLabels).filter(
                        ([role]) => role !== "OWNER_ADMIN",
                      ),
                    ),
                  }
                : field,
            ),
        }
      : baseConfig;
  const certificateAccess = canManageCertificates(user);
  const config =
    section === "students" && isParentCabinet(user)
      ? {
          ...staffConfig,
          title: "Farzandlarim",
          description:
            "Faqat sizga tasdiqlab biriktirilgan farzandlar va ularning ta’lim holati.",
          columns: ["full_name", "registered_on", "status"],
          filters: staffConfig.filters?.filter(
            (field) => field.key === "status",
          ),
        }
      : section === "students" && !certificateAccess
        ? {
            ...staffConfig,
            columns: staffConfig.columns.filter(
              (key) => key !== "certificates",
            ),
            filters: staffConfig.filters?.filter(
              (field) =>
                !["has_certificate", "certificate_subject"].includes(field.key),
            ),
          }
        : section === "students" &&
            !isOffice(user) &&
            user.roles.includes("TEACHER")
          ? {
              ...staffConfig,
              description:
                "Guruhlaringizdagi o‘quvchilar va siz tayyorlagan sertifikatlar. Fan, sertifikat turi va ball bo‘yicha natijalarni ko‘ring.",
              columns: staffConfig.columns.filter((key) => key !== "phone"),
            }
          : section === "achievements" && !isOffice(user)
            ? {
                ...staffConfig,
                description:
                  "O‘zingiz tayyorlagan o‘quvchilarning sertifikatlari, rasmlari va natijalari.",
                fields: staffConfig.fields
                  .filter((field) => field.key !== "teacher")
                  .map((field) =>
                    field.key === "student"
                      ? { ...field, required: true }
                      : field,
                  ),
                filters: staffConfig.filters?.filter(
                  (field) => field.key !== "teacher",
                ),
              }
            : staffConfig;
  const client = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const debounced = useDebounce(search);
  const [filters, setFilters] =
    useState<Record<string, string>>(initialFilters);
  const [editing, setEditing] = useState<Row | "new" | null>(null);
  const [detail, setDetail] = useState<Row | null>(null);
  const [activeAction, setActiveAction] = useState<RowAction | null>(null);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [notice, setNotice] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const params = new URLSearchParams({
    page: String(page),
    ...(debounced ? { search: debounced } : {}),
  });
  for (const [k, v] of Object.entries(filters)) if (v) params.set(k, v);
  const requiresStudent =
    user.roles.includes("ADMINISTRATOR") &&
    !isFinance(user) &&
    ["invoices", "payments"].includes(section) &&
    !filters.student;
  const query = useQuery({
    queryKey: ["resource", section, params.toString(), user.id],
    queryFn: () => api<Page<Row>>(`${config.endpoint}?${params}`),
    enabled: !requiresStudent,
    refetchInterval: section === "attendance" ? 15000 : false,
    refetchOnWindowFocus: section === "attendance" ? "always" : false,
  });
  async function refresh() {
    await client.invalidateQueries();
    setNotice("Saqlandi. Ma’lumotlar yangilandi.");
  }
  async function save(data: Record<string, unknown>) {
    if (section === "parents" && editing === "new") data.roles = ["PARENT"];
    let body: BodyInit;
    const hasFile = Object.values(data).some((v) => v instanceof File);
    if (hasFile) {
      const form = new FormData();
      for (const [k, v] of Object.entries(data)) {
        if (v instanceof File) form.append(k, v);
        else if (Array.isArray(v))
          v.forEach((item) => form.append(k, String(item)));
        else if (
          config.fields.find((field) => field.key === k)?.type === "file" &&
          v !== ""
        )
          continue;
        else if (v !== undefined) form.append(k, v === null ? "" : String(v));
      }
      body = form;
    } else {
      body = JSON.stringify(
        Object.fromEntries(
          Object.entries(data).filter(
            ([k, v]) =>
              !(
                config.fields.find((f) => f.key === k)?.type === "file" &&
                !(v instanceof File) &&
                v !== ""
              ),
          ),
        ),
      );
    }
    await api(
      `${config.endpoint}${editing && editing !== "new" ? `${editing.id}/` : ""}`,
      { method: editing === "new" ? "POST" : "PATCH", body },
    );
    setEditing(null);
    setDetail(null);
    await refresh();
  }
  const writable = canWrite(user, section);
  const mayManageDetail =
    writable &&
    !(
      section === "staff" &&
      !user.roles.includes("OWNER_ADMIN") &&
      ((detail?.roles as string[]) || []).includes("OWNER_ADMIN")
    );
  const canCreate =
    writable && !(section === "settings" && (query.data?.count || 0) > 0);
  if (requiresStudent)
    return (
      <>
        <div className="page-heading">
          <div>
            <h1>{config.title}</h1>
            <p>O‘quvchining to‘lov holatini ko‘rish uchun avval uni tanlang.</p>
          </div>
        </div>
        <section className="panel">
          <FieldControl
            field={{
              key: "student",
              label: "O‘quvchini tanlang",
              type: "select",
              source: "students/",
            }}
            value={filters.student || ""}
            onChange={(value) => {
              setFilters((old) => ({ ...old, student: String(value || "") }));
              setPage(1);
            }}
          />
        </section>
      </>
    );
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="breadcrumb">Yuksalish Edu / Kabinet</span>
          <h1>{config.title}</h1>
          <p>{config.description}</p>
        </div>
        {canCreate && (
          <button
            className="btn"
            onClick={() => {
              setEditing("new");
              setNotice("");
            }}
          >
            <Plus size={18} />
            Yangi yozuv
          </button>
        )}
      </div>
      {notice && (
        <div className="notice success" role="status">
          {notice}
        </div>
      )}
      {isOffice(user) && ["students", "staff", "parents"].includes(section) && (
        <aside className="account-help">
          <strong>Kabinet paroli qanday belgilanadi?</strong>
          <p>
            {section === "students"
              ? "O‘quvchi tafsilotini oching → Kabinet akkaunti yaratish. Akkaunti bor bo‘lsa, yangi taklif yoki tiklash kodini chiqaring."
              : section === "staff"
                ? "Rahbar yangi xodim akkauntini yaratadi, unga Administrator yoki Ustoz rolini beradi va tafsilotdan faollashtirish kodi chiqaradi."
                : "Ota-ona akkauntini yarating, farzandini tasdiqlab biriktiring va tafsilotdan faollashtirish kodi chiqaring."}{" "}
            Foydalanuvchi /faollashtirish sahifasida telefon va bir martalik
            kodni kiritib, o‘z parolini belgilaydi. Kod 24 soat amal qiladi;
            parol administratorga ko‘rinmaydi.
          </p>
        </aside>
      )}
      <div className="panel list-panel">
        <div className="list-toolbar">
          {config.search && (
            <div className="search-input">
              <Search size={18} aria-hidden="true" />
              <label className="sr-only" htmlFor="record-search">
                Qidirish
              </label>
              <input
                id="record-search"
                value={search}
                placeholder="Ism, nom yoki telefon bilan qidirish…"
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
              />
            </div>
          )}
          <span className="muted">{query.data?.count ?? "…"} ta yozuv</span>
        </div>
        {config.filters && (
          <div className="filter-grid">
            {config.filters.map((f) => (
              <FieldControl
                key={f.key}
                field={f}
                value={filters[f.key] || ""}
                onChange={(v) => {
                  setFilters((old) => ({ ...old, [f.key]: String(v || "") }));
                  setPage(1);
                }}
              />
            ))}
            <button
              className="btn secondary"
              onClick={() => {
                setFilters({});
                setPage(1);
              }}
            >
              Filtrlarni tozalash
            </button>
          </div>
        )}
        {query.isLoading ? (
          <Loading />
        ) : query.isError ? (
          <ErrorBox
            message={errorText(query.error)}
            retry={() => query.refetch()}
          />
        ) : !query.data?.results.length ? (
          <Empty text="Mos yozuvlar topilmadi. Filtrlarni tekshiring yoki yangi yozuv qo‘shing." />
        ) : (
          <div
            className="table-container"
            role="region"
            aria-label={config.title}
            tabIndex={0}
          >
            <table>
              <thead>
                <tr>
                  {config.columns.map((c) => (
                    <th key={c} scope="col">
                      {labels[c] || c}
                    </th>
                  ))}
                  <th scope="col">Amallar</th>
                </tr>
              </thead>
              <tbody>
                {query.data.results.map((row) => (
                  <tr key={row.id}>
                    {config.columns.map((c) => (
                      <td key={c} data-label={labels[c] || c}>
                        {displayValue(c, row[c])}
                      </td>
                    ))}
                    <td data-label="Amallar">
                      <button
                        className="row-action"
                        onClick={() => {
                          setDetail(row);
                          setDeleting(false);
                          setDeleteError("");
                          setActiveAction(null);
                          setResult(null);
                        }}
                      >
                        Tafsilot <ArrowUpRight size={14} aria-hidden="true" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {query.data && query.data.count > 25 && (
          <div className="pagination">
            <span className="muted">
              {page}-sahifa / {Math.ceil(query.data.count / 25)}
            </span>
            <button
              className="icon-btn"
              disabled={!query.data.previous}
              onClick={() => setPage(page - 1)}
              aria-label="Oldingi sahifa"
            >
              <ChevronLeft />
            </button>
            <button
              className="icon-btn"
              disabled={!query.data.next}
              onClick={() => setPage(page + 1)}
              aria-label="Keyingi sahifa"
            >
              <ChevronRight />
            </button>
          </div>
        )}
      </div>
      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={
          editing === "new"
            ? `${config.title}: yangi yozuv`
            : "Ma’lumotni tahrirlash"
        }
      >
        {editing && (
          <RecordForm
            key={editing === "new" ? "new" : editing.id}
            fields={config.fields}
            initial={
              editing === "new"
                ? section === "achievements" && filters.student
                  ? { student: Number(filters.student) }
                  : undefined
                : editing
            }
            requireStudentLink={
              section === "achievements" &&
              (editing === "new" || !isOffice(user))
            }
            onSubmit={save}
          />
        )}
      </Modal>
      <Modal
        open={!!detail}
        onClose={() => {
          if (deleteBusy) return;
          setDetail(null);
          setActiveAction(null);
          setDeleting(false);
        }}
        title={
          deleting
            ? "Yozuvni o‘chirish"
            : activeAction?.title || `${config.title}: tafsilot`
        }
        description={activeAction?.confirm}
      >
        {detail &&
          (deleting ? (
            <>
              <p>
                <strong>
                  {String(
                    detail.full_name ||
                      detail.name ||
                      detail.title ||
                      `ID: ${detail.id}`,
                  )}
                </strong>{" "}
                yozuvini o‘chirishni tasdiqlang.
              </p>
              <p className="muted">
                Bu amalni qaytarib bo‘lmaydi. Tarixiy bog‘lanishlar bo‘lsa,
                o‘chirish o‘rniga yozuvni nofaol/arxiv holatiga o‘tkazing.
              </p>
              {deleteError && <ErrorBox message={deleteError} />}
              <div className="heading-actions">
                <button
                  className="btn secondary"
                  disabled={deleteBusy}
                  onClick={() => setDeleting(false)}
                >
                  Qaytish
                </button>
                <button
                  className="btn danger"
                  disabled={deleteBusy}
                  onClick={async () => {
                    setDeleteBusy(true);
                    setDeleteError("");
                    try {
                      await api(`${config.endpoint}${detail.id}/`, {
                        method: "DELETE",
                      });
                      setDetail(null);
                      setDeleting(false);
                      await client.invalidateQueries();
                      setNotice(
                        "Yozuv o‘chirildi. Amallar tarixiga qayd etildi.",
                      );
                    } catch (error) {
                      setDeleteError(errorText(error));
                    } finally {
                      setDeleteBusy(false);
                    }
                  }}
                >
                  {deleteBusy ? "O‘chirilmoqda…" : "O‘chirishni tasdiqlash"}
                </button>
              </div>
            </>
          ) : !activeAction ? (
            <>
              <dl className="detail-list">
                {Object.entries(detail)
                  .filter(
                    ([key]) =>
                      !(isStudentCabinet(user) || isParentCabinet(user)) ||
                      [
                        "full_name",
                        "phone",
                        "contact_phone",
                        "registered_on",
                        "status",
                        "student_name",
                        "group_name",
                        "course_name",
                        "teacher_name",
                        "room_name",
                        "starts_at",
                        "ends_at",
                        "lesson_date",
                        "subject_name",
                        "month",
                        "amount",
                        "paid_total",
                        "balance",
                        "payment_state",
                        "paid_on",
                        "created_at",
                        "allocations",
                        "note",
                        "void_reason",
                        "total_amount",
                        "due_date",
                      ].includes(key),
                  )
                  .map(([k, v]) => (
                    <div key={k}>
                      <dt>
                        {labels[k] ||
                          config.fields.find((f) => f.key === k)?.label ||
                          k}
                      </dt>
                      <dd>{displayValue(k, v)}</dd>
                    </div>
                  ))}
              </dl>
              <div className="action-stack">
                {(isOffice(user) ||
                  (section === "achievements" && certificateAccess)) &&
                  mayManageDetail &&
                  !config.immutable &&
                  ![
                    "audit",
                    "exports",
                    "invoices",
                    "payments",
                    "adjustments",
                    "attendance",
                    "settings",
                  ].includes(section) && (
                    <button
                      className="btn danger"
                      onClick={() => setDeleting(true)}
                    >
                      Yozuvni o‘chirish
                    </button>
                  )}
                {mayManageDetail &&
                  !config.immutable &&
                  config.fields.length > 0 && (
                    <button
                      className="btn"
                      onClick={() => {
                        setEditing(detail);
                        setDetail(null);
                      }}
                    >
                      Tahrirlash
                    </button>
                  )}
                {section === "students" && certificateAccess && (
                  <Link
                    className="btn secondary"
                    href={`/kabinet/achievements?student=${detail.id}`}
                  >
                    Sertifikatlarini boshqarish
                  </Link>
                )}
                {section === "students" &&
                  ["OWNER_ADMIN", "ADMINISTRATOR", "ACCOUNTANT"].some((r) =>
                    user.roles.includes(r),
                  ) && (
                    <Link
                      className="btn secondary"
                      href={`/kabinet/invoices?student=${detail.id}`}
                    >
                      Hisoblarini ko‘rish
                    </Link>
                  )}
                {section === "teachers" && isFinance(user) && (
                  <Link
                    className="btn secondary"
                    href={`/kabinet/teacher-finance?teacher=${detail.id}`}
                  >
                    Ustoz to‘lovlari
                  </Link>
                )}
                {section === "students" && isFinance(user) && (
                  <Link
                    className="btn secondary"
                    href={`/kabinet/record-payment?student=${detail.id}`}
                  >
                    To‘lov kiritish
                  </Link>
                )}
                {section === "lessons" &&
                  (isOffice(user) || user.roles.includes("TEACHER")) && (
                    <Link
                      className="btn"
                      href={`/kabinet/roll-call?lesson=${detail.id}`}
                    >
                      Dars davomati
                    </Link>
                  )}
                {actionsFor(section, detail, user).map((a) => (
                  <button
                    className={`btn ${a.danger ? "danger" : "secondary"}`}
                    key={a.path}
                    onClick={() => setActiveAction(a)}
                  >
                    {a.title}
                  </button>
                ))}
                {section === "exports" && detail.status === "COMPLETED" && (
                  <a
                    className="btn"
                    href={`/api/v1/${config.endpoint}${detail.id}/download/`}
                  >
                    Excel faylni yuklash
                  </a>
                )}
              </div>
            </>
          ) : result ? (
            <div role="status" className="notice success">
              <p>Amal bajarildi.</p>
              {!!result.code && (
                <>
                  <p>
                    Bir martalik kod. Faqat akkaunt egasiga markaz tartibi
                    bo‘yicha bering. 24 soat amal qiladi.
                  </p>
                  <code className="activation-code">{String(result.code)}</code>
                  <p>
                    Foydalanuvchi{" "}
                    {result.purpose === "RESET"
                      ? "parolni tiklash"
                      : "kabinetni faollashtirish"}{" "}
                    sahifasida telefon va ushbu kodni kiritib, o‘z parolini
                    belgilaydi.
                  </p>
                  <Link
                    className="text-link"
                    href={
                      result.purpose === "RESET"
                        ? "/parolni-tiklash"
                        : "/faollashtirish"
                    }
                  >
                    {result.purpose === "RESET"
                      ? "Parolni tiklash sahifasi"
                      : "Faollashtirish sahifasi"}{" "}
                    →
                  </Link>
                </>
              )}
              {result.created !== undefined && (
                <p>Yaratilgan darslar: {String(result.created)}</p>
              )}
              {!!result.student_id && (
                <Link className="text-link" href="/kabinet/students">
                  O‘quvchilar ro‘yxatiga →
                </Link>
              )}
              <button
                className="btn secondary"
                onClick={() => {
                  setDetail(null);
                  setActiveAction(null);
                }}
              >
                Yopish
              </button>
            </div>
          ) : (
            <RecordForm
              fields={activeAction.fields}
              danger={activeAction.danger}
              submitLabel="Tasdiqlash"
              onSubmit={async (data) => {
                const response = await api<Record<string, unknown>>(
                  `${config.endpoint}${detail.id}/${activeAction.path}`,
                  { method: "POST", body: JSON.stringify(data) },
                );
                setResult({ ...response, purpose: data.purpose || "ACTIVATE" });
                await refresh();
              }}
            />
          ))}
      </Modal>
    </>
  );
}
