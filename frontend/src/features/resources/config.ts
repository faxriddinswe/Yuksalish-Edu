import type { User, Row } from "@/types";
export type Field = {
  key: string;
  label: string;
  type?:
    | "password"
    | "text"
    | "textarea"
    | "date"
    | "time"
    | "datetime-local"
    | "number"
    | "checkbox"
    | "select"
    | "multiselect"
    | "roles"
    | "permissions"
    | "file";
  required?: boolean;
  options?: Record<string, string>;
  source?: string;
  placeholder?: string;
  min?: number;
};
export type Resource = {
  title: string;
  description: string;
  endpoint: string;
  fields: Field[];
  columns: string[];
  read: string[];
  write?: string[];
  search?: boolean;
  filters?: Field[];
  immutable?: boolean;
};
const owner = ["OWNER_ADMIN"];
const office = [...owner, "ADMINISTRATOR"];
const finance = [...owner, "ACCOUNTANT"];
const everyone = [...office, "ACCOUNTANT", "TEACHER", "STUDENT", "PARENT"];
const f = (
  key: string,
  label: string,
  type: Field["type"] = "text",
  required = true,
): Field => ({ key, label, type, required });
const ref = (key: string, label: string, source: string): Field => ({
  ...f(key, label, "select"),
  source,
});
const select = (
  key: string,
  label: string,
  options: Record<string, string>,
): Field => ({ ...f(key, label, "select"), options });
const active = { ACTIVE: "Faol", INACTIVE: "Nofaol", ARCHIVED: "Arxiv" };
const publish = { DRAFT: "Qoralama", PUBLISHED: "E’lon qilingan" };
export const resources: Record<string, Resource> = {
  students: {
    title: "O‘quvchilar",
    description: "O‘quvchi profillari, kontaktlar va holatlar.",
    endpoint: "students/",
    read: everyone.filter((role) => role !== "STUDENT"),
    write: office,
    search: true,
    columns: ["full_name", "phone", "registered_on", "status", "certificates"],
    fields: [
      f("full_name", "Ism va familiya"),
      { ...f("phone", "Shaxsiy telefon", "text", false), placeholder: "+998" },
      f("contact_phone", "Kontakt telefoni", "text", false),
      f("registered_on", "Ro‘yxatga olingan sana", "date"),
      select("status", "Holati", active),
      f("internal_notes", "Ichki izoh", "textarea", false),
    ],
    filters: [
      { ...select("status", "Holati", active), required: false },
      {
        ...select("has_certificate", "Sertifikat holati", {
          true: "Sertifikat olganlar",
          false: "Sertifikat olmaganlar",
        }),
        required: false,
      },
      {
        ...ref(
          "certificate_subject",
          "Sertifikat fani",
          "content/achievements/subjects/",
        ),
        required: false,
      },
    ],
  },
  leads: {
    title: "Murojaatlar",
    description:
      "Kursga qiziqqanlar bilan bog‘laning va qabul jarayonini kuzating.",
    endpoint: "leads/",
    read: office,
    write: office,
    search: true,
    columns: ["full_name", "phone", "course", "status", "assigned_to"],
    fields: [
      f("full_name", "Ism"),
      f("phone", "Telefon"),
      { ...ref("course", "Kurs", "courses/"), required: false },
      f("comment", "Murojaat izohi", "textarea", false),
      select("status", "Holati", {
        NEW: "Yangi",
        CONTACTED: "Bog‘lanilgan",
        ENROLLED: "Qabul qilingan",
        CLOSED: "Yopilgan",
      }),
      { ...ref("assigned_to", "Mas’ul xodim", "staff/"), required: false },
      f("internal_notes", "Ichki qayd", "textarea", false),
      f("consent", "Bog‘lanishga rozilik", "checkbox"),
    ],
    filters: [
      {
        ...select("status", "Holati", {
          NEW: "Yangi",
          CONTACTED: "Bog‘lanilgan",
          ENROLLED: "Qabul qilingan",
          CLOSED: "Yopilgan",
        }),
        required: false,
      },
    ],
  },
  parents: {
    title: "Ota-onalar",
    description:
      "Alohida ota-ona akkauntlarini yarating. Bolaga bog‘lash alohida tasdiqlanadi.",
    endpoint: "parents/",
    read: office,
    write: office,
    search: true,
    columns: ["full_name", "phone", "is_active"],
    fields: [
      f("full_name", "Ism va familiya"),
      f("phone", "Telefon"),
      f("is_active", "Faol akkaunt", "checkbox"),
    ],
  },
  "parent-links": {
    title: "Farzandlar va vasiylar",
    description:
      "Faqat tekshirilgan bog‘lanishlarni kiriting. Ism yoki telefon o‘xshashligi avtomatik bog‘lamaydi.",
    endpoint: "parents/links/",
    read: [...office, "PARENT"],
    write: office,
    columns: ["student_name", "parent_name", "relationship"],
    immutable: true,
    fields: [
      ref("student", "O‘quvchi", "students/"),
      ref("parent", "Ota-ona", "parents/"),
      f("relationship", "Qarindoshlik / vasiylik"),
    ],
  },
  staff: {
    title: "Xodimlar va akkauntlar",
    description: "Rollar, aniq vakolatlar va akkaunt takliflari.",
    endpoint: "staff/",
    read: office,
    write: office,
    search: true,
    columns: ["full_name", "phone", "roles", "is_active"],
    filters: [
      {
        ...select("role", "Rol", {
          OWNER_ADMIN: "Rahbar",
          ADMINISTRATOR: "Administrator",
          ACCOUNTANT: "Buxgalter",
          TEACHER: "Ustoz",
          STUDENT: "O‘quvchi",
          PARENT: "Ota-ona",
        }),
        required: false,
      },
    ],
    fields: [
      f("full_name", "Ism va familiya"),
      f("phone", "Telefon"),
      f("roles", "Rollar", "roles"),
      f("extra_permissions", "Qo‘shimcha vakolatlar", "permissions", false),
      f("is_active", "Faol akkaunt", "checkbox"),
    ],
  },
  teachers: {
    title: "Ustozlar",
    description: "Ustoz profili va faqat ommaga ruxsat etilgan kontakt.",
    endpoint: "staff/teachers/",
    read: [...office, "ACCOUNTANT", "TEACHER"],
    write: office,
    search: true,
    columns: [
      "photo",
      "full_name",
      "experience_years",
      "students_taught",
      "publication_status",
    ],
    filters: [
      { ...ref("subjects", "Fan", "subjects/"), required: false },
      {
        ...select("publication_status", "Nashr holati", publish),
        required: false,
      },
    ],
    fields: [
      ref("user", "O‘qituvchi akkaunti", "staff/"),
      f("full_name", "Ommaviy ism"),
      f("slug", "Havola nomi"),
      {
        ...ref("subjects", "Fanlari", "subjects/"),
        type: "multiselect",
        required: false,
      },
      f("biography", "Ustoz haqida qisqacha", "textarea", false),
      {
        ...f("experience_years", "O‘qitish tajribasi (yil)", "number", false),
        min: 0,
      },
      {
        ...f(
          "students_taught",
          "Shu paytgacha dars bergan o‘quvchilar (tasdiqlangan jami)",
          "number",
          false,
        ),
        min: 0,
      },
      f("qualifications", "Malaka, ta’lim va tajriba", "textarea", false),
      f("photo", "Surat", "file", false),
      f("public_phone", "Ommaviy telefon", "text", false),
      select("publication_status", "Nashr holati", publish),
      f("is_active", "Faol", "checkbox"),
    ],
  },
  subjects: {
    title: "Fanlar",
    description: "Markaz fanlarini bazadan boshqaring.",
    endpoint: "subjects/",
    read: [...office, "ACCOUNTANT"],
    write: office,
    search: true,
    columns: ["name", "slug", "is_active"],
    fields: [
      f("name", "Fan nomi"),
      f("slug", "Havola nomi"),
      f("is_active", "Faol", "checkbox"),
    ],
  },
  prices: {
    title: "Fan narxlari",
    description:
      "Narx tarixini saqlang. Yangi narx avvalgi hisoblarni o‘zgartirmaydi.",
    endpoint: "subjects/prices/",
    read: [...office, "ACCOUNTANT"],
    write: finance,
    immutable: true,
    columns: ["subject", "amount", "effective_from"],
    fields: [
      ref("subject", "Fan", "subjects/"),
      { ...f("amount", "Oylik narx (so‘m)", "number"), min: 1 },
      f("effective_from", "Amal qilish boshlanishi", "date"),
    ],
  },
  courses: {
    title: "Kurslar",
    description: "Kurs mazmuni va nashr holati.",
    endpoint: "courses/",
    read: [...office, "ACCOUNTANT"],
    write: office,
    search: true,
    columns: ["name", "subject_name", "monthly_price", "publication_status"],
    filters: [
      { ...ref("subject", "Fan", "subjects/"), required: false },
      {
        ...select("publication_status", "Nashr holati", publish),
        required: false,
      },
    ],
    fields: [
      ref("subject", "Fan", "subjects/"),
      f("name", "Kurs nomi"),
      f("slug", "Havola nomi"),
      {
        ...ref("teachers", "Ustozlar", "staff/teachers/"),
        type: "multiselect",
        required: false,
      },
      f("summary", "Qisqa tavsif", "textarea"),
      f("description", "To‘liq tavsif", "textarea", false),
      f("audience", "Kimlar uchun", "textarea", false),
      f("duration", "Davomiylik (aniq bo‘lsa)", "text", false),
      f("lesson_description", "Dars tartibi", "text", false),
      select("publication_status", "Nashr holati", publish),
      f("featured", "Tanlangan kurs", "checkbox", false),
      f("is_active", "Faol", "checkbox"),
    ],
  },
  groups: {
    title: "Guruhlar",
    description: "Kurs, ustoz va xonaga biriktirilgan guruhlar.",
    endpoint: "groups/",
    read: everyone,
    write: office,
    search: true,
    columns: [
      "name",
      "course_name",
      "teacher_name",
      "room_name",
      "capacity",
      "status",
    ],
    filters: [
      { ...ref("course", "Kurs", "courses/"), required: false },
      { ...ref("teacher", "Ustoz", "staff/teachers/"), required: false },
      {
        ...select("status", "Holati", {
          ACTIVE: "Faol",
          COMPLETED: "Yakunlangan",
          ARCHIVED: "Arxiv",
        }),
        required: false,
      },
    ],
    fields: [
      f("name", "Guruh nomi"),
      ref("course", "Kurs", "courses/"),
      ref("teacher", "Ustoz", "staff/teachers/"),
      ref("room", "Xona", "rooms/"),
      { ...f("capacity", "Sig‘im", "number"), min: 1 },
      f("start_date", "Boshlanish sanasi", "date"),
      f("end_date", "Tugash sanasi", "date", false),
      select("status", "Holati", {
        ACTIVE: "Faol",
        COMPLETED: "Yakunlangan",
        ARCHIVED: "Arxiv",
      }),
    ],
  },
  enrollments: {
    title: "Guruh a’zoliklari",
    description: "Ko‘p fanga a’zolik va guruh almashtirish tarixi.",
    endpoint: "enrollments/",
    read: everyone.filter((role) => role !== "STUDENT"),
    write: office,
    immutable: true,
    columns: ["student_name", "group_name", "start_date", "end_date", "status"],
    filters: [
      { ...ref("group", "Guruh", "groups/"), required: false },
      {
        ...select("status", "Holati", { ACTIVE: "Faol", ENDED: "Yakunlangan" }),
        required: false,
      },
    ],
    fields: [
      ref("student", "O‘quvchi", "students/"),
      ref("group", "Guruh", "groups/"),
      f("start_date", "Boshlanish sanasi", "date"),
    ],
  },
  rooms: {
    title: "Xonalar",
    description: "Dars xonalari va sig‘imi.",
    endpoint: "rooms/",
    read: [...office, "ACCOUNTANT", "TEACHER"],
    write: office,
    search: true,
    columns: ["name", "capacity", "is_active"],
    fields: [
      f("name", "Xona nomi"),
      { ...f("capacity", "Sig‘im", "number"), min: 1 },
      f("is_active", "Faol", "checkbox"),
    ],
  },
  schedule: {
    title: "Haftalik jadval",
    description:
      "Haftalik qoidalardan aniq sanali darslar yarating. Qayta yaratish takrorlamaydi.",
    endpoint: "schedule/",
    read: [...office, "TEACHER"],
    write: office,
    immutable: true,
    columns: [
      "group",
      "weekday",
      "start_time",
      "end_time",
      "valid_from",
      "valid_until",
    ],
    fields: [
      ref("group", "Guruh", "groups/"),
      select("weekday", "Hafta kuni", {
        "0": "Dushanba",
        "1": "Seshanba",
        "2": "Chorshanba",
        "3": "Payshanba",
        "4": "Juma",
        "5": "Shanba",
        "6": "Yakshanba",
      }),
      f("start_time", "Boshlanish vaqti", "time"),
      f("end_time", "Tugash vaqti", "time"),
      f("valid_from", "Amal qilish boshlanishi", "date"),
      f("valid_until", "Amal qilish oxiri", "date"),
    ],
  },
  lessons: {
    title: "Darslar va jadval",
    description:
      "Aniq sanali darslar. Bekor qilingan dars odatiy dars hisoblanmaydi.",
    endpoint: "lessons/",
    read: everyone,
    write: office,
    columns: [
      "group_name",
      "starts_at",
      "ends_at",
      "room_name",
      "teacher_name",
      "status",
    ],
    fields: [
      ref("group", "Guruh", "groups/"),
      ref("teacher", "Ustoz", "staff/teachers/"),
      ref("room", "Xona", "rooms/"),
      f("starts_at", "Boshlanish", "datetime-local"),
      f("ends_at", "Tugash", "datetime-local"),
      select("status", "Holati", {
        SCHEDULED: "Rejalangan",
        COMPLETED: "O‘tilgan",
        CANCELLED: "Bekor qilingan",
      }),
      f("reason", "O‘zgartirish sababi", "textarea", false),
    ],
    filters: [
      f("from", "Sanadan", "date", false),
      f("to", "Sanagacha", "date", false),
    ],
  },
  attendance: {
    title: "Davomat",
    description:
      "Davomat qo‘yilmagan o‘quvchi avtomatik qatnashmagan hisoblanmaydi.",
    endpoint: "attendance/",
    read: everyone.filter((r) => r !== "ACCOUNTANT"),
    write: [...owner, "TEACHER"],
    immutable: true,
    columns: [
      "student_name",
      "group_name",
      "course_name",
      "lesson_date",
      "status",
      "note",
    ],
    fields: [
      ref("lesson", "Dars", "lessons/"),
      ref("student", "O‘quvchi", "students/"),
      select("status", "Davomat holati", {
        PRESENT: "Qatnashgan",
        ABSENT: "Qatnashmagan",
        LATE: "Kechikkan",
        EXCUSED: "Sababli",
      }),
      f("note", "Izoh", "textarea", false),
      f("reason", "Tuzatish sababi", "textarea", false),
    ],
    filters: [
      f("from", "Sanadan", "date", false),
      f("to", "Sanagacha", "date", false),
    ],
  },
  invoices: {
    title: "Oylik hisoblar",
    description:
      "Har fan va oy uchun alohida hisob. Belgilanmagan birinchi oy nol qarz degani emas.",
    endpoint: "billing/invoices/",
    read: everyone.filter((role) => !["TEACHER", "STUDENT"].includes(role)),
    columns: [
      "student_name",
      "subject_name",
      "month",
      "amount",
      "paid_total",
      "balance",
      "payment_state",
    ],
    fields: [],
    filters: [
      f("month", "Oy (oyning 1-sanasi)", "date", false),
      { ...ref("student", "O‘quvchi", "students/"), required: false },
      {
        ...select("state", "Holati", {
          PENDING: "Belgilanishi kerak",
          PAID: "To‘langan",
          PARTIAL: "Qisman to‘langan",
          UNPAID: "To‘lanmagan",
          WAITING: "Muddati kelmagan",
          OVERDUE: "Muddati o‘tgan",
          PREVIOUS: "Oldingi davr qarzi",
        }),
        required: false,
      },
    ],
  },
  payments: {
    title: "To‘lovlar tarixi",
    description:
      "Haqiqiy to‘lov sanasi va tizimga kiritilgan vaqt alohida saqlanadi.",
    endpoint: "billing/payments/",
    read: everyone.filter((r) => r !== "TEACHER"),
    columns: ["student_name", "amount", "paid_on", "created_at", "status"],
    fields: [],
    filters: [
      { ...ref("student", "O‘quvchi", "students/"), required: false },
      f("from", "To‘lov sanasidan", "date", false),
      f("to", "To‘lov sanasigacha", "date", false),
    ],
  },
  adjustments: {
    title: "Moliyaviy tuzatishlar",
    description: "Hisoblarni asoslangan tuzatish tarixi.",
    endpoint: "billing/adjustments/",
    read: finance,
    columns: ["invoice", "amount", "reason", "created_at"],
    fields: [],
  },
  notifications: {
    title: "Bildirishnomalar",
    description: "Siz va sizga biriktirilgan farzandlarga tegishli xabarlar.",
    endpoint: "notifications/",
    read: everyone,
    columns: ["title", "message", "created_at", "read_at", "resolved_at"],
    fields: [],
  },
  settings: {
    title: "Markaz sozlamalari",
    description: "Haqiqiy aloqa ma’lumotlari va markaz ta’rifi.",
    endpoint: "content/settings/",
    read: office,
    write: office,
    columns: ["name", "public_phone", "address", "working_hours"],
    fields: [
      f("headline", "Banner sarlavhasi"),
      f("introduction", "Banner uchun qisqa tanishtiruv", "textarea", false),
      f("about", "Markaz haqida batafsil", "textarea"),
      f("mission", "Markaz maqsadi", "textarea", false),
      f("teaching_approach", "Ta’limga yondashuv", "textarea", false),
      f("facilities", "O‘quv muhiti va sharoitlar", "textarea", false),
      f("admission_steps", "Qabul bosqichlari", "textarea", false),
      f("cover_image", "Banner uchun markaz rasmi", "file", false),
      f("about_image", "Markaz ichki muhiti rasmi", "file", false),
      f("image_caption", "Rasm izohi", "text", false),
      f("public_phone", "Ommaviy telefon", "text", false),
      f("address", "Manzil", "text", false),
      f("working_hours", "Ish vaqti", "text", false),
      f("map_url", "Xarita havolasi (https)", "text", false),
      {
        ...f("telegram_url", "Telegram havolasi", "text", false),
        placeholder: "https://t.me/kanal_nomi",
      },
      {
        ...f("instagram_url", "Instagram havolasi", "text", false),
        placeholder: "https://www.instagram.com/profil_nomi/",
      },
      {
        ...f("linkedin_url", "LinkedIn havolasi", "text", false),
        placeholder: "https://www.linkedin.com/company/markaz_nomi/",
      },
      f("announcement", "Ochiq sayt e’loni", "text", false),
    ],
  },
  faqs: {
    title: "Savol-javob",
    description: "Ochiq saytdagi savol va javoblar.",
    endpoint: "content/faqs/",
    read: office,
    write: office,
    columns: ["question", "answer", "publication_status"],
    fields: [
      f("question", "Savol"),
      f("answer", "Javob", "textarea"),
      f("position", "Tartib", "number"),
      select("publication_status", "Nashr holati", publish),
    ],
  },
  achievements: {
    title: "Sertifikatlar va natijalar",
    description:
      "Faqat rozilik va sertifikat maxfiyligi tekshirilgach e’lon qiling.",
    endpoint: "content/achievements/",
    read: [...office, "TEACHER"],
    write: [...office, "TEACHER"],
    search: true,
    filters: [
      { ...ref("student", "O‘quvchi", "students/"), required: false },
      {
        ...ref("subject", "Fan", "content/achievements/subjects/"),
        required: false,
      },
      { ...ref("teacher", "Ustoz", "staff/teachers/"), required: false },
      {
        ...select("publication_status", "Nashr holati", publish),
        required: false,
      },
    ],
    columns: [
      "image",
      "display_name",
      "student_name",
      "title",
      "subject_name",
      "teacher_name",
      "publication_status",
      "privacy_reviewed",
      "score",
      "is_sample",
    ],
    fields: [
      {
        ...ref("student", "Sertifikat olgan o‘quvchi", "students/"),
        required: false,
      },
      f("display_name", "E’lon qilishga ruxsat etilgan ism"),
      f("title", "Yutuq sarlavhasi"),
      f("description", "Tavsif", "textarea"),
      f("score", "Ball / daraja", "text", false),
      f("is_sample", "Namuna kartochka", "checkbox", false),
      ref("subject", "Fan", "content/achievements/subjects/"),
      {
        ...ref("teacher", "Natijaga tayyorlagan ustoz", "staff/teachers/"),
        required: false,
      },
      f("achieved_on", "Sertifikat yoki natija sanasi", "date", false),
      f("image", "Shaxsiy ma’lumotlari tozalangan rasm", "file", false),
      f("consent_record", "Rozilik qaydi", "textarea"),
      f(
        "privacy_reviewed",
        "Sertifikatdagi ortiqcha shaxsiy ma’lumotlar olib tashlangan",
        "checkbox",
      ),
      select("publication_status", "Nashr holati", publish),
    ],
  },
  audit: {
    title: "Amallar tarixi",
    description: "Muhim amallar tarixi tahrirlanmaydi.",
    endpoint: "audit/",
    read: owner,
    search: true,
    columns: [
      "actor_name",
      "action",
      "entity_type",
      "entity_id",
      "occurred_at",
      "reason",
    ],
    fields: [],
  },
  exports: {
    title: "Excel eksportlar",
    description:
      "Eksport fonda tayyorlanadi va faqat so‘ragan xodimga ochiladi.",
    endpoint: "reports/exports/",
    read: finance,
    columns: ["id", "status", "row_count", "created_at"],
    fields: [],
  },
};
export const labels: Record<string, string> = {
  id: "ID",
  photo: "Surat",
  image: "Sertifikat",
  experience_years: "Tajriba (yil)",
  students_taught: "Dars bergan o‘quvchilar",
  achieved_on: "Natija sanasi",
  cover_image: "Banner rasmi",
  about_image: "Markaz rasmi",
  full_name: "Ism va familiya",
  name: "Nomi",
  phone: "Telefon",
  registered_on: "Ro‘yxat sanasi",
  status: "Holati",
  course: "Kurs ID",
  assigned_to: "Mas’ul ID",
  student_name: "O‘quvchi",
  parent_name: "Ota-ona",
  relationship: "Bog‘lanish",
  is_active: "Faollik",
  roles: "Rollar",
  public_phone: "Ommaviy telefon",
  publication_status: "Nashr holati",
  slug: "Havola nomi",
  subject: "Fan ID",
  amount: "Summa",
  effective_from: "Amal qilish sanasi",
  subject_name: "Fan",
  monthly_price: "Oylik narx",
  course_name: "Kurs",
  teacher_name: "Ustoz",
  room_name: "Xona",
  capacity: "Sig‘im",
  group_name: "Guruh",
  start_date: "Boshlanish",
  end_date: "Tugash",
  weekday: "Hafta kuni",
  start_time: "Boshlanish vaqti",
  end_time: "Tugash vaqti",
  valid_from: "Amal qilish boshlanishi",
  valid_until: "Amal qilish oxiri",
  starts_at: "Boshlanish",
  ends_at: "Tugash",
  lesson_date: "Dars sanasi",
  note: "Izoh",
  month: "Hisob oyi",
  paid_total: "To‘langan",
  balance: "Qoldiq",
  payment_state: "To‘lov holati",
  paid_on: "To‘lov sanasi",
  created_at: "Kiritilgan vaqt",
  invoice: "Hisob ID",
  reason: "Sabab",
  title: "Sarlavha",
  message: "Xabar",
  read_at: "O‘qilgan vaqt",
  resolved_at: "Hal qilingan vaqt",
  address: "Manzil",
  working_hours: "Ish vaqti",
  question: "Savol",
  answer: "Javob",
  display_name: "Ommaviy ism",
  privacy_reviewed: "Maxfiylik tekshirilgan",
  score: "Ball / daraja",
  is_sample: "Namuna",
  certificates: "Sertifikatlar",
  certificate_count: "Sertifikatlar soni",
  actor_name: "Bajargan",
  action: "Amal",
  entity_type: "Obyekt turi",
  entity_id: "Obyekt ID",
  occurred_at: "Vaqt",
  row_count: "Qatorlar",
  internal_notes: "Ichki qayd",
  contact_phone: "Kontakt telefoni",
  before: "Oldingi qiymatlar",
  after: "Yangi qiymatlar",
  allocations: "Taqsimotlar",
  request_id: "So‘rov ID",
  user: "Akkaunt ID",
  student: "O‘quvchi ID",
  group: "Guruh ID",
  teacher: "Ustoz ID",
  room: "Xona ID",
  is_first_month: "Birinchi oy",
  is_opening_balance: "Boshlang‘ich qarz",
  due_date: "To‘lov muddati",
  opening_as_of: "Qarz holati sanasi",
  adjustment_total: "Tuzatishlar",
  total_amount: "Yakuniy hisob",
  void_reason: "Bekor qilish sababi",
  consent_record: "Rozilik qaydi",
  filters: "Filtrlar",
  extra_permissions: "Qo‘shimcha vakolatlar",
  activated_at: "Faollashtirilgan vaqt",
  consent: "Bog‘lanishga rozilik",
  comment: "Murojaat izohi",
};
export function can(user: User, roles?: string[]) {
  return !!roles?.some((role) => user.roles.includes(role));
}
export function canWrite(user: User, key: string) {
  return (
    can(user, resources[key]?.write) ||
    (key === "attendance" &&
      user.extra_permissions.includes("attendance.correct_attendance"))
  );
}
export type RowAction = {
  title: string;
  path: string;
  fields: Field[];
  danger?: boolean;
  confirm?: string;
};
export function actionsFor(key: string, row: Row, user: User): RowAction[] {
  const officeAllowed = can(user, office);
  const financial =
    can(user, finance) ||
    user.extra_permissions.includes("billing.record_payment");
  const correction =
    can(user, finance) ||
    user.extra_permissions.includes("billing.correct_finance");
  const reason = f("reason", "Sabab", "textarea");
  const actions: RowAction[] = [];
  if (key === "students" && officeAllowed && !row.user)
    actions.push({
      title: "Kabinet akkaunti yaratish",
      path: "account/",
      fields: [f("phone", "Noyob login telefoni")],
    });
  if (
    (["staff", "parents"].includes(key) &&
      officeAllowed &&
      row.is_active &&
      (can(user, owner) ||
        !((row.roles as string[]) || []).includes("OWNER_ADMIN"))) ||
    (key === "students" && officeAllowed && row.user)
  )
    actions.push({
      title: "Faollashtirish / tiklash kodi",
      path: "invitation/",
      fields: [
        select("purpose", "Taklif turi", {
          ACTIVATE: "Faollashtirish",
          RESET: "Parolni tiklash",
        }),
      ],
      confirm:
        "Yangi kod avvalgi kodni bekor qiladi. Kod faqat shu oynada ko‘rsatiladi.",
    });
  if (key === "parent-links" && officeAllowed)
    actions.push({
      title: "Bog‘lanishni ajratish",
      path: "unlink/",
      fields: [reason],
      danger: true,
    });
  if (key === "leads" && officeAllowed && !row.converted_student)
    actions.push({
      title: "O‘quvchiga aylantirish",
      path: "convert/",
      fields: [],
      confirm:
        "Murojaatdan o‘quvchi profili yaratiladi. Akkaunt va hisob avtomatik ochilmaydi.",
    });
  if (key === "enrollments" && officeAllowed && row.status === "ACTIVE") {
    actions.push(
      {
        title: "Guruhni almashtirish",
        path: "transfer/",
        fields: [
          ref("group", "Yangi guruh", "groups/"),
          f("on_date", "Ko‘chirish sanasi", "date"),
          reason,
        ],
      },
      {
        title: "A’zolikni yakunlash",
        path: "end/",
        fields: [f("end_date", "Yakun sanasi", "date"), reason],
        danger: true,
      },
    );
  }
  if (key === "schedule" && officeAllowed)
    actions.push({
      title: "Aniq darslar yaratish",
      path: "generate/",
      fields: [],
      confirm:
        "Qoidaning amal qilish oralig‘ida darslar yaratiladi. To‘qnashuv bo‘lsa hech biri saqlanmaydi.",
    });
  if (key === "invoices" && financial && row.status === "PENDING")
    actions.push({
      title: "Birinchi hisobni belgilash",
      path: "confirm/",
      fields: [
        { ...f("amount", "Kelishilgan summa (so‘m)", "number"), min: 1 },
        f("due_date", "To‘lov muddati", "date"),
        reason,
      ],
    });
  if (key === "invoices" && correction && row.status === "CONFIRMED")
    actions.push({
      title: "Hisobni asosli tuzatish",
      path: "adjust/",
      fields: [f("amount", "Tuzatish (+ yoki − so‘m)", "number"), reason],
      confirm:
        "Musbat summa hisobni oshiradi, manfiy summa kamaytiradi. Eski yozuvlar saqlanadi.",
    });
  if (key === "payments" && correction && row.status === "POSTED")
    actions.push({
      title: "To‘lovni bekor qilish",
      path: "void/",
      fields: [reason],
      danger: true,
      confirm: `${row.student_name}: ${row.amount} so‘m. Taqsimotlar hisoblarni qoplashdan chiqariladi; tarix saqlanadi.`,
    });
  if (key === "notifications" && !row.read_at)
    actions.push({ title: "O‘qildi deb belgilash", path: "read/", fields: [] });
  return actions;
}
