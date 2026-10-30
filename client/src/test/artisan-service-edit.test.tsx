import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ServicesPage } from "@/components/local/artisan";
import type { Service } from "@/lib/local/api";

const service: Service = {
  id: "service-uuid",
  artisan_id: "artisan-uuid",
  category_id: 4,
  title: "Home wiring repair",
  description: "Diagnosis and repair for residential electrical wiring.",
  price_type: "fixed",
  base_price: 2500,
};

afterEach(() => vi.restoreAllMocks());

describe("Artisan service editing", () => {
  it("prefills the form, supports cancel, and submits edits with PUT", async () => {
    let savedService = service;
    const fetcher = vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.endsWith("/marketplace/categories"))
        return Response.json([
          { id: 4, name: "Electrician", slug: "electrician", icon_name: "Zap" },
        ]);
      if (url.endsWith("/bookings/availability")) return Response.json([]);
      if (url.endsWith("/artisan/services/service-uuid") && init?.method === "PUT") {
        savedService = JSON.parse(String(init.body)) as Service;
        return Response.json({ message: "Service updated successfully", service: savedService });
      }
      if (url.endsWith("/artisan/services")) return Response.json([savedService]);
      throw new Error(`Unexpected request: ${url}`);
    });
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    render(
      <QueryClientProvider client={queryClient}>
        <ServicesPage />
      </QueryClientProvider>,
    );

    fireEvent.click(await screen.findByRole("button", { name: "Edit Home wiring repair" }));
    expect(screen.getByRole("heading", { name: "Edit Home wiring repair" })).toBeInTheDocument();
    expect(screen.getByLabelText("Service title")).toHaveValue("Home wiring repair");
    expect(screen.getByLabelText("Category")).toHaveValue("4");
    expect(screen.getByLabelText("Pricing")).toHaveValue("fixed");
    expect(screen.getByLabelText("Base price (KES)")).toHaveValue(2500);

    fireEvent.click(screen.getByRole("button", { name: "Cancel edit" }));
    expect(screen.getByRole("heading", { name: "Add a service" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cancel edit" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Edit Home wiring repair" }));
    fireEvent.change(screen.getByLabelText("Service title"), {
      target: { value: "Updated wiring repair" },
    });
    fireEvent.change(screen.getByLabelText("Pricing"), { target: { value: "hourly" } });
    fireEvent.change(screen.getByLabelText("Base price (KES)"), { target: { value: "3200" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Service updated successfully");
    await waitFor(() =>
      expect(fetcher).toHaveBeenCalledWith(
        expect.stringContaining("/artisan/services/service-uuid"),
        expect.objectContaining({ method: "PUT" }),
      ),
    );
    const updateCall = fetcher.mock.calls.find(([, options]) => options?.method === "PUT");
    expect(JSON.parse(String(updateCall?.[1]?.body))).toEqual({
      category_id: 4,
      title: "Updated wiring repair",
      description: service.description,
      price_type: "hourly",
      base_price: 3200,
    });
  });

  it("removes a service and clears the editor when the active service is deleted", async () => {
    let deleted = false;
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.endsWith("/marketplace/categories")) return Response.json([]);
      if (url.endsWith("/bookings/availability")) return Response.json([]);
      if (url.endsWith("/artisan/services/service-uuid") && init?.method === "DELETE") {
        deleted = true;
        return Response.json({ message: "Service deleted successfully" });
      }
      if (url.endsWith("/artisan/services")) return Response.json(deleted ? [] : [service]);
      throw new Error(`Unexpected request: ${url}`);
    });
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    render(
      <QueryClientProvider client={queryClient}>
        <ServicesPage />
      </QueryClientProvider>,
    );

    fireEvent.click(await screen.findByRole("button", { name: "Edit Home wiring repair" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete Home wiring repair" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete service" }));

    expect(await screen.findByRole("status")).toHaveTextContent(
      "Home wiring repair” was removed from your catalog",
    );
    expect(screen.getByRole("heading", { name: "Add a service" })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Edit Home wiring repair" }),
    ).not.toBeInTheDocument();
  });

  it("blocks invalid and overlapping availability before sending a request", async () => {
    const fetcher = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url.endsWith("/marketplace/categories")) return Response.json([]);
      if (url.endsWith("/artisan/services")) return Response.json([]);
      if (url.endsWith("/bookings/availability"))
        return Response.json([
          {
            id: 12,
            artisan_id: "artisan-uuid",
            starts_at: "2099-04-20T05:00:00.000Z",
            ends_at: "2099-04-20T06:00:00.000Z",
            status: "available",
          },
        ]);
      throw new Error(`Unexpected request: ${url}`);
    });
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    render(
      <QueryClientProvider client={queryClient}>
        <ServicesPage />
      </QueryClientProvider>,
    );

    const startsAt = await screen.findByLabelText("Starts at (Nairobi time)");
    const endsAt = screen.getByLabelText("Ends at (Nairobi time)");
    await waitFor(() =>
      expect(
        fetcher.mock.calls.some(([input]) => String(input).endsWith("/bookings/availability")),
      ).toBe(true),
    );
    fireEvent.change(startsAt, { target: { value: "2099-04-20T08:00" } });
    fireEvent.change(endsAt, { target: { value: "2099-04-20T08:30" } });
    fireEvent.click(screen.getByRole("button", { name: "Add appointment time" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("overlaps an existing");
    expect(fetcher.mock.calls.some(([, options]) => options?.method === "POST")).toBe(false);
  });
});
