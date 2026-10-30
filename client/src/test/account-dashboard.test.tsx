import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AccountPage } from "@/components/local/account";

const authState = vi.hoisted(() => ({
  user: { id: "customer-id", name: "Njeri Mwangi", email: "njeri@example.test", role: "customer" },
}));

vi.mock("@/lib/local/auth", () => ({
  useAuth: () => ({ user: authState.user, setSession: vi.fn() }),
}));

vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, children }: { to: string; children: React.ReactNode }) => (
    <a href={to}>{children}</a>
  ),
}));

afterEach(() => vi.restoreAllMocks());

function renderAccount(role: "customer" | "artisan" | "admin") {
  authState.user = {
    id: `${role}-id`,
    name: "Amina Example",
    email: "amina@example.test",
    role,
  };
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <AccountPage />
    </QueryClientProvider>,
  );
}

const booking = {
  id: "booking-uuid",
  scheduled_date: "2026-10-19T07:00:00",
  status: "pending",
  notes: null,
  service_title: "Electrical repair",
  artisan_name: "Amina Artisan",
  customer_name: "Njeri Mwangi",
  customer_id: "customer-id",
  artisan_id: "artisan-id",
  service_id: "service-id",
  created_at: "2026-10-17T07:00:00",
  allowed_actions: [],
};

describe("Role-specific account dashboards", () => {
  it("shows customer booking and saved-artisan activity", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url.endsWith("/bookings/history?page=1&limit=10"))
        return Response.json({ total: 2, page: 1, pages: 1, items: [booking] });
      if (url.endsWith("/marketplace/saved-artisans"))
        return Response.json([{ artisan: { id: "artisan-id" } }]);
      throw new Error(`Unexpected request: ${url}`);
    });

    renderAccount("customer");

    expect(await screen.findByRole("heading", { name: "Your overview" })).toBeInTheDocument();
    expect(screen.getByText("Recent bookings")).toBeInTheDocument();
    expect(await screen.findByText("Electrical repair")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Saved artisans/ })).toHaveAttribute(
      "href",
      "/saved-artisans",
    );
  });

  it("shows artisan verification, catalog, and recent requests", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url.endsWith("/artisan/profile"))
        return Response.json({ profile: { id: "profile-id", is_verified: true } });
      if (url.endsWith("/artisan/services")) return Response.json([{ id: "service-id" }]);
      if (url.endsWith("/bookings/history?page=1&limit=10"))
        return Response.json({ total: 1, page: 1, pages: 1, items: [booking] });
      throw new Error(`Unexpected request: ${url}`);
    });

    renderAccount("artisan");

    expect(await screen.findByRole("heading", { name: "Your work" })).toBeInTheDocument();
    expect(await screen.findByText("Verified")).toBeInTheDocument();
    expect(screen.getByText("Recent requests")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Services/ })).toHaveAttribute("href", "/services");
  });

  it("guides an artisan with no profile to complete setup", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url.endsWith("/artisan/profile")) return Response.json({}, { status: 404 });
      if (url.endsWith("/artisan/services")) return Response.json([]);
      if (url.endsWith("/bookings/history?page=1&limit=10"))
        return Response.json({ total: 0, page: 1, pages: 0, items: [] });
      throw new Error(`Unexpected request: ${url}`);
    });

    renderAccount("artisan");

    expect(await screen.findByText("Setup needed")).toBeInTheDocument();
    expect(screen.getByText("Complete your artisan profile")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Complete setup" })).toHaveAttribute(
      "href",
      "/onboarding",
    );
  });

  it("shows administrative community metrics", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json({
        total_users: 42,
        total_artisans: 17,
        verified_artisans: 12,
        active_disputes: 3,
      }),
    );

    renderAccount("admin");

    expect(await screen.findByRole("heading", { name: "Community overview" })).toBeInTheDocument();
    expect(await screen.findByText("42")).toBeInTheDocument();
    expect(await screen.findByText("17")).toBeInTheDocument();
    expect(await screen.findByText("12")).toBeInTheDocument();
    expect(await screen.findByText("3")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Open administration/ })).toHaveAttribute(
      "href",
      "/admin",
    );
  });
});
