import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AdminPage } from "@/components/local/admin";

afterEach(() => vi.restoreAllMocks());

function renderAdmin() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <AdminPage />
    </QueryClientProvider>,
  );
}

describe("Admin record summaries", () => {
  it("resolves artisan location IDs to county and sub-county names", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url.endsWith("/admin/dashboard/stats")) return Response.json({});
      if (url.endsWith("/admin/artisans/pending?page=1&limit=10"))
        return Response.json({
          total: 1,
          page: 1,
          pages: 1,
          items: [
            {
              id: "profile-uuid",
              user_id: "user-uuid",
              name: "Amina Artisan",
              email: "amina@example.test",
              primary_phone: "+254700000000",
              bio: "Electrical repairs for homes.",
              experience_years: 8,
              county_id: 47,
              sub_county_id: 18,
              specific_address: "Westlands",
              latitude: null,
              longitude: null,
              profile_image: null,
            },
          ],
        });
      if (url.endsWith("/locations/counties"))
        return Response.json([
          { id: 47, name: "Nairobi", sub_counties: [{ id: 18, name: "Westlands" }] },
        ]);
      throw new Error(`Unexpected request: ${url}`);
    });

    renderAdmin();

    expect(await screen.findByText("Nairobi · Westlands")).toBeInTheDocument();
    expect(screen.queryByText("County #47 · Subcounty #18")).not.toBeInTheDocument();
  });

  it("renders disputes in a table with readable statuses", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url.endsWith("/admin/dashboard/stats")) return Response.json({});
      if (url.endsWith("/admin/artisans/pending?page=1&limit=10"))
        return Response.json({ total: 0, page: 1, pages: 0, items: [] });
      if (url.endsWith("/locations/counties")) return Response.json([]);
      if (url.endsWith("/admin/disputes?page=1&limit=10"))
        return Response.json({
          total: 1,
          page: 1,
          pages: 1,
          items: [
            {
              id: 7,
              booking_id: "12345678-1234-1234-1234-123456789abc",
              raised_by: "87654321-4321-4321-4321-cba987654321",
              reason: "The agreed work was not completed.",
              status: "open",
              resolution_details: null,
              created_at: "2026-10-17T07:00:00",
            },
          ],
        });
      throw new Error(`Unexpected request: ${url}`);
    });

    renderAdmin();
    fireEvent.click(screen.getByRole("tab", { name: "Open disputes" }));

    expect(await screen.findByRole("cell", { name: "#7" })).toBeInTheDocument();
    expect(screen.getByText("Open")).toBeInTheDocument();
    expect(screen.getByText("The agreed work was not completed.")).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Booking / account" })).toBeInTheDocument();
    expect(screen.queryByText("booking_id:", { exact: false })).not.toBeInTheDocument();
  });

  it("supports keyboard navigation and semantic tab panels", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url.endsWith("/admin/dashboard/stats")) return Response.json({});
      if (url.endsWith("/admin/artisans/pending?page=1&limit=10"))
        return Response.json({ total: 0, page: 1, pages: 0, items: [] });
      if (url.endsWith("/locations/counties")) return Response.json([]);
      if (url.endsWith("/admin/disputes?page=1&limit=10"))
        return Response.json({ total: 0, page: 1, pages: 0, items: [] });
      throw new Error(`Unexpected request: ${url}`);
    });

    renderAdmin();

    const artisansTab = await screen.findByRole("tab", { name: "Pending artisans" });
    expect(artisansTab).toHaveAttribute("aria-controls", "admin-panel-artisans");
    expect(screen.getByRole("tabpanel")).toHaveAttribute("aria-labelledby", "admin-tab-artisans");

    fireEvent.keyDown(artisansTab, { key: "ArrowRight" });
    expect(screen.getByRole("tab", { name: "Open disputes" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("refetches the active admin data when refresh is clicked", async () => {
    let requestCount = 0;
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      requestCount += 1;
      const url = String(input);
      if (url.endsWith("/admin/dashboard/stats")) return Response.json({});
      if (url.endsWith("/admin/artisans/pending?page=1&limit=10"))
        return Response.json({ total: 0, page: 1, pages: 0, items: [] });
      if (url.endsWith("/locations/counties")) return Response.json([]);
      throw new Error(`Unexpected request: ${url}`);
    });

    renderAdmin();
    await screen.findByText("No pending artisans");
    const initialRequests = requestCount;

    fireEvent.click(screen.getByRole("button", { name: "Refresh admin data" }));

    await waitFor(() => expect(requestCount).toBeGreaterThan(initialRequests));
  });

  it("marks account suspension as a destructive action", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url.endsWith("/admin/dashboard/stats")) return Response.json({});
      if (url.endsWith("/admin/artisans/pending?page=1&limit=10"))
        return Response.json({ total: 0, page: 1, pages: 0, items: [] });
      if (url.endsWith("/locations/counties")) return Response.json([]);
      if (url.endsWith("/auth/users?page=1&limit=10"))
        return Response.json({
          total: 1,
          page: 1,
          pages: 1,
          items: [
            {
              id: "user-uuid",
              name: "Amina Artisan",
              email: "amina@example.test",
              phone: "+254700000000",
              role: "artisan",
              is_blocked: false,
              created_at: "2026-10-17T07:00:00",
            },
          ],
        });
      throw new Error(`Unexpected request: ${url}`);
    });

    renderAdmin();
    fireEvent.click(await screen.findByRole("tab", { name: "Users" }));

    const suspendButton = await screen.findByRole("button", { name: "Suspend" });
    expect(suspendButton.className).toContain("bg-destructive");
    fireEvent.click(suspendButton);

    expect(
      await screen.findByText(/will not be able to use their account until access is restored/i),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Confirm change" }).className).toContain(
      "bg-destructive",
    );
  });

  it("sends admin filters to the server instead of filtering only the visible page", async () => {
    const fetcher = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url.endsWith("/admin/dashboard/stats")) return Response.json({});
      if (url.endsWith("/admin/artisans/pending?page=1&limit=10"))
        return Response.json({ total: 0, page: 1, pages: 0, items: [] });
      if (url.endsWith("/locations/counties")) return Response.json([]);
      if (url.endsWith("/auth/users?page=1&limit=10"))
        return Response.json({ total: 0, page: 1, pages: 0, items: [] });
      if (url.includes("/auth/users?page=1&limit=100&q=Amina"))
        return Response.json({
          total: 2,
          page: 1,
          pages: 1,
          items: [
            {
              id: "amina-uuid",
              name: "Amina Artisan",
              email: "amina@example.test",
              phone: "+254700000000",
              role: "artisan",
              is_blocked: false,
              created_at: "2026-10-17T07:00:00",
            },
            {
              id: "brian-uuid",
              name: "Brian Customer",
              email: "brian@example.test",
              phone: "+254711111111",
              role: "customer",
              is_blocked: false,
              created_at: "2026-10-16T07:00:00",
            },
          ],
        });
      throw new Error(`Unexpected request: ${url}`);
    });

    renderAdmin();
    fireEvent.click(await screen.findByRole("tab", { name: "Users" }));
    fireEvent.change(screen.getByPlaceholderText("Name, email, or phone…"), {
      target: { value: "Amina" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Apply filters" }));

    await waitFor(() =>
      expect(
        fetcher.mock.calls.some(([input]) =>
          String(input).includes("/auth/users?page=1&limit=100&q=Amina"),
        ),
      ).toBe(true),
    );
    expect(await screen.findByRole("status")).toHaveTextContent("Search: Amina");
    expect(screen.getByText("Amina Artisan")).toBeInTheDocument();
    expect(screen.queryByText("Brian Customer")).not.toBeInTheDocument();
  });

  it("shows a success message after verifying an artisan", async () => {
    const fetcher = vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.endsWith("/admin/dashboard/stats")) return Response.json({});
      if (url.endsWith("/locations/counties")) return Response.json([]);
      if (url.endsWith("/admin/artisans/pending?page=1&limit=10"))
        return Response.json({
          total: 1,
          page: 1,
          pages: 1,
          items: [
            {
              id: "profile-uuid",
              user_id: "user-uuid",
              name: "Amina Artisan",
              email: "amina@example.test",
              primary_phone: "+254700000000",
              bio: null,
              experience_years: 8,
              county_id: 47,
              sub_county_id: 18,
              specific_address: "Westlands",
              latitude: null,
              longitude: null,
              profile_image: null,
            },
          ],
        });
      if (url.endsWith("/admin/artisans/profile-uuid/verify") && init?.method === "PATCH")
        return Response.json({ message: "Artisan verified successfully." });
      throw new Error(`Unexpected request: ${url}`);
    });

    renderAdmin();
    fireEvent.click(await screen.findByRole("button", { name: "Verify artisan" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm change" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Artisan verified successfully.");
    expect(fetcher).toHaveBeenCalledWith(
      expect.stringContaining("/admin/artisans/profile-uuid/verify"),
      expect.objectContaining({ method: "PATCH" }),
    );
  });
});
