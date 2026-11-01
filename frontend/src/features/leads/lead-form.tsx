"use client";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { leadSchema } from "@/lib/validation";
import { api, errorText } from "@/lib/api/client";
import { ErrorBox } from "@/components/ui";
import type { Course } from "@/types";
type Values = z.infer<typeof leadSchema>;
export function LeadForm({
  courses,
  courseId,
}: {
  courses: Course[];
  courseId?: number;
}) {
  const [error, setError] = useState("");
  const [done, setDone] = useState("");
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(leadSchema),
    defaultValues: {
      full_name: "",
      phone: "",
      course: courseId ? String(courseId) : "",
      comment: "",
      consent: false,
      website: "",
    },
  });
  async function submit(values: Values) {
    setError("");
    try {
      const result = await api<{ message: string }>("public/leads/", {
        method: "POST",
        body: JSON.stringify({
          ...values,
          course: values.course ? Number(values.course) : null,
        }),
      });
      setDone(result.message);
    } catch (e) {
      setError(errorText(e));
    }
  }
  return done ? (
    <div role="status" className="notice success">
      <h3>Rahmat!</h3>
      <p>{done}</p>
    </div>
  ) : (
    <form className="form-stack" onSubmit={handleSubmit(submit)} noValidate>
      <h2>Murojaat qoldiring</h2>
      <p className="muted">Sizga mos kurs haqida ma’lumot beramiz.</p>
      <label htmlFor="lead-name">Ismingiz</label>
      <input
        id="lead-name"
        autoComplete="name"
        {...register("full_name")}
        aria-invalid={!!errors.full_name}
        aria-describedby="lead-name-error"
      />
      <span id="lead-name-error" className="field-error">
        {errors.full_name?.message}
      </span>
      <label htmlFor="lead-phone">Telefon raqamingiz</label>
      <input
        id="lead-phone"
        type="tel"
        autoComplete="tel"
        placeholder="+998"
        {...register("phone")}
        aria-invalid={!!errors.phone}
        aria-describedby="lead-phone-error"
      />
      <span id="lead-phone-error" className="field-error">
        {errors.phone?.message}
      </span>
      <label htmlFor="lead-course">Qiziqqan kurs</label>
      <select id="lead-course" {...register("course")}>
        <option value="">Tanlashda yordam kerak</option>
        {courses.map((c) => (
          <option value={c.id} key={c.id}>
            {c.name}
          </option>
        ))}
      </select>
      <label htmlFor="lead-comment">Izoh (ixtiyoriy)</label>
      <textarea id="lead-comment" rows={3} {...register("comment")} />
      <div className="honeypot" aria-hidden="true">
        <label htmlFor="lead-site">Veb-sayt</label>
        <input
          id="lead-site"
          tabIndex={-1}
          autoComplete="off"
          {...register("website")}
        />
      </div>
      <label className="checkbox">
        <input
          type="checkbox"
          {...register("consent")}
          aria-describedby="lead-consent-error"
        />
        Murojaatim bo‘yicha markaz xodimi men bilan bog‘lanishiga roziman.
      </label>
      <span id="lead-consent-error" className="field-error">
        {errors.consent?.message}
      </span>
      {error && <ErrorBox message={error} />}
      <button className="btn" disabled={isSubmitting}>
        {isSubmitting ? "Yuborilmoqda…" : "Murojaat yuborish"}
      </button>
      <small className="muted">
        Bu ariza sizga avtomatik akkaunt yoki to‘lov majburiyati yaratmaydi.
      </small>
    </form>
  );
}
