"use client";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, errorText } from "@/lib/api/client";
import { dateTime } from "@/lib/formatting";
import { ReferenceInput } from "@/features/resources/resource-manager";
import { ErrorBox, Loading, Empty, Status } from "@/components/ui";
import type { Row, Page } from "@/types";
export function RollCall({ initialLesson = "" }: { initialLesson?: string }) {
  const [lesson, setLesson] = useState(initialLesson);
  const [page, setPage] = useState(1);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState<number | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [reasons, setReasons] = useState<Record<number, string>>({});
  const client = useQueryClient();
  const detail = useQuery({
    queryKey: ["lesson", lesson],
    queryFn: () => api<Row>(`lessons/${lesson}/`),
    enabled: !!lesson,
  });
  const enrollment = useQuery({
    queryKey: ["roll-roster", lesson, page],
    queryFn: () => api<Page<Row>>(`lessons/${lesson}/roster/?page=${page}`),
    enabled: !!detail.data,
    refetchInterval: 15000,
    refetchOnWindowFocus: "always",
  });
  const members = enrollment.data?.results || [];
  async function mark(student: number, status: string) {
    const member = members.find((item) => Number(item.student) === student);
    if (
      member?.attendance_status &&
      member.attendance_status !== status &&
      !reasons[student]?.trim()
    ) {
      setError(
        "Davomatni o‘zgartirishdan oldin o‘quvchi yonidagi tuzatish sababini kiriting.",
      );
      return;
    }
    setBusy(student);
    setError("");
    try {
      await api("attendance/", {
        method: "POST",
        body: JSON.stringify({
          lesson: Number(lesson),
          student,
          status,
          reason: reasons[student] || "",
          note: member?.attendance_note || "",
        }),
      });
      setNotice("Davomat saqlandi.");
      setReasons((values) => ({ ...values, [student]: "" }));
      await client.invalidateQueries();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(null);
    }
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="breadcrumb">Ta’lim / Dars davomati</span>
          <h1>Dars davomati</h1>
          <p>
            Belgilanmagan o‘quvchilarda “Bor” oldindan tanlangan. Saqlagach
            o‘quvchi va ota-ona ko‘radi. Avvalgi belgini tuzatish uchun sabab
            kiriting.
          </p>
        </div>
      </div>
      <div className="panel">
        <ReferenceInput
          field={{ key: "roll-lesson", label: "Dars", source: "lessons/" }}
          value={lesson}
          selectedLabel={
            detail.data
              ? `${detail.data.group_name} — ${dateTime(detail.data.starts_at)}`
              : undefined
          }
          onChange={(v) => {
            setLesson(v);
            setPage(1);
            setNotice("");
          }}
        />
        {detail.data && (
          <div className="lesson-heading">
            <h2>{String(detail.data.group_name)}</h2>
            <p>
              {dateTime(detail.data.starts_at)} ·{" "}
              {String(detail.data.room_name)}
            </p>
            <Status value={detail.data.status} />
            {detail.data.status !== "CANCELLED" && (
              <div className="attendance-defaults">
                <p>
                  Yangi “Bor” tanlovlari hali saqlanmagan. Quyidagi tugma
                  darsdagi barcha belgilanmagan o‘quvchilarni saqlaydi. Avvalgi
                  belgilar o‘zgarmaydi.
                </p>
                <button
                  className="btn"
                  disabled={
                    confirming || busy !== null || !enrollment.data?.count
                  }
                  onClick={async () => {
                    setConfirming(true);
                    setError("");
                    try {
                      const result = await api<{ created: number }>(
                        "attendance/confirm-present/",
                        {
                          method: "POST",
                          body: JSON.stringify({ lesson: Number(lesson) }),
                        },
                      );
                      setNotice(
                        `${result.created} ta yangi “Bor” belgisi saqlandi.`,
                      );
                      await client.invalidateQueries();
                    } catch (e) {
                      setError(errorText(e));
                    } finally {
                      setConfirming(false);
                    }
                  }}
                >
                  {confirming ? "Saqlanmoqda…" : "“Bor” tanlovlarini saqlash"}
                </button>
              </div>
            )}
          </div>
        )}
        {notice && (
          <div className="notice success" role="status">
            {notice}
          </div>
        )}
        {error && <ErrorBox message={error} />}{" "}
        {detail.isError && <ErrorBox message={errorText(detail.error)} />}{" "}
        {enrollment.isError && (
          <ErrorBox message={errorText(enrollment.error)} />
        )}{" "}
        {enrollment.isLoading ? (
          <Loading />
        ) : !lesson ? (
          <Empty text="Davomat uchun darsni tanlang." />
        ) : members.length ? (
          members.map((member) => {
            const student = Number(member.student);
            const record = member.attendance_status
              ? { status: member.attendance_status }
              : null;
            return (
              <div className="roll-row" key={member.id}>
                <div>
                  <strong>{String(member.student_name)}</strong>
                  <div>
                    {record ? (
                      <Status value={record.status} />
                    ) : (
                      <span className="muted">
                        {detail.data?.status === "CANCELLED"
                          ? "Dars bekor qilingan"
                          : "Bor tanlangan · hali saqlanmagan"}
                      </span>
                    )}
                  </div>
                </div>
                <div className="roll-actions">
                  {record && (
                    <input
                      aria-label={`${member.student_name}: tuzatish sababi`}
                      placeholder="Tuzatish sababi"
                      value={reasons[student] || ""}
                      onChange={(e) =>
                        setReasons((v) => ({ ...v, [student]: e.target.value }))
                      }
                    />
                  )}
                  <div>
                    {Object.entries({
                      PRESENT: "Bor",
                      ABSENT: "Yo‘q",
                      LATE: "Kech",
                      EXCUSED: "Sababli",
                    }).map(([status, label]) => (
                      <button
                        className={`btn secondary ${(record?.status || (detail.data?.status !== "CANCELLED" ? "PRESENT" : "")) === status ? "selected" : ""}`}
                        aria-pressed={
                          (record?.status ||
                            (detail.data?.status !== "CANCELLED"
                              ? "PRESENT"
                              : "")) === status
                        }
                        key={status}
                        disabled={
                          busy !== null ||
                          confirming ||
                          record?.status === status ||
                          detail.data?.status === "CANCELLED"
                        }
                        onClick={() => mark(student, status)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <Empty text="Dars sanasiga mos a’zolar topilmadi." />
        )}
        {enrollment.data &&
          (enrollment.data.next || enrollment.data.previous) && (
            <div className="pagination">
              <button
                className="btn secondary"
                disabled={!enrollment.data.previous}
                onClick={() => setPage(page - 1)}
              >
                Oldingi
              </button>
              <button
                className="btn secondary"
                disabled={!enrollment.data.next}
                onClick={() => setPage(page + 1)}
              >
                Keyingi
              </button>
            </div>
          )}
      </div>
    </>
  );
}
