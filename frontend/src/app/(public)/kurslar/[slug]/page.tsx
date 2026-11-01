import { notFound } from "next/navigation";
import { publicApi, pageMetadata } from "@/lib/api/server";
import { money } from "@/lib/formatting";
import { LeadForm } from "@/features/leads/lead-form";
import type { Course, Page, Teacher } from "@/types";
import Link from "next/link";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  try {
    const c = await publicApi<Course>(`courses/${slug}/`);
    return pageMetadata(c.name, c.summary, `/kurslar/${slug}`);
  } catch {
    return { title: "Kurs topilmadi" };
  }
}
export default async function CoursePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const c = await publicApi<Course>(`courses/${slug}/`).catch(() => null);
  if (!c) notFound();
  const teachers = await publicApi<Page<Teacher>>("teachers/");
  return (
    <section className="container section">
      <Link className="text-link" href="/kurslar">
        ← Barcha kurslar
      </Link>
      <div className="detail-grid">
        <div>
          <span className="eyebrow">{c.subject_name}</span>
          <h1>{c.name}</h1>
          <p className="lead-copy">{c.summary}</p>
          <div className="panel">
            <h2>Kurs haqida</h2>
            <p className="pre-line">{c.description}</p>
            {c.audience && (
              <>
                <h3>Kimlar uchun?</h3>
                <p>{c.audience}</p>
              </>
            )}
            {c.duration && <p>Davomiylik: {c.duration}</p>}
            {c.lesson_description && <p>{c.lesson_description}</p>}
            <h3>Oylik to‘lov</h3>
            <p className="price">
              {c.monthly_price ? money(c.monthly_price) : "Markazdan aniqlang"}
            </p>
            <p className="muted">
              Birinchi oy summasi va muddati ro‘yxatga olishda alohida
              kelishiladi.
            </p>
          </div>
          <h2>Ustozlar</h2>
          {teachers.results
            .filter((t) =>
              ((c as Course & { teachers: number[] }).teachers || []).includes(
                t.id,
              ),
            )
            .map((t) => (
              <p key={t.id}>
                <Link className="text-link" href={`/ustozlar/${t.slug}`}>
                  {t.full_name} ↗
                </Link>
              </p>
            ))}
        </div>
        <aside className="panel">
          <LeadForm courses={[c]} courseId={c.id} />
        </aside>
      </div>
    </section>
  );
}
