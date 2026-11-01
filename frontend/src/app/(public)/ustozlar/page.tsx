import { publicApi, publicPage, pageMetadata } from "@/lib/api/server";
import type { Teacher, Subject, Page } from "@/types";
import { TeacherCard } from "@/components/data-cards";
import {
  SubjectTabs,
  PublicSearch,
  PublicPagination,
} from "@/components/public-filters";
export const metadata = pageMetadata(
  "Ustozlar",
  "Yuksalish Edu ustozlari: fanlari, tajribasi va ta’limga yondashuvi.",
  "/ustozlar",
);
export default async function Teachers({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; subjects?: string; search?: string }>;
}) {
  const p = await searchParams;
  const query = new URLSearchParams({
    page: p.page || "1",
    ...(p.subjects ? { subjects: p.subjects } : {}),
    ...(p.search ? { search: p.search } : {}),
  });
  const [{ data, page }, subjects] = await Promise.all([
    publicPage<Teacher>("teachers/", query),
    publicApi<Page<Subject>>("subjects/?page_size=50"),
  ]);
  return (
    <section className="container section public-collection">
      <div className="collection-heading">
        <div>
          <span className="eyebrow">BILIM ULASHADIGAN INSONLAR</span>
          <h1>
            Maqsadingiz yo‘lida
            <br />
            <em>yoningizdagi ustozlar.</em>
          </h1>
          <p className="lead-copy">
            Fanini sevadigan, bilimni tushunarli yetkazishga intiladigan
            ustozlarimiz bilan tanishing.
          </p>
        </div>
      </div>
      <SubjectTabs
        subjects={subjects.results}
        selected={p.subjects}
        parameter="subjects"
        basePath="/ustozlar"
        extra={p.search ? { search: p.search } : {}}
      />
      <div className="collection-tools">
        <PublicSearch
          search={p.search}
          subject={p.subjects}
          subjectParameter="subjects"
          placeholder="Ustoz ismi yoki tajribasi bo‘yicha…"
        />
        <span className="muted">{data.count} nafar ustoz</span>
      </div>
      <div className="card-grid teacher-grid">
        {data.results.map((t) => (
          <TeacherCard key={t.id} teacher={t} />
        ))}
      </div>
      {!data.count && (
        <div className="collection-empty">
          <h2>Mos ustoz topilmadi</h2>
          <p>Fanni o‘zgartiring yoki qidiruvni tozalang.</p>
        </div>
      )}
      <PublicPagination
        data={data}
        page={page}
        params={{
          ...(p.subjects ? { subjects: p.subjects } : {}),
          ...(p.search ? { search: p.search } : {}),
        }}
      />
    </section>
  );
}
