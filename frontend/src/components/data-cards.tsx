import Image from "next/image";
import Link from "next/link";
import {
  ArrowUpRight,
  BookOpen,
  UserRound,
  Users,
  BadgeCheck,
  Award,
} from "lucide-react";
import { money, dateTime } from "@/lib/formatting";
import type { Course, Teacher, Achievement } from "@/types";
export function CourseCard({
  course,
  index = 0,
}: {
  course: Course;
  index?: number;
}) {
  return (
    <article className="course-card">
      <div className={`course-cover cover-${index % 4}`}>
        <BookOpen size={42} strokeWidth={1.3} aria-hidden="true" />
        <span>{course.subject_name}</span>
        <span className="course-index">
          {String(index + 1).padStart(2, "0")}
        </span>
      </div>
      <div className="course-body">
        <h3>
          <Link href={`/kurslar/${course.slug}`}>{course.name}</Link>
        </h3>
        <p>{course.summary}</p>
        <div className="course-bottom">
          <div>
            <small>Oylik to‘lov</small>
            <strong>
              {course.monthly_price
                ? money(course.monthly_price)
                : "Markazdan aniqlang"}
            </strong>
          </div>
          <Link
            className="icon-btn circle"
            href={`/kurslar/${course.slug}`}
            aria-label={`${course.name} kursi haqida`}
          >
            <ArrowUpRight size={21} />
          </Link>
        </div>
      </div>
    </article>
  );
}
export function TeacherCard({ teacher }: { teacher: Teacher }) {
  return (
    <article className="teacher-card">
      <div className="teacher-photo">
        {teacher.photo ? (
          <Image
            src={teacher.photo}
            alt={`${teacher.full_name} surati`}
            width={400}
            height={400}
          />
        ) : (
          <UserRound size={64} strokeWidth={1} aria-hidden="true" />
        )}
      </div>
      <div className="teacher-card-body">
        <div className="subject-tags">
          {teacher.subject_names?.map((name) => (
            <span key={name}>{name}</span>
          ))}
        </div>
        <h3>
          <Link href={`/ustozlar/${teacher.slug}`}>{teacher.full_name}</Link>
        </h3>
        <p>{teacher.biography.slice(0, 150)}</p>
        <div className="teacher-facts">
          {teacher.experience_years != null && (
            <span>
              <BadgeCheck size={16} aria-hidden="true" />
              {teacher.experience_years} yil tajriba
            </span>
          )}
          {teacher.student_count > 0 && (
            <span>
              <Users size={16} aria-hidden="true" />
              {teacher.student_count
                .toLocaleString("en-US")
                .replaceAll(",", " ")}{" "}
              o‘quvchiga dars bergan
            </span>
          )}
        </div>
        <Link className="text-link" href={`/ustozlar/${teacher.slug}`}>
          Ustoz haqida <ArrowUpRight size={16} />
        </Link>
      </div>
    </article>
  );
}

export function AchievementCard({
  result,
  heading = "h2",
}: {
  result: Achievement;
  heading?: "h2" | "h3";
}) {
  const Heading = heading;
  return (
    <article
      className="achievement-card"
      data-sample={result.is_sample || undefined}
    >
      <a
        className="certificate-preview"
        href={result.image}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`${result.display_name}: ${result.title} sertifikatini kattalashtirish`}
      >
        <Image
          src={result.image}
          alt={`${result.display_name} — ${result.title}`}
          width={600}
          height={800}
        />
        {result.is_sample && <span className="certificate-sample">Namuna</span>}
        <span className="certificate-open">
          <ArrowUpRight size={16} aria-hidden="true" />
          Sertifikatni ochish
        </span>
      </a>
      <div className="achievement-body">
        <div className="achievement-meta">
          <span className="subject-pill">
            <Award size={14} aria-hidden="true" />
            {result.subject_name}
          </span>
          {result.achieved_on && (
            <time dateTime={result.achieved_on}>
              {dateTime(result.achieved_on)}
            </time>
          )}
        </div>
        <Heading className="achievement-student">{result.display_name}</Heading>
        <span className="achievement-title">{result.title}</span>
        {result.score && (
          <div className="achievement-score">
            <span>Ball / daraja</span>
            <strong>{result.score}</strong>
          </div>
        )}
        <p className="pre-line">{result.description}</p>
        <div className="achievement-teacher">
          <UserRound size={17} aria-hidden="true" />
          <span>
            Ustozi<strong>{result.teacher_name || "Ko‘rsatilmagan"}</strong>
          </span>
        </div>
      </div>
    </article>
  );
}
