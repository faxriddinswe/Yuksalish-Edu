import { publicApi, pageMetadata } from "@/lib/api/server";
import { LeadForm } from "@/features/leads/lead-form";
import type { Course, Page, SiteSettings } from "@/types";
export const metadata = pageMetadata(
  "Bog‘lanish",
  "Yuksalish Edu kurslari bo‘yicha murojaat qoldiring.",
  "/boglanish",
);
export default async function Contact() {
  const [s, courses] = await Promise.all([
    publicApi<SiteSettings>("settings/"),
    publicApi<Page<Course>>("courses/?page_size=50"),
  ]);
  return (
    <section className="container section detail-grid">
      <div>
        <span className="eyebrow">SUHBATDAN BOSHLAYMIZ</span>
        <h1>
          Savolingizga
          <br />
          javob topamiz.
        </h1>
        <p className="lead-copy">
          Kurslar, qabul tartibi va darslar haqida biz bilan bog‘laning.
        </p>
        <dl className="contact-list">
          {s.public_phone && (
            <>
              <dt>Telefon</dt>
              <dd>
                <a href={`tel:${s.public_phone}`}>{s.public_phone}</a>
              </dd>
            </>
          )}
          {s.address && (
            <>
              <dt>Manzil</dt>
              <dd>{s.address}</dd>
            </>
          )}
          {s.working_hours && (
            <>
              <dt>Ish vaqti</dt>
              <dd>{s.working_hours}</dd>
            </>
          )}
        </dl>
        {s.map_url && (
          <a
            className="btn secondary"
            href={s.map_url}
            target="_blank"
            rel="noopener noreferrer"
          >
            Xaritada ko‘rish ↗
          </a>
        )}
        {!s.public_phone && !s.address && (
          <p className="muted">
            Murojaat formasidan foydalaning. Aloqa ma’lumotlari markaz tomonidan
            tasdiqlangach e’lon qilinadi.
          </p>
        )}
      </div>
      <div className="panel">
        <LeadForm courses={courses.results} />
      </div>
    </section>
  );
}
