import Link from "next/link";
import Image from "next/image";
import { HomeMotion } from "@/features/marketing/home-motion";
import {
  ArrowUpRight,
  ArrowRight,
  BookOpen,
  CalendarDays,
  Users,
  Check,
  MoveUpRight,
} from "lucide-react";
import { publicApi, pageMetadata } from "@/lib/api/server";
import type { Course, Teacher, Page, SiteSettings, Achievement } from "@/types";
import {
  CourseCard,
  TeacherCard,
  AchievementCard,
} from "@/components/data-cards";
export const metadata = pageMetadata(
  "Bilim va maqsad sari",
  "Yuksalish Edu: fanlarni o‘rganing, kurslarni tanlang va maqsadingiz sari qadam qo‘ying.",
  "/",
);
export default async function Home() {
  const [courses, teachers, settings, results] = await Promise.all([
    publicApi<Page<Course>>("courses/?page_size=3"),
    publicApi<Page<Teacher>>("teachers/?page_size=3"),
    publicApi<SiteSettings>("settings/"),
    publicApi<Page<Achievement>>("achievements/?page_size=40"),
  ]);
  return (
    <HomeMotion>
      {settings.announcement && (
        <div className="announcement">{settings.announcement}</div>
      )}
      <section className="hero">
        <div className="container hero-grid">
          <div className="hero-copy">
            <span className="eyebrow">
              <span className="dot" /> YUKSALISH EDU O‘QUV MARKAZI
            </span>
            <h1>
              Katta maqsadlar
              <br />
              <em>bilimdan</em> boshlanadi.
            </h1>
            <p>
              Qiziqishingizni bilimga, bilimingizni imkoniyatga aylantiring.
              O‘zingizga mos kursni toping va navbatdagi qadamingizni biz bilan
              qo‘ying.
            </p>
            <div className="hero-actions">
              <Link className="btn" href="/kurslar">
                Kurslarni ko‘rish <ArrowUpRight size={20} />
              </Link>
              <Link className="btn ghost" href="/boglanish">
                Biz bilan bog‘lanish <ArrowRight size={18} />
              </Link>
            </div>
            <div className="hero-note">
              <span className="check-circle">
                <Check size={15} />
              </span>{" "}
              Tushunarli ta’lim. Izchil yondashuv. Aniq maqsad.
            </div>
          </div>
          <div className="hero-art" aria-hidden="true">
            <div className="orbit orbit-one" />
            <div className="orbit orbit-two" />
            <div className="art-label">
              <span className="dot" /> O‘ZINGIZGA SARMOYA KIRITING
            </div>
            <div className="growth-step step-one">
              <span>01</span>
              <BookOpen />
              <strong>Qiziqish</strong>
            </div>
            <div className="growth-step step-two">
              <span>02</span>
              <Users />
              <strong>O‘rganish</strong>
            </div>
            <div className="growth-step step-three">
              <span>03</span>
              <MoveUpRight />
              <strong>Yuksalish</strong>
            </div>
            <div className="art-caption">
              Bugungi bilim —<br />
              ertangi imkoniyat.
            </div>
            <span className="art-star">✳</span>
          </div>
        </div>
      </section>
      <div className="value-strip">
        <div className="container value-grid">
          <div>
            <BookOpen />
            <span>
              Maqsadga mos <strong>fan va kurslar</strong>
            </span>
          </div>
          <div>
            <Users />
            <span>
              Ustoz bilan <strong>birga o‘rganish</strong>
            </span>
          </div>
          <div>
            <CalendarDays />
            <span>
              Jadval va davomat <strong>shaxsiy kabinetda</strong>
            </span>
          </div>
        </div>
      </div>
      <section className="container section">
        <div className="section-heading">
          <div>
            <span className="eyebrow">O‘Z YO‘NALISHINGIZNI TANLANG</span>
            <h2>Qaysi fandan yuksalamiz?</h2>
            <p>Maqsadingizga mos kurs bilan boshlang.</p>
          </div>
          <Link className="text-link" href="/kurslar">
            Barcha kurslar <ArrowUpRight size={18} />
          </Link>
        </div>
        <div className="card-grid">
          {courses.results.length ? (
            courses.results.map((c, i) => (
              <CourseCard key={c.id} course={c} index={i} />
            ))
          ) : (
            <p>Kurslar haqida ma’lumot olish uchun markazga murojaat qiling.</p>
          )}
        </div>
      </section>
      <section className="about-section">
        <div className="container about-grid">
          <div
            className={`about-visual ${settings.about_image || settings.cover_image ? "with-center-photo" : ""}`}
          >
            {settings.about_image || settings.cover_image ? (
              <Image
                src={settings.about_image || settings.cover_image}
                alt={settings.image_caption || "Yuksalish Edu markazi"}
                width={900}
                height={700}
              />
            ) : (
              <>
                <span className="eyebrow">YUKSALISH — HAR KUNI</span>
                <p>
                  Bilim.
                  <br />
                  Ishonch.
                  <br />
                  <em>Imkoniyat.</em>
                </p>
                <div className="about-line" />
                <span>O‘rganishga ajratilgan vaqt — kelajakka e’tibor.</span>
              </>
            )}
          </div>
          <div>
            <span className="eyebrow">BIZNING YONDASHUV</span>
            <h2>
              Har bir qadamda
              <br />
              o‘sishga intilamiz.
            </h2>
            <p className="lead-copy">{settings.about}</p>
            <ul className="check-list">
              <li>
                <Check />
                Fanlarga yo‘naltirilgan mashg‘ulotlar
              </li>
              <li>
                <Check />
                O‘quvchi va ota-ona uchun ochiq kuzatuv
              </li>
              <li>
                <Check />
                Jadval va hisoblar bir joyda
              </li>
            </ul>
            <Link className="text-link" href="/markaz-haqida">
              Markaz bilan tanishing <ArrowUpRight size={18} />
            </Link>
          </div>
        </div>
      </section>
      <section className="container section">
        <div className="section-heading">
          <div>
            <span className="eyebrow">BILIM YO‘LIDAGI HAMROHLAR</span>
            <h2>Ustozlarimiz bilan tanishing</h2>
          </div>
          <Link className="text-link" href="/ustozlar">
            Barcha ustozlar <ArrowUpRight size={18} />
          </Link>
        </div>
        <div className="card-grid">
          {teachers.results.length ? (
            teachers.results.map((t) => <TeacherCard key={t.id} teacher={t} />)
          ) : (
            <p>
              Ustozlar haqidagi tasdiqlangan ma’lumotlar shu yerda e’lon
              qilinadi.
            </p>
          )}
        </div>
      </section>
      <section className="results-band">
        <div className="container">
          <span className="eyebrow">MEHNATNING NATIJASI</span>
          <h2>
            Har bir yutuqning
            <br />
            ortida izlanish bor.
          </h2>
          {results.results.length ? (
            <div className="certificate-gallery">
              {results.results.map((r) => (
                <AchievementCard key={r.id} result={r} heading="h3" />
              ))}
            </div>
          ) : (
            <p>
              Rozilik olingan va tasdiqlangan o‘quvchi yutuqlari Natijalar
              bo‘limida e’lon qilinadi.
            </p>
          )}
          <Link className="btn secondary" href="/natijalar">
            Natijalar bo‘limi <ArrowUpRight size={18} />
          </Link>
        </div>
      </section>
      <section className="container section faq-grid">
        <div>
          <span className="eyebrow">SAVOLINGIZ BORMI?</span>
          <h2>Bilish foydali.</h2>
          <p>Qo‘shimcha savollar uchun bizga murojaat qiling.</p>
          <Link className="text-link" href="/boglanish">
            Savol berish <ArrowUpRight size={18} />
          </Link>
        </div>
        <div>
          {settings.faqs.length ? (
            settings.faqs.map((f) => (
              <details className="faq" key={f.id}>
                <summary>{f.question}</summary>
                <p>{f.answer}</p>
              </details>
            ))
          ) : (
            <p>
              Kurslar va qabul tartibi haqida markaz xodimidan ma’lumot oling.
            </p>
          )}
        </div>
      </section>
      <section className="container cta">
        <div>
          <span className="eyebrow">BIRINCHI QADAM SIZDAN</span>
          <h2>Yuksalishni bugun boshlang.</h2>
          <p>
            Kurs tanlashda yordam kerakmi? Murojaat qoldiring — birga
            aniqlaymiz.
          </p>
        </div>
        <Link className="btn cream" href="/boglanish">
          Murojaat qoldirish <ArrowUpRight size={20} />
        </Link>
      </section>
    </HomeMotion>
  );
}
