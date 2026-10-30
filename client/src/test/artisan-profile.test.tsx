import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ArtisanProfilePage, SavedArtisansPage } from "@/components/local/artisan-profile";

const authState = vi.hoisted(() => ({ user: { id: "customer-uuid", role: "customer" } }));

vi.mock("@/lib/local/auth", () => ({
  useAuth: () => ({ user: authState.user, ready: true }),
}));

vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, children }: { to: string; children: React.ReactNode }) => (
    <a href={to}>{children}</a>
  ),
}));

const artisan = {
  id: "artisan-uuid",
  name: "Amina Artisan",
  profile_image_url: null,
  bio: "Careful repairs for homes and small businesses.",
  experience_years: 8,
  is_verified: true,
  county_name: "Nairobi",
  sub_county_name: "Westlands",
  average_rating: 4.5,
  review_count: 11,
  completed_job_count: 18,
};

const profile = {
  ...artisan,
  services: [
    {
      id: "service-uuid",
      artisan_id: artisan.id,
      category_id: 4,
      title: "Home wiring repair",
      description: "Diagnosis and repair for electrical wiring.",
      price_type: "fixed" as const,
      base_price: 2500,
      specialty: "Electrical",
    },
  ],
  work_photos: ["https://api.example.test/work.jpg"],
};

afterEach(() => {
  authState.user = { id: "customer-uuid", role: "customer" };
  vi.restoreAllMocks();
});

function renderWithQueryClient(element: React.ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(<QueryClientProvider client={queryClient}>{element}</QueryClientProvider>);
}

describe("Public artisan profile and saved artisans", () => {
  it("loads profile details, paginates reviews, and saves then removes an artisan", async () => {
    let isSaved = false;
    const fetcher = vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.endsWith("/marketplace/artisans/artisan-uuid/reviews?page=1&limit=10")) {
        return Response.json({
          total: 11,
          page: 1,
          pages: 2,
          items: [
            { id: 81, rating: 5, comment: "Excellent work.", created_at: "2026-10-16T10:00:00" },
          ],
        });
      }
      if (url.endsWith("/marketplace/artisans/artisan-uuid/reviews?page=2&limit=10")) {
        return Response.json({
          total: 11,
          page: 2,
          pages: 2,
          items: [
            {
              id: 80,
              rating: 4,
              comment: "Good communication.",
              created_at: "2026-10-15T10:00:00",
            },
          ],
        });
      }
      if (url.endsWith("/marketplace/artisans/artisan-uuid")) return Response.json(profile);
      if (url.endsWith("/marketplace/saved-artisans") && init?.method === "POST") {
        isSaved = true;
        expect(JSON.parse(String(init.body))).toEqual({ artisan_id: artisan.id });
        return Response.json({ saved: true, artisan }, { status: 201 });
      }
      if (url.endsWith("/marketplace/saved-artisans/artisan-uuid") && init?.method === "DELETE") {
        isSaved = false;
        return Response.json({ saved: false });
      }
      if (url.endsWith("/marketplace/saved-artisans")) {
        return Response.json(isSaved ? [{ saved_at: "2026-10-17T08:00:00", artisan }] : []);
      }
      throw new Error(`Unexpected request: ${url}`);
    });

    renderWithQueryClient(<ArtisanProfilePage id={artisan.id} />);

    expect(await screen.findByRole("heading", { name: artisan.name })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "View profile" })).not.toBeInTheDocument();
    expect(screen.getByText(artisan.bio)).toBeInTheDocument();
    expect(screen.getByText(`${artisan.experience_years} years of experience`)).toBeInTheDocument();
    expect(screen.getByLabelText("4.5 out of 5 stars from 11 reviews")).toBeInTheDocument();
    expect(await screen.findByText("Excellent work.")).toBeInTheDocument();
    expect(screen.getByText("Electrical")).toBeInTheDocument();
    expect(screen.queryByText("Category #4")).not.toBeInTheDocument();
    expect(screen.getByLabelText("About the artisan")).toHaveTextContent(artisan.bio);
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(await screen.findByText("Good communication.")).toBeInTheDocument();
    expect(fetcher).toHaveBeenCalledWith(
      expect.stringContaining("/marketplace/artisans/artisan-uuid/reviews?page=2&limit=10"),
      expect.anything(),
    );

    fireEvent.click(await screen.findByRole("button", { name: "Save profile" }));
    expect(await screen.findByRole("button", { name: "Remove saved profile" })).toBeInTheDocument();
    expect(await screen.findByText("Profile saved.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Remove saved profile" }));
    expect(await screen.findByRole("button", { name: "Save profile" })).toBeInTheDocument();
    expect(await screen.findByText("Profile removed from saved artisans.")).toBeInTheDocument();
    expect(fetcher.mock.calls.some(([, options]) => options?.method === "DELETE")).toBe(true);
  });

  it("shows saved artisans and provides links back to their profiles", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json([{ saved_at: "2026-10-17T08:00:00", artisan }]),
    );

    renderWithQueryClient(<SavedArtisansPage />);

    expect(await screen.findByRole("heading", { name: "Saved artisans" })).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: artisan.name })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View profile" })).toHaveAttribute(
      "href",
      "/artisans/$id",
    );
  });
});
