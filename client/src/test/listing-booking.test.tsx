import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ListingPage } from "@/components/local/marketplace";

vi.mock("@/lib/local/auth", () => ({
  useAuth: () => ({ user: { id: "customer-id", role: "customer" } }),
}));

vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, children }: { to: string; children: React.ReactNode }) => (
    <a href={to}>{children}</a>
  ),
}));

const service = {
  id: "service-uuid",
  artisan_id: "artisan-uuid",
  category_id: 1,
  specialty: "Woodwork",
  title: "Dining set restoration",
  description: "Repair and restoration for wooden dining sets.",
  price_type: "fixed" as const,
  base_price: 2500,
};
const slot = {
  id: 42,
  artisan_id: "artisan-uuid",
  starts_at: "2026-10-17T07:00:00",
  ends_at: "2026-10-17T08:00:00",
  status: "available" as const,
};

afterEach(() => vi.restoreAllMocks());

describe("Listing booking form", () => {
  it("submits the selected availability slot with booking notes", async () => {
    const fetcher = vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.includes("/marketplace/listings/service-uuid")) return Response.json(service);
      if (url.includes("/marketplace/categories")) return Response.json([]);
      if (url.includes("/marketplace/artisans/artisan-uuid/availability"))
        return Response.json([slot]);
      if (url.endsWith("/bookings") && init?.method === "POST")
        return Response.json({ message: "Booking request sent successfully" }, { status: 201 });
      throw new Error(`Unexpected request: ${url}`);
    });
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <ListingPage id="service-uuid" />
      </QueryClientProvider>,
    );

    expect(await screen.findByText("Woodwork")).toBeInTheDocument();
    expect(screen.queryByText("Category #1")).not.toBeInTheDocument();

    fireEvent.change(await screen.findByLabelText("Available date and time"), {
      target: { value: "42" },
    });
    fireEvent.change(screen.getByLabelText("Notes (optional)"), {
      target: { value: "I would like a six-seater dining set restored." },
    });
    fireEvent.click(screen.getByRole("button", { name: /Review booking request/i }));
    expect(
      fetcher.mock.calls.some(
        ([input, init]) => String(input).endsWith("/bookings") && init?.method === "POST",
      ),
    ).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: /Send booking request/i }));

    await screen.findByText("Booking request sent successfully");
    const bookingCall = fetcher.mock.calls.find(
      ([input, init]) => String(input).endsWith("/bookings") && init?.method === "POST",
    );
    expect(bookingCall).toBeDefined();
    expect(JSON.parse(String(bookingCall?.[1]?.body))).toEqual({
      artisan_id: "artisan-uuid",
      service_id: "service-uuid",
      availability_slot_id: 42,
      notes: "I would like a six-seater dining set restored.",
    });
    await waitFor(() => expect(fetcher).toHaveBeenCalled());
  });
});
