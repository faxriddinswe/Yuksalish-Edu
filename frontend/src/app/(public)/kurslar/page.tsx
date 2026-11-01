import { publicApi, publicPage, pageMetadata } from "@/lib/api/server";
import { CourseCard } from "@/components/data-cards";
import {
  SubjectTabs,
  PublicSearch,
  PublicPagination,
} from "@/components/public-filters";
import type { Course, Subject, Page } from "@/types";
export const metadata = pageMetadata(
  "Kurslar",
  "Yuksalish Edu fan va kurslari. Maqsadingizga mos yo‘nalishni tanlang.",
  "/kurslar",
);
export default async function Courses({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; search?: string; subject?: string }>;
}) {
  const p = await searchParams;
  const params = new URLSearchParams({
    page: p.page || "1",
    search: p.search || "",
    ...(p.subject ? { subject: p.subject } : {}),
  });
  const [{ data, page }, subjects] = await Promise.all([
    publicPage<Course>("courses/", params),
    publicApi<Page<Subject>>("subjects/?page_size=50"),
  ]);
  return (
    <section className="container section public-collection">
      <div className="collection-heading">
        <div>
          <span className="eyebrow">MAQSADGA BIR QADAM YAQIN</span>
          <h1>
            O‘zingizga mos
            <br />
            <em>yo‘nalishni toping.</em>
          </h1>
          <p className="lead-copy">
            Fanlarni tanlang, ustozlar va kurs dasturi bilan tanishing.
          </p>
        </div>
      </div>
      <SubjectTabs
        subjects={subjects.results}
        selected={p.subject}
        basePath="/kurslar"
        extra={p.search ? { search: p.search } : {}}
      />
      <div className="collection-tools">
        <PublicSearch
          search={p.search}
          subject={p.subject}
          placeholder="Qaysi fanni o‘rganmoqchisiz?"
        />
        <span className="muted">{data.count} ta kurs</span>
      </div>
      <div className="card-grid">
        {data.results.map((course, index) => (
          <CourseCard course={course} index={index} key={course.id} />
        ))}
      </div>
      {!data.count && (
        <div className="collection-empty">
          <h2>Kurs topilmadi</h2>
          <p>Boshqa fan yoki qidiruv so‘zini tanlang.</p>
        </div>
      )}
      <PublicPagination
        data={data}
        page={page}
        params={{
          search: p.search || "",
          ...(p.subject ? { subject: p.subject } : {}),
        }}
      />
    </section>
  );
}
