import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BrowsePage, type BrowseSearch } from "@/components/local/marketplace";

const navigation = vi.hoisted(() => ({ navigate: vi.fn() }));

vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, children }: { to: string; children: React.ReactNode }) => (
    <a href={to}>{children}</a>
  ),
  useNavigate: () => navigation.navigate,
}));

vi.mock("@/lib/local/auth", () => ({ useAuth: () => ({ user: null }) }));

afterEach(() => {
  navigation.navigate.mockReset();
  vi.restoreAllMocks();
});

function renderBrowse(filters: BrowseSearch) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <BrowsePage filters={filters} />
    </QueryClientProvider>,
  );
}

function mockBrowseRequests() {
  return vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const url = String(input);
    if (url.includes("/marketplace/search"))
      return Response.json({ total: 0, page: 1, pages: 0, items: [] });
    if (url.endsWith("/marketplace/categories") || url.endsWith("/locations/counties"))
      return Response.json([]);
    throw new Error(`Unexpected request: ${url}`);
  });
}

function mockLocationRequests() {
  return vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const url = String(input);
    if (url.includes("/marketplace/search"))
      return Response.json({ total: 0, page: 1, pages: 0, items: [] });
    if (url.endsWith("/marketplace/categories")) return Response.json([]);
    if (url.endsWith("/locations/counties"))
      return Response.json([
        {
          id: 47,
          name: "Nairobi",
          sub_counties: [{ id: 18, name: "Westlands" }],
        },
      ]);
    throw new Error(`Unexpected request: ${url}`);
  });
}

describe("Marketplace search URL state", () => {
  it("syncs the search field when route filters change", async () => {
    mockBrowseRequests();
    const view = renderBrowse({ search_term: "plumbing", page: 1 });
    const input = screen.getByPlaceholderText("Search services…");

    expect(input).toHaveValue("plumbing");
    view.rerender(
      <QueryClientProvider client={new QueryClient()}>
        <BrowsePage filters={{ search_term: "electrical", page: 1 }} />
      </QueryClientProvider>,
    );

    await waitFor(() => expect(input).toHaveValue("electrical"));
  });

  it("waits until search submit to navigate and refetch for a radius change", async () => {
    const fetcher = mockBrowseRequests();
    renderBrowse({ latitude: -1.2864, longitude: 36.8172, radius_km: 10, page: 1 });
    const radius = await screen.findByLabelText("Radius (km)");
    await waitFor(() =>
      expect(
        fetcher.mock.calls.filter(([url]) => String(url).includes("/marketplace/search")),
      ).toHaveLength(1),
    );

    fireEvent.change(radius, { target: { value: "1" } });
    fireEvent.change(radius, { target: { value: "15" } });

    expect(navigation.navigate).not.toHaveBeenCalled();
    expect(
      fetcher.mock.calls.filter(([url]) => String(url).includes("/marketplace/search")),
    ).toHaveLength(1);

    fireEvent.click(screen.getByRole("button", { name: "Search services" }));
    await waitFor(() => expect(navigation.navigate).toHaveBeenCalledTimes(1));
    expect(navigation.navigate).toHaveBeenCalledWith({
      to: "/browse",
      search: {
        latitude: -1.2864,
        longitude: 36.8172,
        radius_km: 15,
        search_term: "",
        page: 1,
      },
    });
  });

  it("loads nested county and subcounty options without a second lookup", async () => {
    mockLocationRequests();
    renderBrowse({ county_id: "47", page: 1 });

    expect(await screen.findByRole("option", { name: "Westlands" })).toBeInTheDocument();
    expect(screen.getByLabelText("County")).toHaveValue("47");
    expect(screen.getByLabelText("Subcounty")).not.toBeDisabled();
  });

  it("clears all active filters and returns to the default browse state", async () => {
    mockBrowseRequests();
    renderBrowse({ search_term: "plumbing", category_slug: "repairs", page: 2 });

    fireEvent.click(await screen.findByRole("button", { name: "Clear filters" }));

    expect(navigation.navigate).toHaveBeenCalledWith({ to: "/browse", search: {} });
    expect(screen.getByPlaceholderText("Search services…")).toHaveValue("");
  });

  it("offers recovery when filters produce no results", async () => {
    mockBrowseRequests();
    renderBrowse({ county_id: "47", page: 1 });

    expect(await screen.findByText("No services found")).toBeInTheDocument();
    expect(screen.getByText("Clear all filters")).toBeInTheDocument();
  });
});
