import Image from "next/image";
import Link from "next/link";
import {
  UserRound,
  Users,
  BadgeCheck,
  ArrowLeft,
  ArrowUpRight,
  BookOpen,
} from "lucide-react";
import { notFound } from "next/navigation";
import { publicApi, pageMetadata } from "@/lib/api/server";
import { AchievementCard } from "@/components/data-cards";
import type { Teacher, Achievement, Page } from "@/types";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const teacher = await publicApi<Teacher>(`teachers/${slug}/`).catch(
    () => null,
  );
  return teacher
    ? pageMetadata(
        teacher.full_name,
        teacher.biography.slice(0, 160),
        `/ustozlar/${slug}`,
      )
    : { title: "Ustoz topilmadi" };
}
export default async function TeacherPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const teacher = await publicApi<Teacher>(`teachers/${slug}/`).catch(
    () => null,
  );
  if (!teacher) notFound();
  const results = await publicApi<Page<Achievement>>(
    `achievements/?teacher=${teacher.id}&page_size=3`,
  );
  return (
    <section className="container section teacher-detail-page">
      <Link className="text-link back-link" href="/ustozlar">
        <ArrowLeft size={17} />
        Barcha ustozlar
      </Link>
      <div className="teacher-detail-grid">
        <div className="teacher-portrait">
          {teacher.photo ? (
            <Image
              src={teacher.photo}
              alt={`${teacher.full_name} surati`}
              width={720}
              height={900}
              priority
            />
          ) : (
            <UserRound size={100} strokeWidth={1} aria-hidden="true" />
          )}
        </div>
        <div className="teacher-detail-copy">
          <span className="eyebrow">USTOZ BILAN TANISHING</span>
          <h1>{teacher.full_name}</h1>
          <div className="subject-tags">
            {teacher.subject_names.map((name) => (
              <span key={name}>
                <BookOpen size={14} aria-hidden="true" />
                {name}
              </span>
            ))}
          </div>
          <div className="teacher-detail-facts">
            {teacher.experience_years != null && (
              <div>
                <BadgeCheck size={22} />
                <strong>{teacher.experience_years} yil</strong>
                <span>O‘qitish tajribasi</span>
              </div>
            )}
            {teacher.student_count > 0 && (
              <div>
                <Users size={22} />
                <strong>{teacher.student_count} nafar</strong>
                <span>Dars bergan o‘quvchilar</span>
              </div>
            )}
          </div>
          <h2>Ustoz haqida</h2>
          <p className="pre-line">
            {teacher.biography ||
              "Ustoz bilan tanishish va guruhlar haqida ma’lumot olish uchun markazga murojaat qiling."}
          </p>
          {teacher.qualifications && (
            <>
              <h2>Malaka va tajriba</h2>
              <p className="pre-line">{teacher.qualifications}</p>
            </>
          )}
          <div className="hero-actions">
            <Link className="btn" href="/boglanish">
              Guruh haqida so‘rash
              <ArrowUpRight size={17} />
            </Link>
            {teacher.public_phone && (
              <a className="btn secondary" href={`tel:${teacher.public_phone}`}>
                {teacher.public_phone}
              </a>
            )}
          </div>
        </div>
      </div>
      {!!results.count && (
        <section className="teacher-results">
          <div className="section-heading">
            <h2>Ustoz o‘quvchilarining yutuqlari</h2>
            <Link className="text-link" href="/natijalar">
              Barcha natijalar
              <ArrowUpRight size={17} />
            </Link>
          </div>
          <div className="card-grid">
            {results.results.map((result) => (
              <AchievementCard key={result.id} result={result} />
            ))}
          </div>
        </section>
      )}
    </section>
  );
}
