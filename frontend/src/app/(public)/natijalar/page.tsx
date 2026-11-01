import { Award, ArrowUpRight, SearchX, BookOpen, Sparkles } from "lucide-react";
import { publicApi, publicPage, pageMetadata } from "@/lib/api/server";
import { AchievementCard } from "@/components/data-cards";
import {
  SubjectTabs,
  PublicSearch,
  PublicPagination,
} from "@/components/public-filters";
import type { Achievement, Subject, Page } from "@/types";
import Link from "next/link";

export const metadata = pageMetadata(
  "Natijalar",
  "Yuksalish Edu o‘quvchilarining fanlar bo‘yicha sertifikatlari va yutuqlari.",
  "/natijalar",
);

export default async function Results({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; subject?: string; search?: string }>;
}) {
  const p = await searchParams;
  const subjects = await publicApi<Page<Subject>>("subjects/?page_size=100");
  const selected = subjects.results.filter(
    (subject) => !p.subject || String(subject.id) === p.subject,
  );
  const groups = await Promise.all(
    selected.map(async (subject) => {
      const params = new URLSearchParams({
        subject: String(subject.id),
        page_size: "40",
        page: p.subject ? p.page || "1" : "1",
        ...(p.search ? { search: p.search } : {}),
      });
      return {
        subject,
        ...(await publicPage<Achievement>("achievements/", params)),
      };
    }),
  );
  const count = groups.reduce((sum, group) => sum + group.data.count, 0);
  const visible = p.search
    ? groups.filter((group) => group.data.count)
    : groups;
  return (
    <section className="container section public-collection certificate-collection">
      <div className="collection-heading certificate-heading">
        <div>
          <span className="eyebrow">
            <Award size={16} aria-hidden="true" /> MEHNATNING NATIJASI
          </span>
          <h1>
            Bilim bilan erishilgan
            <br />
            <em>haqiqiy yutuqlar.</em>
          </h1>
          <p className="lead-copy">
            Har bir sertifikat ortida mehnat, ustoz ko‘magi va katta maqsad bor.
            O‘quvchilarimizning natijalari bilan fanlar bo‘yicha tanishing.
          </p>
          <Link className="btn" href="/kurslar">
            Sizning yutug‘ingiz shu yerdan boshlanadi{" "}
            <ArrowUpRight size={18} aria-hidden="true" />
          </Link>
        </div>
        <div className="certificate-hero-art" aria-hidden="true">
          <span className="certificate-art-kicker">YUKSALISH EDU</span>
          <div className="certificate-art-award">
            <Award size={68} strokeWidth={1.3} />
          </div>
          <span className="certificate-art-line" />
          <span className="certificate-art-line short" />
          <span className="certificate-art-caption">
            Mehnat. Bilim. Natija.
          </span>
          <Sparkles className="certificate-art-spark" size={28} />
        </div>
      </div>
      <div className="certificate-navigation">
        <SubjectTabs
          subjects={subjects.results}
          selected={p.subject}
          basePath="/natijalar"
          extra={p.search ? { search: p.search } : {}}
        />
        <div className="collection-tools">
          <PublicSearch
            search={p.search}
            subject={p.subject}
            placeholder="O‘quvchi, sertifikat yoki ustoz nomi…"
          />
          <span className="certificate-total">
            <Award size={17} aria-hidden="true" /> {count} ta natija
          </span>
        </div>
      </div>
      {visible.length ? (
        visible.map(({ subject, data, page }) => (
          <section
            className="subject-results-section"
            key={subject.id}
            aria-labelledby={`results-${subject.slug}`}
          >
            <header className="subject-results-heading">
              <div className="subject-results-title">
                <span className="subject-results-icon">
                  <BookOpen size={23} aria-hidden="true" />
                </span>
                <div>
                  <span className="eyebrow">O‘QUVCHILARIMIZ YUTUQLARI</span>
                  <h2 id={`results-${subject.slug}`}>{subject.name}</h2>
                </div>
              </div>
              <span className="subject-result-count">
                {data.count} ta sertifikat
              </span>
            </header>
            {data.results.length ? (
              <div className="certificate-gallery">
                {data.results.map((result) => (
                  <AchievementCard
                    key={result.id}
                    result={result}
                    heading="h3"
                  />
                ))}
              </div>
            ) : (
              <div className="subject-results-empty">
                <Award size={32} aria-hidden="true" />
                <div>
                  <h3>Yangi yutuqlar oldinda</h3>
                  <p>
                    {subject.name} bo‘yicha sertifikatlar joylangach, shu yerda
                    ko‘rinadi.
                  </p>
                </div>
              </div>
            )}
            {!p.subject && data.next && (
              <Link
                className="text-link subject-results-more"
                href={`/natijalar?${new URLSearchParams({ subject: String(subject.id), ...(p.search ? { search: p.search } : {}) })}`}
              >
                Barcha {data.count} ta natijani ko‘rish{" "}
                <ArrowUpRight size={17} aria-hidden="true" />
              </Link>
            )}
            {p.subject && (
              <PublicPagination
                data={data}
                page={page}
                params={{
                  subject: p.subject,
                  ...(p.search ? { search: p.search } : {}),
                }}
              />
            )}
          </section>
        ))
      ) : (
        <div className="collection-empty">
          <SearchX size={36} aria-hidden="true" />
          <h2>Bu tanlov bo‘yicha natija topilmadi</h2>
          <p>Boshqa fan yoki qidiruv so‘zini tanlab ko‘ring.</p>
          <Link className="btn secondary" href="/natijalar">
            Barcha natijalar
          </Link>
        </div>
      )}
    </section>
  );
}
