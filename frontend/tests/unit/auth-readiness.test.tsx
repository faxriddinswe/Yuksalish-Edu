import { describe, it, expect, afterEach } from "vitest";
import { renderToString } from "react-dom/server";
import { cleanup, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { LoginForm, ActivationForm } from "@/features/auth/auth-form";

afterEach(cleanup);

describe("Autentifikatsiya formalarining tayyorligi", () => {
  for (const mode of ["login", "activation", "reset"] as const) {
    it(`${mode}: server HTML’i maxfiy ma’lumotni GET orqali yubormaydi`, () => {
      const client = new QueryClient();
      const html = renderToString(
        <QueryClientProvider client={client}>
          {mode === "login" ? (
            <LoginForm />
          ) : (
            <ActivationForm reset={mode === "reset"} />
          )}
        </QueryClientProvider>,
      );
      const container = document.createElement("div");
      container.innerHTML = html;
      expect(container.querySelector("form")).toHaveAttribute("method", "post");
      for (const input of container.querySelectorAll("input"))
        expect(input).toBeDisabled();
      expect(container.querySelector("button")).toBeDisabled();
    });
  }

  it("Skript tayyor bo‘lgach kirish formasi ishlaydi", () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <LoginForm />
      </QueryClientProvider>,
    );
    expect(screen.getByLabelText("Telefon raqamingiz")).toBeEnabled();
    expect(screen.getByLabelText("Parol", { exact: true })).toBeEnabled();
    expect(
      screen.getByRole("button", { name: "Kabinetga kirish" }),
    ).toBeEnabled();
  });
});
