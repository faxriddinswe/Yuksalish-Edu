import { LoginForm } from "@/features/auth/auth-form";
export const metadata = { title: "Kabinetga kirish" };
export default function Login() {
  return (
    <>
      <span className="eyebrow">XUSH KELIBSIZ</span>
      <h1>Kabinetga kirish</h1>
      <p className="muted">Telefon va parolingizni kiriting.</p>
      <LoginForm />
    </>
  );
}
