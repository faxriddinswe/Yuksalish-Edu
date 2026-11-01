import Image from "next/image";
import Link from "next/link";
import {
  ArrowUpRight,
  BookOpen,
  CalendarDays,
  HeartHandshake,
  MapPin,
  Phone,
  Clock,
  GraduationCap,
} from "lucide-react";
import type { SiteSettings } from "@/types";

export function CenterArtwork({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={`center-artwork ${compact ? "compact" : ""}`}
      aria-hidden="true"
    >
      <div className="center-art-grid" />
      <div className="center-art-symbol">
        <BookOpen strokeWidth={1.2} />
        <span>YUKSALISH EDU</span>
      </div>
      <div className="center-art-bottom">
        <span>
          Bilimga yo‘l.
          <br />
          Kelajakka qadam.
        </span>
        <GraduationCap strokeWidth={1.2} />
      </div>
    </div>
  );
}
export function CenterBanner({
  settings,
  dashboard = false,
}: {
  settings: SiteSettings;
  dashboard?: boolean;
}) {
  return (
    <section
      className={`center-banner ${dashboard ? "dashboard-center-banner" : ""}`}
      aria-label="Yuksalish Edu o‘quv markazi"
    >
      <div className="center-banner-copy">
        <span className="eyebrow">YUKSALISH EDU · O‘QUV MARKAZI</span>
        {dashboard ? (
          <h2>{settings.headline || "Bilim va maqsad sari birga."}</h2>
        ) : (
          <h1>{settings.headline || "Bilim va maqsad sari birga."}</h1>
        )}
        <p>
          {settings.introduction ||
            "Maqsadingizga mos fanni tanlang. Ustoz bilan o‘rganing va ta’lim jarayonini shaxsiy kabinetda kuzating."}
        </p>
        <div className="center-banner-actions">
          <Link
            className="btn"
            href={dashboard ? "/kabinet/center" : "/kurslar"}
          >
            {dashboard ? "Markaz haqida batafsil" : "Kurslarni ko‘rish"}
            <ArrowUpRight size={18} />
          </Link>
          {!dashboard && (
            <Link className="text-link" href="/boglanish">
              Bog‘lanish
            </Link>
          )}
        </div>
      </div>
      <div className="center-banner-media">
        {settings.cover_image ? (
          <Image
            src={settings.cover_image}
            alt={settings.image_caption || "Yuksalish Edu o‘quv markazi"}
            width={1200}
            height={800}
            loading="eager"
            sizes="(max-width: 768px) 100vw, 50vw"
          />
        ) : (
          <CenterArtwork compact={dashboard} />
        )}
      </div>
    </section>
  );
}
export function CenterDetails({
  settings,
  inDashboard = false,
}: {
  settings: SiteSettings;
  inDashboard?: boolean;
}) {
  const sections = [
    {
      icon: BookOpen,
      title: "Maqsadimiz",
      text:
        settings.mission ||
        "Fanlarni izchil o‘rganish, bilimni mustahkamlash va shaxsiy ta’lim maqsadi sari harakat qilishda o‘quvchiga yordam berish.",
    },
    {
      icon: GraduationCap,
      title: "Ta’limga yondashuv",
      text:
        settings.teaching_approach ||
        "Fan bo‘yicha guruh mashg‘ulotlari. Kurs dasturi, dars jadvali va guruh haqida ma’lumotni qabul vaqtida administrator bilan aniqlashtirasiz.",
    },
    {
      icon: CalendarDays,
      title: "Qabul qanday ishlaydi?",
      text:
        settings.admission_steps ||
        "1. Sizga mos fan yoki kursni tanlang.\n2. Saytdan murojaat qoldiring yoki markaz bilan bog‘laning.\n3. Administrator bilan jadval va guruhni kelishing.\n4. Ro‘yxatdan o‘tgach, kabinetni bir martalik kod bilan faollashtiring.",
    },
    {
      icon: HeartHandshake,
      title: "Ota-ona bilan aloqada",
      text: "Administrator biriktirgan ota-ona farzandining jadvali, davomati va to‘lov holatini o‘z kabinetida kuzatadi. Bir nechta farzandni bitta akkaunt orqali tanlash mumkin.",
    },
  ];
  return (
    <div className="center-details">
      <section className="center-story">
        <div>
          <span className="eyebrow">MARKAZ BILAN TANISHING</span>
          <h2>
            O‘rganish uchun ajratilgan vaqt —<br />
            <em>kelajakka e’tibor.</em>
          </h2>
          <p className="pre-line">{settings.about}</p>
          {settings.facilities && (
            <>
              <h3>O‘quv muhiti va sharoitlar</h3>
              <p className="pre-line">{settings.facilities}</p>
            </>
          )}
        </div>
        <figure>
          {settings.about_image ? (
            <Image
              src={settings.about_image}
              alt={settings.image_caption || "Markazdagi o‘quv muhiti"}
              width={800}
              height={600}
            />
          ) : (
            <CenterArtwork />
          )}
          {settings.image_caption && (
            <figcaption>{settings.image_caption}</figcaption>
          )}
        </figure>
      </section>
      <div className="center-info-grid">
        {sections.map(({ icon: Icon, title, text }) => (
          <section className="center-info-card" key={title}>
            <span className="feature-icon">
              <Icon size={23} aria-hidden="true" />
            </span>
            <h2>{title}</h2>
            <p className="pre-line">{text}</p>
          </section>
        ))}
      </div>
      <section className="center-contact-panel">
        <div>
          <span className="eyebrow">SAVOLLARINGIZGA JAVOB BERAMIZ</span>
          <h2>Markaz bilan bog‘laning</h2>
          <p>Kurs, jadval yoki qabul haqida ma’lumot oling.</p>
        </div>
        <div className="center-contact-items">
          {settings.public_phone && (
            <a href={`tel:${settings.public_phone}`}>
              <Phone size={18} aria-hidden="true" />
              <span>
                Telefon<strong>{settings.public_phone}</strong>
              </span>
            </a>
          )}
          {settings.address && (
            <div>
              <MapPin size={18} aria-hidden="true" />
              <span>
                Manzil<strong>{settings.address}</strong>
              </span>
            </div>
          )}
          {settings.working_hours && (
            <div>
              <Clock size={18} aria-hidden="true" />
              <span>
                Ish vaqti<strong>{settings.working_hours}</strong>
              </span>
            </div>
          )}
          <Link
            className="btn secondary"
            href={inDashboard ? "/boglanish" : "/boglanish#ariza"}
          >
            Murojaat qoldirish
            <ArrowUpRight size={17} />
          </Link>
        </div>
      </section>
    </div>
  );
}
