"use client";
import { announceSessionChange } from "@/lib/auth/session-events";
import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { loginSchema, phoneSchema } from "@/lib/validation";
import { api, errorText } from "@/lib/api/client";
import { ErrorBox } from "@/components/ui";
const subscribeReady = () => () => {};
const clientReady = () => true;
const serverReady = () => false;
function useFormReady() {
  return useSyncExternalStore(subscribeReady, clientReady, serverReady);
}
const activateSchema = z
  .object({
    phone: phoneSchema,
    code: z.string().min(1, "Administrator bergan kodni kiriting."),
    password: z.string().min(10, "Parol kamida 10 ta belgidan iborat bo‘lsin."),
    confirmation: z.string(),
  })
  .refine((v) => v.password === v.confirmation, {
    path: ["confirmation"],
    message: "Parollar mos kelmadi.",
  });
export function LoginForm() {
  const ready = useFormReady();
  const client = useQueryClient();
  const [error, setError] = useState("");
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
  });
  return (
    <form
      className="form-stack"
      method="post"
      noValidate
      onSubmit={handleSubmit(async (values) => {
        setError("");
        try {
          await api("auth/session/", {
            method: "POST",
            body: JSON.stringify(values),
          });
          client.clear();
          announceSessionChange();
          window.location.replace("/kabinet");
        } catch (e) {
          setError(errorText(e));
        }
      })}
    >
      <label htmlFor="phone">Telefon raqamingiz</label>
      <input
        id="phone"
        type="tel"
        autoComplete="username"
        placeholder="+998"
        disabled={!ready}
        {...register("phone")}
        aria-invalid={!!errors.phone}
        aria-describedby="phone-error"
      />
      <span id="phone-error" className="field-error">
        {errors.phone?.message}
      </span>
      <label htmlFor="password">Parol</label>
      <input
        id="password"
        type="password"
        autoComplete="current-password"
        disabled={!ready}
        {...register("password")}
        aria-invalid={!!errors.password}
        aria-describedby="password-error"
      />
      <span id="password-error" className="field-error">
        {errors.password?.message}
      </span>
      <Link className="text-link" href="/parolni-tiklash">
        Parolni unutdingizmi?
      </Link>
      {error && <ErrorBox message={error} />}
      <noscript>Kirish uchun brauzerda JavaScript’ni yoqing.</noscript>
      <button className="btn" disabled={!ready || isSubmitting}>
        {isSubmitting ? "Tekshirilmoqda…" : "Kabinetga kirish"}
      </button>
      <p className="muted">
        Birinchi marta kelyapsizmi?{" "}
        <Link className="text-link" href="/faollashtirish">
          Kabinetni faollashtirish
        </Link>
      </p>
    </form>
  );
}
export function ActivationForm({ reset = false }: { reset?: boolean }) {
  const ready = useFormReady();
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof activateSchema>>({
    resolver: zodResolver(activateSchema),
  });
  return done ? (
    <div role="status">
      <div className="notice success">
        Parol belgilandi. Tizimga kirishingiz mumkin.
      </div>
      <Link className="btn" href="/kirish">
        Kirish
      </Link>
    </div>
  ) : (
    <form
      className="form-stack"
      method="post"
      noValidate
      onSubmit={handleSubmit(async (values) => {
        setError("");
        try {
          await api("auth/activate/", {
            method: "POST",
            body: JSON.stringify({
              ...values,
              purpose: reset ? "RESET" : "ACTIVATE",
            }),
          });
          setDone(true);
        } catch (e) {
          setError(errorText(e));
        }
      })}
    >
      {reset && (
        <p className="notice">
          Markaz administratori shaxsingizni tekshirgach bir martalik tiklash
          kodini beradi. SMS orqali kod yuborilmaydi.
        </p>
      )}
      {(
        [
          {
            key: "phone",
            label: "Telefon raqamingiz",
            type: "tel",
            auto: "username",
          },
          {
            key: "code",
            label: "Administrator bergan kod",
            type: "text",
            auto: "off",
          },
          {
            key: "password",
            label: "Yangi parol",
            type: "password",
            auto: "new-password",
          },
          {
            key: "confirmation",
            label: "Parolni takrorlang",
            type: "password",
            auto: "new-password",
          },
        ] as const
      ).map((f) => (
        <div className="field" key={f.key}>
          <label htmlFor={f.key}>{f.label}</label>
          <input
            id={f.key}
            type={f.type}
            autoComplete={f.auto}
            disabled={!ready}
            {...register(f.key)}
            aria-invalid={!!errors[f.key]}
            aria-describedby={`${f.key}-error`}
          />
          <span id={`${f.key}-error`} className="field-error">
            {errors[f.key]?.message}
          </span>
        </div>
      ))}
      <small className="muted">
        Kod 24 soat amal qiladi va bir marta ishlatiladi. Yangi kod berilsa
        eskisi bekor bo‘ladi. Parol kamida 10 belgi bo‘lsin.
      </small>
      {error && <ErrorBox message={error} />}
      <noscript>Parol belgilash uchun brauzerda JavaScript’ni yoqing.</noscript>
      <button className="btn" disabled={!ready || isSubmitting}>
        {isSubmitting
          ? "Saqlanmoqda…"
          : reset
            ? "Yangi parolni saqlash"
            : "Kabinetni faollashtirish"}
      </button>
      <Link className="text-link" href="/kirish">
        Kirish sahifasiga qaytish
      </Link>
    </form>
  );
}
