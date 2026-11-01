"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BookOpen,
  CalendarDays,
  GraduationCap,
  MapPin,
  Search,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { api, errorText } from "@/lib/api/client";
import { dateTime } from "@/lib/formatting";
import { isParentCabinet, cabinetRole, cabinetTitles } from "@/lib/auth/access";
import { Loading, ErrorBox, Empty, Status } from "@/components/ui";
import { useDebounce } from "@/features/resources/resource-manager";
import type { Page, User } from "@/types";

type StudyGroup = {
  id: number;
  name: string;
  course_name: string;
  teacher_name: string;
  room_name: string;
  start_date: string;
  end_date: string | null;
  status: string;
};

export function StudentGroups({ user }: { user: User }) {
  const parent = isParentCabinet(user);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const debounced = useDebounce(search);
  const params = new URLSearchParams({
    page: String(page),
    ...(debounced ? { search: debounced } : {}),
    ...(status ? { status } : {}),
  });
  const groups = useQuery({
    queryKey: ["student-groups", user.id, params.toString()],
    queryFn: () => api<Page<StudyGroup>>(`groups/?${params}`),
  });
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="breadcrumb">
            {cabinetTitles[cabinetRole(user)]} / Ta’lim
          </span>
          <h1>{parent ? "Farzandlarimning guruhlari" : "Guruhlarim"}</h1>
          <p>
            {parent
              ? "Farzandlaringiz qatnashayotgan kurslar, ustozlar va dars jadvali."
              : "Qatnashayotgan kurslaringiz, ustozlaringiz va dars jadvali."}
          </p>
        </div>
      </div>
      <div className="panel student-group-filters">
        <div className="field">
          <label htmlFor="student-group-search">
            Guruh yoki kursni qidirish
          </label>
          <div className="group-search-input">
            <Search size={18} aria-hidden="true" />
            <input
              id="student-group-search"
              type="search"
              value={search}
              placeholder="Guruh yoki kurs nomi"
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>
        </div>
        <div className="field">
          <label htmlFor="student-group-status">Guruh holati</label>
          <select
            id="student-group-status"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Barcha guruhlar</option>
            <option value="ACTIVE">Faol</option>
            <option value="COMPLETED">Yakunlangan</option>
            <option value="ARCHIVED">Arxivlangan</option>
          </select>
        </div>
        <button
          className="btn secondary"
          onClick={() => {
            setSearch("");
            setStatus("");
            setPage(1);
          }}
        >
          Filtrlarni tozalash
        </button>
      </div>
      {groups.isLoading ? (
        <Loading />
      ) : groups.isError ? (
        <ErrorBox
          message={errorText(groups.error)}
          retry={() => groups.refetch()}
        />
      ) : !groups.data?.count ? (
        <Empty text="Bu tanlov bo‘yicha guruhlar topilmadi. Guruhga yozilish bo‘yicha administratorga murojaat qiling." />
      ) : (
        <>
          <p className="muted group-list-count">{groups.data.count} ta guruh</p>
          <div className="student-group-grid">
            {groups.data.results.map((group) => (
              <article className="panel student-group-card" key={group.id}>
                <header>
                  <span className="feature-icon">
                    <BookOpen size={24} aria-hidden="true" />
                  </span>
                  <Status value={group.status} />
                </header>
                <p className="group-course-name">{group.course_name}</p>
                <h2>{group.name}</h2>
                <dl>
                  <div>
                    <dt>
                      <GraduationCap size={19} aria-hidden="true" />
                      Ustoz
                    </dt>
                    <dd>{group.teacher_name}</dd>
                  </div>
                  <div>
                    <dt>
                      <MapPin size={18} aria-hidden="true" />
                      Xona
                    </dt>
                    <dd>{group.room_name}</dd>
                  </div>
                  <div>
                    <dt>
                      <CalendarDays size={18} aria-hidden="true" />
                      Boshlangan sana
                    </dt>
                    <dd>{dateTime(group.start_date)}</dd>
                  </div>
                  {group.end_date && (
                    <div>
                      <dt>Yakunlanish sanasi</dt>
                      <dd>{dateTime(group.end_date)}</dd>
                    </div>
                  )}
                </dl>
                <Link
                  className="btn secondary"
                  href={`/kabinet/lessons?group=${group.id}`}
                  aria-label={`${group.name}: dars jadvali`}
                >
                  <CalendarDays size={18} aria-hidden="true" />
                  Dars jadvali
                </Link>
              </article>
            ))}
          </div>
          {(groups.data.next || groups.data.previous) && (
            <nav className="pagination" aria-label="Guruhlar sahifalari">
              <span>{page}-sahifa</span>
              <button
                className="icon-btn"
                aria-label="Oldingi sahifa"
                disabled={!groups.data.previous}
                onClick={() => setPage(page - 1)}
              >
                <ChevronLeft aria-hidden="true" />
              </button>
              <button
                className="icon-btn"
                aria-label="Keyingi sahifa"
                disabled={!groups.data.next}
                onClick={() => setPage(page + 1)}
              >
                <ChevronRight aria-hidden="true" />
              </button>
            </nav>
          )}
        </>
      )}
    </>
  );
}
