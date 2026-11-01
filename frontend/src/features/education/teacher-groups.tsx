"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Users, CalendarDays, ArrowLeft, Search, Phone } from "lucide-react";
import { api, errorText } from "@/lib/api/client";
import { dateTime } from "@/lib/formatting";
import { Loading, ErrorBox, Empty, Status } from "@/components/ui";
import { useDebounce } from "@/features/resources/resource-manager";
import type { User, Page } from "@/types";

type Group = {
  id: number;
  name: string;
  course_name: string;
  room_name: string;
  capacity: number;
  student_count: number;
  status: string;
  start_date: string;
};
type Member = {
  id: number;
  student: number;
  student_name: string;
  student_phone: string;
  contact_phone: string;
  registered_on: string;
  start_date: string;
  parents: { name: string; phone: string; relationship: string }[];
};

export function TeacherGroups({ user }: { user: User }) {
  const [selected, setSelected] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ACTIVE");
  const [page, setPage] = useState(1);
  const debounced = useDebounce(search);
  const params = new URLSearchParams({
    page: String(page),
    search: debounced,
    ...(status ? { status } : {}),
  });
  const groups = useQuery({
    queryKey: ["teacher-groups", user.id, params.toString()],
    queryFn: () => api<Page<Group>>(`groups/?${params}`),
  });
  if (selected)
    return (
      <GroupMembers
        groupId={selected}
        user={user}
        onBack={() => setSelected("")}
      />
    );
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="breadcrumb">O‘qituvchi kabineti / Ta’lim</span>
          <h1>Guruhlarim</h1>
          <p>O‘zingizga biriktirilgan guruhlar va ularning o‘quvchilari.</p>
        </div>
      </div>
      <div className="panel teacher-filters">
        <div className="field">
          <label htmlFor="teacher-group-search">Guruh yoki kurs</label>
          <div className="group-search-input">
            <Search size={18} aria-hidden="true" />
            <input
              id="teacher-group-search"
              type="search"
              placeholder="Guruhni qidirish"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>
        </div>
        <div className="field">
          <label htmlFor="teacher-group-status">Guruh holati</label>
          <select
            id="teacher-group-status"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Barcha holatlar</option>
            <option value="ACTIVE">Faol</option>
            <option value="COMPLETED">Yakunlangan</option>
            <option value="ARCHIVED">Arxivlangan</option>
          </select>
        </div>
        <button
          className="btn secondary"
          onClick={() => {
            setSearch("");
            setStatus("ACTIVE");
            setPage(1);
          }}
        >
          Tozalash
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
        <Empty text="Tanlovga mos guruh topilmadi. Guruh biriktirish bo‘yicha administratorga murojaat qiling." />
      ) : (
        <>
          <p className="muted group-list-count">{groups.data.count} ta guruh</p>
          <div className="student-group-grid">
            {groups.data.results.map((group) => (
              <article
                key={group.id}
                className="panel student-group-card teacher-group-card"
              >
                <header>
                  <span className="feature-icon">
                    <Users size={24} aria-hidden="true" />
                  </span>
                  <Status value={group.status} />
                </header>
                <p className="group-course-name">{group.course_name}</p>
                <h2>{group.name}</h2>
                <div className="group-capacity">
                  <strong>{group.student_count}</strong>
                  <span>
                    o‘quvchi <small>/ {group.capacity} o‘rin</small>
                  </span>
                </div>
                <dl>
                  <div>
                    <dt>Xona</dt>
                    <dd>{group.room_name}</dd>
                  </div>
                  <div>
                    <dt>Boshlangan sana</dt>
                    <dd>{dateTime(group.start_date)}</dd>
                  </div>
                </dl>
                <div className="teacher-group-actions">
                  <button
                    className="btn"
                    onClick={() => setSelected(String(group.id))}
                  >
                    Guruh tarkibi
                  </button>
                  <Link
                    className="btn secondary"
                    href={`/kabinet/lessons?group=${group.id}`}
                  >
                    <CalendarDays size={17} aria-hidden="true" />
                    Jadval
                  </Link>
                </div>
              </article>
            ))}
          </div>
          <ListPagination page={page} data={groups.data} onChange={setPage} />
        </>
      )}
    </>
  );
}

function GroupMembers({
  groupId,
  user,
  onBack,
}: {
  groupId: string;
  user: User;
  onBack: () => void;
}) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const debounced = useDebounce(search);
  const group = useQuery({
    queryKey: ["teacher-group", user.id, groupId],
    queryFn: () => api<Group>(`groups/${groupId}/`),
  });
  const members = useQuery({
    queryKey: ["teacher-members", user.id, groupId, page, debounced],
    queryFn: () =>
      api<Page<Member>>(
        `groups/${groupId}/members/?${new URLSearchParams({ page: String(page), search: debounced })}`,
      ),
  });
  return (
    <>
      <button className="btn secondary back-to-groups" onClick={onBack}>
        <ArrowLeft size={18} aria-hidden="true" />
        Guruhlarga qaytish
      </button>
      <div className="page-heading">
        <div>
          <span className="breadcrumb">Guruhlarim / Guruh tarkibi</span>
          <h1>{group.data?.name || "Guruh tarkibi"}</h1>
          <p>
            {group.data?.course_name} · {group.data?.student_count ?? "…"}{" "}
            o‘quvchi. Tasdiqlangan ota-ona va aloqa ma’lumotlari.
          </p>
        </div>
        <Link
          className="btn secondary"
          href={`/kabinet/lessons?group=${groupId}`}
        >
          Dars jadvali
        </Link>
      </div>
      {group.isError && (
        <ErrorBox
          message={errorText(group.error)}
          retry={() => group.refetch()}
        />
      )}
      <div className="panel member-search field">
        <label htmlFor="group-member-search">
          Ism yoki telefon bo‘yicha qidirish
        </label>
        <input
          id="group-member-search"
          type="search"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          placeholder="O‘quvchi yoki ota-ona"
        />
      </div>
      {members.isLoading ? (
        <Loading />
      ) : members.isError ? (
        <ErrorBox
          message={errorText(members.error)}
          retry={() => members.refetch()}
        />
      ) : !members.data?.count ? (
        <Empty text="Tanlovga mos faol o‘quvchi topilmadi." />
      ) : (
        <>
          <div className="group-member-grid">
            {members.data.results.map((member) => (
              <article className="panel group-member-card" key={member.id}>
                <header>
                  <span className="avatar" aria-hidden="true">
                    {member.student_name[0]}
                  </span>
                  <div>
                    <h2>{member.student_name}</h2>
                    <span className="muted">O‘quvchi ID: {member.student}</span>
                  </div>
                </header>
                <dl>
                  <div>
                    <dt>Guruhga qo‘shilgan</dt>
                    <dd>{dateTime(member.start_date)}</dd>
                  </div>
                  <div>
                    <dt>Markazga kelgan</dt>
                    <dd>{dateTime(member.registered_on)}</dd>
                  </div>
                </dl>
                <div className="member-contacts">
                  <h3>Aloqa</h3>
                  {member.student_phone && (
                    <Contact name="O‘quvchi" phone={member.student_phone} />
                  )}
                  {member.contact_phone && (
                    <Contact
                      name="Qo‘shimcha kontakt"
                      phone={member.contact_phone}
                    />
                  )}
                  {member.parents.map((parent, index) => (
                    <Contact
                      key={index}
                      name={`${parent.name} · ${parent.relationship}`}
                      phone={parent.phone}
                    />
                  ))}
                  {!member.student_phone &&
                    !member.contact_phone &&
                    !member.parents.length && (
                      <p className="muted">Aloqa raqami kiritilmagan.</p>
                    )}
                </div>
              </article>
            ))}
          </div>
          <ListPagination data={members.data} page={page} onChange={setPage} />
        </>
      )}
    </>
  );
}
function Contact({ name, phone }: { name: string; phone: string }) {
  return (
    <div className="member-contact">
      <span>{name}</span>
      <a href={`tel:${phone}`}>
        <Phone size={15} aria-hidden="true" />
        {phone}
      </a>
    </div>
  );
}
export function ListPagination({
  data,
  page,
  onChange,
}: {
  data: { next: string | null; previous: string | null };
  page: number;
  onChange: (page: number) => void;
}) {
  return data.next || data.previous ? (
    <nav className="pagination" aria-label="Ro‘yxat sahifalari">
      <span>{page}-sahifa</span>
      <button
        className="btn secondary"
        disabled={!data.previous}
        onClick={() => onChange(page - 1)}
      >
        Oldingi
      </button>
      <button
        className="btn secondary"
        disabled={!data.next}
        onClick={() => onChange(page + 1)}
      >
        Keyingi
      </button>
    </nav>
  ) : null;
}
