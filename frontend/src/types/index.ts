export type User = {
  id: number;
  full_name: string;
  phone: string;
  roles: string[];
  extra_permissions: string[];
  is_active: boolean;
};
export type Row = { id: number; [key: string]: unknown };
export type Page<T> = {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
};
export type Course = {
  id: number;
  name: string;
  slug: string;
  summary: string;
  description: string;
  audience: string;
  duration: string;
  lesson_description: string;
  subject_name: string;
  monthly_price: string | null;
};
export type Teacher = {
  id: number;
  full_name: string;
  slug: string;
  biography: string;
  photo: string;
  public_phone: string;
  subject_names: string[];
  experience_years: number | null;
  qualifications: string;
  student_count: number;
};
export type Subject = { id: number; name: string; slug: string };
export type Achievement = {
  id: number;
  display_name: string;
  title: string;
  description: string;
  score: string;
  is_sample: boolean;
  subject: number;
  subject_name: string;
  teacher_name: string;
  image: string;
  achieved_on: string | null;
};
export type SocialSettings = {
  telegram_url: string;
  instagram_url: string;
  linkedin_url: string;
};
export type SiteSettings = SocialSettings & {
  id?: number;
  name: string;
  about: string;
  public_phone: string;
  address: string;
  working_hours: string;
  map_url: string;
  announcement: string;
  headline: string;
  introduction: string;
  mission: string;
  teaching_approach: string;
  facilities: string;
  admission_steps: string;
  cover_image: string;
  about_image: string;
  image_caption: string;
  faqs: { id: number; question: string; answer: string }[];
};
