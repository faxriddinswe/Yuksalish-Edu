import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import {
  FieldControl,
  RecordForm,
} from "@/features/resources/resource-manager";
afterEach(cleanup);

describe("Kontentni tahrirlash", () => {
  it("Filtr va forma maydonlarining yorliqlari mustaqil ishlaydi", () => {
    const field = {
      key: "publication_status",
      label: "Filtr nashri",
      type: "select" as const,
      options: { DRAFT: "Qoralama", PUBLISHED: "E’lon" },
    };
    render(
      <>
        <FieldControl field={field} value="DRAFT" onChange={() => {}} />
        <FieldControl
          field={{ ...field, label: "Forma nashri" }}
          value="PUBLISHED"
          onChange={() => {}}
        />
      </>,
    );
    expect(screen.getByLabelText("Filtr nashri")).toHaveValue("DRAFT");
    expect(screen.getByLabelText("Forma nashri")).toHaveValue("PUBLISHED");
    expect(screen.getByLabelText("Filtr nashri").id).not.toBe(
      screen.getByLabelText("Forma nashri").id,
    );
  });
  it("Ustoz statistikasi tozalanishi nolga tenglashtirilmaydi", async () => {
    const submit = vi.fn().mockResolvedValue(undefined);
    render(
      <RecordForm
        fields={[
          {
            key: "students_taught",
            label: "Tasdiqlangan son",
            type: "number",
            required: false,
          },
        ]}
        initial={{ id: 1, students_taught: 250 }}
        onSubmit={submit}
      />,
    );
    fireEvent.change(screen.getByLabelText("Tasdiqlangan son"), {
      target: { value: "" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Saqlash" }));
    await waitFor(() =>
      expect(submit).toHaveBeenCalledWith({ students_taught: null }),
    );
  });
  it("Matnni tahrirlash uchun mavjud rasm qayta yuklanishi shart emas", async () => {
    const submit = vi.fn().mockResolvedValue(undefined);
    render(
      <RecordForm
        fields={[
          { key: "photo", label: "Ustoz rasmi", type: "file", required: false },
          { key: "biography", label: "Tavsif", type: "textarea" },
        ]}
        initial={{
          id: 1,
          photo: "/media/teachers/existing.jpg",
          biography: "Avvalgi matn",
        }}
        onSubmit={submit}
      />,
    );
    expect(
      screen.getByRole("button", { name: "Rasmni almashtirish" }),
    ).toBeVisible();
    fireEvent.change(screen.getByLabelText("Tavsif"), {
      target: { value: "Yangi matn" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Saqlash" }));
    await waitFor(() =>
      expect(submit).toHaveBeenCalledWith({
        photo: "/media/teachers/existing.jpg",
        biography: "Yangi matn",
      }),
    );
  });
});
