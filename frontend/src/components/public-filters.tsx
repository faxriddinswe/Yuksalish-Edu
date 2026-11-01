import Link from "next/link";
import { Search, SlidersHorizontal, ArrowLeft, ArrowRight } from "lucide-react";
import type { Page, Subject } from "@/types";

export function SubjectTabs({
  subjects,
  selected = "",
  basePath,
  extra = {},
  parameter = "subject",
}: {
  subjects: Subject[];
  selected?: string;
  basePath: string;
  extra?: Record<string, string>;
  parameter?: string;
}) {
  const href = (id: string) => {
    const params = new URLSearchParams(extra);
    if (id) params.set(parameter, id);
    else params.delete(parameter);
    params.delete("page");
    return `${basePath}${params.size ? `?${params}` : ""}`;
  };
  return (
    <nav className="subject-tabs" aria-label="Fan bo‘yicha bo‘limlar">
      <Link
        href={href("")}
        className={!selected ? "selected" : ""}
        aria-current={!selected ? "page" : undefined}
      >
        Barcha fanlar
      </Link>
      {subjects.map((subject) => (
        <Link
          key={subject.id}
          href={href(String(subject.id))}
          className={selected === String(subject.id) ? "selected" : ""}
          aria-current={selected === String(subject.id) ? "page" : undefined}
        >
          {subject.name}
        </Link>
      ))}
    </nav>
  );
}

export function PublicSearch({
  search = "",
  subject = "",
  subjectParameter = "subject",
  placeholder = "Ism yoki nom bilan qidirish…",
}: {
  search?: string;
  subject?: string;
  subjectParameter?: string;
  placeholder?: string;
}) {
  return (
    <form className="public-search" role="search">
      {subject && (
        <input type="hidden" name={subjectParameter} value={subject} />
      )}
      <div className="search-input">
        <Search size={19} aria-hidden="true" />
        <label className="sr-only" htmlFor="public-search">
          Qidirish
        </label>
        <input
          id="public-search"
          name="search"
          defaultValue={search}
          placeholder={placeholder}
        />
      </div>
      <button className="btn" type="submit">
        <SlidersHorizontal size={17} aria-hidden="true" />
        Qidirish
      </button>
    </form>
  );
}

export function PublicPagination({
  data,
  page,
  params = {},
}: {
  data: Page<unknown>;
  page: string;
  params?: Record<string, string>;
}) {
  if (!data.next && !data.previous) return null;
  return (
    <nav className="pagination public-pagination" aria-label="Sahifalar">
      {data.previous ? (
        <Link
          className="btn secondary"
          href={`?${new URLSearchParams({ ...params, page: String(Number(page) - 1) })}`}
        >
          <ArrowLeft size={17} />
          Oldingi
        </Link>
      ) : (
        <span />
      )}
      <span>
        {page}-sahifa · {data.count} ta natija
      </span>
      {data.next ? (
        <Link
          className="btn secondary"
          href={`?${new URLSearchParams({ ...params, page: String(Number(page) + 1) })}`}
        >
          Keyingi
          <ArrowRight size={17} />
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}
