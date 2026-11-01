import { ActivationForm } from "@/features/auth/auth-form";
export const metadata = { title: "Kabinetni faollashtirish" };
export default function Activate() {
  return (
    <>
      <h1>Kabinetni faollashtirish</h1>
      <p className="muted">
        Administrator bergan bir martalik kod orqali parol belgilang.
      </p>
      <ActivationForm />
    </>
  );
}
