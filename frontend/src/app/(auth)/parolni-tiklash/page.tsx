import { ActivationForm } from "@/features/auth/auth-form";
export const metadata = { title: "Parolni tiklash" };
export default function Reset() {
  return (
    <>
      <h1>Parolni tiklash</h1>
      <ActivationForm reset />
    </>
  );
}
