import { z } from "zod";
export const phoneSchema = z
  .string()
  .min(9, "Telefonni kiriting.")
  .refine((v) => {
    const digits = v.replace(/[\s()-]/g, "");
    return /^\+998\d{9}$/.test(digits) || /^(998)?\d{9}$/.test(digits);
  }, "+998 XX XXX XX XX formatini ishlating.");
export const loginSchema = z.object({
  phone: phoneSchema,
  password: z.string().min(1, "Parolni kiriting."),
});
export const leadSchema = z.object({
  full_name: z.string().min(2, "Ismingizni kiriting.").max(180),
  phone: phoneSchema,
  course: z.string(),
  comment: z.string().max(1000),
  consent: z.boolean().refine(Boolean, "Bog‘lanishga rozilik kerak."),
  website: z.string(),
});
