import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BookingsPage } from "@/components/local/bookings";

const authState = vi.hoisted(() => ({ role: "customer" as "customer" | "artisan" }));

vi.mock("@/lib/local/auth", () => ({
  useAuth: () => ({
    user: { id: "user-id", role: authState.role, phone: "+254700000000" },
  }),
}));

afterEach(() => vi.restoreAllMocks());

function renderBookings(role: "customer" | "artisan", status: string, allowedActions: string[]) {
  authState.role = role;
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    Response.json({
      total: 1,
      page: 1,
      pages: 1,
      items: [
        {
          id: "booking-id",
          scheduled_date: "2026-10-19T07:00:00",
          status,
          notes: null,
          service_title: "Electrical repair",
          artisan_name: "Amina Artisan",
          customer_name: "Njeri Mwangi",
          customer_id: "customer-id",
          artisan_id: "artisan-id",
          service_id: "service-id",
          created_at: "2026-10-17T07:00:00",
          allowed_actions: allowedActions,
        },
      ],
    }),
  );
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <BookingsPage />
    </QueryClientProvider>,
  );
}

describe("Booking status actions", () => {
  it("shows only transitions allowed for an artisan booking", async () => {
    renderBookings("artisan", "pending", ["accepted", "cancelled"]);

    expect(await screen.findByText("Electrical repair")).toBeInTheDocument();
    expect(screen.getByText("Customer: Njeri Mwangi")).toBeInTheDocument();
    expect(screen.queryByText(/customer-id|service-id|artisan-id/)).not.toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "Accept" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Mark dispatched" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Mark completed" })).not.toBeInTheDocument();
  });

  it("does not offer customer cancellation when the backend disallows it", async () => {
    renderBookings("customer", "accepted", []);

    expect(await screen.findByText("Artisan: Amina Artisan")).toBeInTheDocument();
    await screen.findByText("Accepted");
    expect(screen.queryByRole("button", { name: "Cancel booking" })).not.toBeInTheDocument();
  });

  it("shows customer cancellation when the backend allows it", async () => {
    renderBookings("customer", "pending", ["cancelled"]);

    expect(await screen.findByRole("button", { name: "Cancel booking" })).toBeInTheDocument();
  });
});
