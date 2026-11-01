"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  MapPin,
} from "lucide-react";
import { tashkentDay, shiftDay } from "@/lib/formatting/calendar";
import { api, errorText } from "@/lib/api/client";
import { Loading, ErrorBox, Status } from "@/components/ui";
import { ListPagination } from "./teacher-groups";
import type { User, Page } from "@/types";

const dayNames = [
  "Yakshanba",
  "Dushanba",
  "Seshanba",
  "Chorshanba",
  "Payshanba",
  "Juma",
  "Shanba",
];
const time = (value: string) =>
  new Intl.DateTimeFormat("uz-UZ", {
    timeZone: "Asia/Tashkent",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
type Lesson = {
  id: number;
  group: number;
  group_name: string;
  room_name: string;
  starts_at: string;
  ends_at: string;
  status: string;
};
type Group = { id: number; name: string };

export function TeacherSchedule({
  user,
  attendanceMode = false,
  initialGroup = "",
}: {
  user: User;
  attendanceMode?: boolean;
  initialGroup?: string;
}) {
  const today = tashkentDay();
  const [start, setStart] = useState(today);
  const [group, setGroup] = useState(initialGroup);
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [groupPage, setGroupPage] = useState(1);
  const end = shiftDay(start, 6);
  const params = new URLSearchParams({
    from: start,
    to: end,
    page_size: "50",
    page: String(page),
    ...(group ? { group } : {}),
    ...(status ? { status } : {}),
  });
  const lessons = useQuery({
    queryKey: ["teacher-week", user.id, params.toString()],
    queryFn: () => api<Page<Lesson>>(`lessons/?${params}`),
    refetchInterval: 60000,
  });
  const groups = useQuery({
    queryKey: ["teacher-schedule-groups", user.id, groupPage],
    queryFn: () => api<Page<Group>>(`groups/?page_size=50&page=${groupPage}`),
  });
  function move(offset: number) {
    setStart(shiftDay(start, offset));
    setPage(1);
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="breadcrumb">
            O‘qituvchi kabineti / {attendanceMode ? "Davomat" : "Jadval"}
          </span>
          <h1>{attendanceMode ? "Davomat" : "Darslar va jadval"}</h1>
          <p>
            {attendanceMode
              ? "Darsni tanlang va o‘quvchilar davomatini belgilang."
              : "Bugundan boshlab 7 kunlik shaxsiy dars jadvalingiz."}
          </p>
        </div>
      </div>
      <div className="panel weekly-controls">
        <div className="week-navigation">
          <button
            className="icon-btn"
            aria-label="Oldingi 7 kun"
            onClick={() => move(-7)}
          >
            <ChevronLeft aria-hidden="true" />
          </button>
          <div>
            <strong>
              {start.split("-").reverse().join(".")} —{" "}
              {end.split("-").reverse().join(".")}
            </strong>
            <span>7 kunlik jadval · Toshkent vaqti</span>
          </div>
          <button
            className="icon-btn"
            aria-label="Keyingi 7 kun"
            onClick={() => move(7)}
          >
            <ChevronRight aria-hidden="true" />
          </button>
          <button
            className="btn secondary"
            onClick={() => {
              setStart(today);
              setPage(1);
            }}
          >
            Bugundan
          </button>
        </div>
        <div className="teacher-filters">
          <div className="field">
            <label htmlFor="week-start">Boshlanish sanasi</label>
            <input
              id="week-start"
              type="date"
              value={start}
              onChange={(e) => {
                if (e.target.value) {
                  setStart(e.target.value);
                  setPage(1);
                }
              }}
            />
          </div>
          <div className="field">
            <label htmlFor="week-group">Guruh</label>
            <select
              id="week-group"
              value={group}
              onChange={(e) => {
                setGroup(e.target.value);
                setPage(1);
              }}
            >
              <option value="">Barcha guruhlarim</option>
              {groups.data?.results.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
            {groups.data && (groups.data.next || groups.data.previous) && (
              <ListPagination
                data={groups.data}
                page={groupPage}
                onChange={setGroupPage}
              />
            )}
            {groups.isError && (
              <ErrorBox
                message={errorText(groups.error)}
                retry={() => groups.refetch()}
              />
            )}
          </div>
          <div className="field">
            <label htmlFor="week-status">Dars holati</label>
            <select
              id="week-status"
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
            >
              <option value="">Barcha holatlar</option>
              <option value="SCHEDULED">Rejalangan</option>
              <option value="COMPLETED">O‘tilgan</option>
              <option value="CANCELLED">Bekor qilingan</option>
            </select>
          </div>
        </div>
      </div>
      {lessons.isLoading ? (
        <Loading />
      ) : lessons.isError ? (
        <ErrorBox
          message={errorText(lessons.error)}
          retry={() => lessons.refetch()}
        />
      ) : (
        <>
          <p className="muted group-list-count">
            Tanlangan 7 kunda {lessons.data?.count ?? 0} ta dars
            {lessons.data && (lessons.data.next || lessons.data.previous)
              ? ` · ${page}-sahifa`
              : ""}
          </p>
          <div className="weekly-grid">
            {Array.from({ length: 7 }, (_, index) => {
              const day = shiftDay(start, index);
              const date = new Date(`${day}T12:00:00Z`);
              const items =
                lessons.data?.results.filter(
                  (lesson) => tashkentDay(new Date(lesson.starts_at)) === day,
                ) || [];
              return (
                <section
                  className={`week-day ${day === today ? "today" : ""}`}
                  key={day}
                  aria-label={`${dayNames[date.getUTCDay()]}, ${day}`}
                >
                  <header>
                    <div>
                      <h2>{dayNames[date.getUTCDay()]}</h2>
                      <time dateTime={day}>
                        {day.slice(8)}.{day.slice(5, 7)}
                      </time>
                    </div>
                    {day === today && (
                      <span className="today-badge">Bugun</span>
                    )}
                  </header>
                  {items.length ? (
                    items.map((lesson) => (
                      <article className="panel week-lesson" key={lesson.id}>
                        <span className="lesson-time">
                          <Clock size={16} aria-hidden="true" />
                          {time(lesson.starts_at)}–{time(lesson.ends_at)}
                        </span>
                        <h3>{lesson.group_name}</h3>
                        <p>
                          <MapPin size={15} aria-hidden="true" />
                          {lesson.room_name}
                        </p>
                        <Status value={lesson.status} />
                        {lesson.status !== "CANCELLED" && (
                          <Link
                            className="btn secondary"
                            href={`/kabinet/roll-call?lesson=${lesson.id}`}
                          >
                            <CalendarDays size={16} aria-hidden="true" />
                            Davomat
                          </Link>
                        )}
                      </article>
                    ))
                  ) : (
                    <p className="week-empty">
                      {lessons.data?.next || lessons.data?.previous
                        ? "Bu sahifada dars yo‘q."
                        : "Dars rejalashtirilmagan."}
                    </p>
                  )}
                </section>
              );
            })}
          </div>
          {lessons.data && (
            <ListPagination
              data={lessons.data}
              page={page}
              onChange={setPage}
            />
          )}
        </>
      )}
    </>
  );
}
