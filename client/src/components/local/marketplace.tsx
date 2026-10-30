import { useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  ArrowLeft,
  LocateFixed,
  Search,
  MessageCircle,
  CalendarCheck,
  Sparkles,
  Lock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { techAudio } from "@/lib/artisan-chat-engine";
import {
  api,
  nairobiDate,
  price,
  queryString,
  type AvailabilitySlot,
  type Page,
  type Service,
} from "@/lib/local/api";
import { useAuth } from "@/lib/local/auth";
import { ArtisanCard } from "./artisan-card";
import {
  CategoryIcon,
  Empty,
  ErrorNotice,
  Loading,
  LocationFields,
  Pagination,
  useCategories,
} from "./shared";
export interface BrowseSearch {
  search_term?: string | undefined;
  category_slug?: string | undefined;
  county_id?: string | undefined;
  sub_county_id?: string | undefined;
  page?: number | undefined;
  latitude?: number | undefined;
  longitude?: number | undefined;
  radius_km?: number | undefined;
}
export function BrowsePage({ filters }: { filters: BrowseSearch }) {
  const navigate = useNavigate();
  const [term, setTerm] = useState(filters.search_term || "");
  const [radiusDraft, setRadiusDraft] = useState(String(filters.radius_km || 10));
  const [geoError, setGeoError] = useState("");
  const [geoBusy, setGeoBusy] = useState(false);
  const categories = useCategories();
  const page = filters.page || 1;
  const hasActiveFilters = Boolean(
    filters.search_term ||
    filters.category_slug ||
    filters.county_id ||
    filters.sub_county_id ||
    filters.latitude !== undefined,
  );
  useEffect(() => {
    setTerm(filters.search_term || "");
  }, [filters.search_term]);
  useEffect(() => {
    setRadiusDraft(String(filters.radius_km || 10));
  }, [filters.radius_km]);
  const update = (patch: Partial<BrowseSearch>) =>
    navigate({ to: "/browse", search: { ...filters, ...patch, page: patch.page || 1 } });
  const clearFilters = () => {
    setTerm("");
    setRadiusDraft("10");
    setGeoError("");
    navigate({ to: "/browse", search: {} });
  };
  const results = useQuery({
    queryKey: ["search", filters],
    queryFn: ({ signal }) =>
      api<Page<Service>>(`/marketplace/search?${queryString({ ...filters, page, limit: 12 })}`, {
        signal,
      }),
    retry: false,
  });
  return (
    <main className="container page-main">
      <div className="section-label">SKILLS IN YOUR COMMUNITY</div>
      <h1 className="page-title">Find a service</h1>
      <p className="page-subtitle">The right hands for whatever you have in mind.</p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const radius = Number(radiusDraft);
          if (
            filters.latitude !== undefined &&
            (!Number.isFinite(radius) || radius < 1 || radius > 500)
          ) {
            setGeoError("Choose a search radius between 1 and 500 km.");
            return;
          }
          setGeoError("");
          update({
            search_term: term,
            radius_km: filters.latitude !== undefined ? radius : undefined,
          });
        }}
      >
        <div className="filter-bar">
          <label>
            What are you looking for?
            <input
              placeholder="Search services…"
              value={term}
              onChange={(e) => setTerm(e.target.value)}
            />
          </label>
          <label>
            Category
            <select
              value={filters.category_slug || ""}
              onChange={(e) => update({ category_slug: e.target.value })}
            >
              <option value="">All categories</option>
              {categories.data?.map((c) => (
                <option key={c.id} value={c.slug}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <LocationFields
            county={filters.county_id || ""}
            subcounty={filters.sub_county_id || ""}
            onCounty={(v) => update({ county_id: v, sub_county_id: "" })}
            onSubcounty={(v) => update({ sub_county_id: v })}
          />
        </div>
        <div className="form-actions filter-actions">
          <Button type="submit">
            <Search /> Search services
          </Button>
          <Button
            type="button"
            variant="ghost"
            disabled={!hasActiveFilters && !term}
            onClick={clearFilters}
          >
            Clear filters
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={geoBusy}
            onClick={() => {
              setGeoError("");
              if (!navigator.geolocation) {
                setGeoError("Nearby search is unavailable. Choose a county instead.");
                return;
              }
              setGeoBusy(true);
              navigator.geolocation.getCurrentPosition(
                (pos) => {
                  setGeoBusy(false);
                  update({
                    latitude: pos.coords.latitude,
                    longitude: pos.coords.longitude,
                    radius_km: 10,
                  });
                },
                () => {
                  setGeoBusy(false);
                  setGeoError("We couldn’t access your location. Choose a county instead.");
                },
              );
            }}
          >
            <LocateFixed /> {geoBusy ? "Finding you…" : "Search nearby"}
          </Button>
          {filters.latitude !== undefined && (
            <>
              <label className="radius-label">
                Radius (km)
                <input
                  type="number"
                  min={1}
                  max={500}
                  value={radiusDraft}
                  onChange={(e) => setRadiusDraft(e.target.value)}
                />
              </label>
              <Button
                variant="ghost"
                type="button"
                onClick={() =>
                  update({ latitude: undefined, longitude: undefined, radius_km: undefined })
                }
              >
                Clear nearby
              </Button>
            </>
          )}
        </div>
      </form>
      {geoError && (
        <p className="inline-error" role="alert">
          {geoError}
        </p>
      )}
      {categories.error && (
        <div className="marketplace-category-error">
          <ErrorNotice error={categories.error} retry={() => categories.refetch()} />
        </div>
      )}
      <div className="marketplace-results">
        {results.isLoading ? (
          <Loading />
        ) : results.error ? (
          <ErrorNotice error={results.error} retry={() => results.refetch()} />
        ) : (
          <>
            <p className="form-hint marketplace-result-summary" aria-live="polite">
              {results.data?.total || 0} {results.data?.total === 1 ? "service" : "services"} found
              {hasActiveFilters ? " matching your filters" : ""}
            </p>
            {results.data?.items.length ? (
              <div className="artisan-results-grid">
                {results.data.items.map((service) => {
                  const cat = categories.data?.find((c) => c.id === service.category_id);
                  return <ArtisanCard key={service.id} service={service} category={cat} />;
                })}
              </div>
            ) : (
              <div className="marketplace-no-results">
                <Empty title="No services found" icon={Search}>
                  {hasActiveFilters
                    ? "Try changing your search or clearing one or more filters."
                    : "Try searching for a different service or category."}
                </Empty>
                {hasActiveFilters && (
                  <Button variant="outline" onClick={clearFilters}>
                    Clear all filters
                  </Button>
                )}
              </div>
            )}
            <Pagination
              page={page}
              pages={results.data?.pages || 0}
              onPage={(value) => update({ page: value })}
            />
          </>
        )}
      </div>
    </main>
  );
}
export function ListingPage({ id }: { id: string }) {
  const { user } = useAuth();
  const categories = useCategories();
  const query = useQueryClient();
  const listing = useQuery({
    queryKey: ["listing", id],
    queryFn: ({ signal }) =>
      api<Service>(`/marketplace/listings/${encodeURIComponent(id)}`, { signal }),
    retry: false,
  });
  const availability = useQuery({
    queryKey: ["artisan-availability", listing.data?.artisan_id],
    queryFn: ({ signal }) =>
      api<AvailabilitySlot[]>(
        `/marketplace/artisans/${encodeURIComponent(listing.data!.artisan_id)}/availability`,
        { signal },
      ),
    enabled: Boolean(listing.data?.artisan_id),
    retry: false,
  });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [busy, setBusy] = useState(false);
  const [contactBusy, setContactBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [availabilitySlotId, setAvailabilitySlotId] = useState("");
  const [pendingBooking, setPendingBooking] = useState<{ slotId: number; notes: string } | null>(
    null,
  );
  const service = listing.data;
  function reviewBooking(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!service) return;
    setError("");
    setSuccess("");
    if (!availabilitySlotId) {
      setError("Please select an available appointment time.");
      return;
    }
    const notes = String(new FormData(e.currentTarget).get("notes") || "");
    setPendingBooking({ slotId: Number(availabilitySlotId), notes });
  }
  async function confirmBooking() {
    if (!service || !pendingBooking) return;
    setBusy(true);
    setError("");
    try {
      const result = await api<{ message: string }>("/bookings", {
        method: "POST",
        body: {
          artisan_id: service.artisan_id,
          service_id: service.id,
          availability_slot_id: pendingBooking.slotId,
          notes: pendingBooking.notes,
        },
      });
      setSuccess(result.message || "Your booking request has been sent.");
      setPendingBooking(null);
      query.invalidateQueries({ queryKey: ["bookings"] });
      query.invalidateQueries({ queryKey: ["artisan-availability", service.artisan_id] });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Booking unsuccessful.");
    } finally {
      setBusy(false);
    }
  }
  async function contact() {
    setError("");
    setContactBusy(true);
    try {
      const result = await api<{ whatsapp_url: string }>(
        `/marketplace/listings/${id}/whatsapp?${queryString({ message })}`,
      );
      const url = new URL(result.whatsapp_url);
      if (
        url.protocol !== "https:" ||
        !["wa.me", "api.whatsapp.com", "www.whatsapp.com", "web.whatsapp.com"].includes(
          url.hostname,
        )
      )
        throw new Error("The contact link is not a valid WhatsApp address.");
      window.open(url.href, "_blank", "noopener,noreferrer");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Contact is unavailable.");
    } finally {
      setContactBusy(false);
    }
  }
  return (
    <main className="container page-main">
      <Button asChild variant="ghost">
        <Link to="/browse">
          <ArrowLeft /> Back to services
        </Link>
      </Button>
      {listing.isLoading ? (
        <Loading />
      ) : listing.error ? (
        <ErrorNotice error={listing.error} retry={() => listing.refetch()} />
      ) : (
        service && (
          <div className="detail-grid">
            <section>
              <div className="section-label">
                {categories.data?.find((c) => c.id === service.category_id)?.name ||
                  service.specialty ||
                  "Service category"}
              </div>
              <h1 className="page-title">{service.title}</h1>
              <Link className="text-link" to="/artisans/$id" params={{ id: service.artisan_id }}>
                {service.artisan_name || "View artisan profile"}
              </Link>
              {service.review_count !== undefined && (
                <p className="form-hint listing-meta">
                  {service.review_count > 0 && service.average_rating !== null
                    ? `${service.average_rating?.toFixed(1)} from ${service.review_count} reviews`
                    : "No reviews yet"}
                </p>
              )}
              <div className="price-large">{price(service)}</div>
              <h2 className="detail-section-heading">About this service</h2>
              <p className="service-description">{service.description}</p>
            </section>
            <aside className="booking-panel">
              <h2>Let’s make it happen</h2>
              {!user ? (
                <>
                  <p className="page-subtitle">
                    Sign in to request a booking or contact this artisan.
                  </p>
                  <Button asChild>
                    <Link to="/auth" search={{ redirect: `/listing/${id}` }}>
                      Log in to continue <ArrowRight />
                    </Link>
                  </Button>
                </>
              ) : (
                <>
                  <p className="form-hint">Times are shown in Nairobi time (EAT).</p>
                  {user.role === "customer" && (
                    <form className="form-stack" onSubmit={reviewBooking}>
                      {availability.isLoading ? (
                        <p className="form-hint">Loading available appointment times…</p>
                      ) : availability.error ? (
                        <p className="inline-error" role="alert">
                          Could not load appointment times: {availability.error.message}
                        </p>
                      ) : availability.data?.length ? (
                        <label>
                          Available date and time
                          <select
                            required
                            value={availabilitySlotId}
                            onChange={(e) => setAvailabilitySlotId(e.target.value)}
                          >
                            <option value="">Choose an available time</option>
                            {availability.data.map((slot) => (
                              <option key={slot.id} value={slot.id}>
                                {nairobiDate(slot.starts_at)} – {nairobiDate(slot.ends_at)}
                              </option>
                            ))}
                          </select>
                        </label>
                      ) : (
                        <p className="form-hint">
                          No appointment times are available right now. Contact the artisan to
                          discuss scheduling.
                        </p>
                      )}
                      <label>
                        Notes (optional)
                        <textarea
                          name="notes"
                          maxLength={500}
                          placeholder="Tell the artisan a little about the job…"
                        />
                      </label>
                      <Button
                        disabled={
                          busy ||
                          availability.isLoading ||
                          Boolean(availability.error) ||
                          !availability.data?.length ||
                          !availabilitySlotId
                        }
                        type="submit"
                      >
                        Review booking request
                        <CalendarCheck size={16} />
                      </Button>
                    </form>
                  )}
                  <div className="form-section">
                    <label>
                      <span className="flex items-center justify-between">
                        <span>Message to Artisan (optional)</span>
                        <span className="text-[11px] font-mono opacity-60">{message.length}/1000</span>
                      </span>
                      <textarea
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        maxLength={1000}
                        placeholder="What would you like to discuss? (e.g. site visit, quotation, emergency)..."
                      />
                    </label>

                    {/* Modern Tech Quick Inquiry Chips */}
                    <div className="flex flex-wrap gap-1.5 mb-2.5">
                      {[
                        "Are you available for an urgent job?",
                        "Could you send an estimated quote?",
                        "Can we arrange an on-site visit?",
                      ].map((prompt, idx) => (
                        <button
                          key={idx}
                          type="button"
                          className="text-[11.5px] px-2.5 py-1 rounded-md bg-secondary border border-border/80 hover:border-primary/50 text-foreground transition-all cursor-pointer text-left"
                          onClick={() => {
                            techAudio.playClickBlip();
                            setMessage(prompt);
                          }}
                        >
                          <Sparkles className="size-2.5 inline mr-1 text-primary" />
                          {prompt}
                        </button>
                      ))}
                    </div>

                    <button
                      type="button"
                      className="tech-artisan-chat-btn w-full justify-center !py-2.5 !text-sm"
                      disabled={contactBusy}
                      onClick={() => {
                        techAudio.playClickBlip();
                        contact();
                      }}
                    >
                      <span className="tech-artisan-chat-btn-pulse" />
                      <MessageCircle className="size-4" />
                      <span>{contactBusy ? "Opening Secure WhatsApp..." : "Start Chat on WhatsApp"}</span>
                    </button>
                    <p className="text-[11px] text-muted-foreground flex items-center justify-center gap-1.5 mt-2 font-mono">
                      <Lock className="size-3 text-primary" /> 256-bit encrypted WhatsApp link
                    </p>
                  </div>
                </>
              )}
              {error && (
                <p className="inline-error listing-feedback" role="alert">
                  {error}
                </p>
              )}
              {success && (
                <div className="success-notice listing-feedback" role="status">
                  {success}
                  <Link className="text-link listing-bookings-link" to="/bookings">
                    View my bookings <ArrowRight size={14} />
                  </Link>
                </div>
              )}
            </aside>
          </div>
        )
      )}
      <Dialog
        open={!!pendingBooking}
        onOpenChange={(open) => {
          if (!open && !busy) setPendingBooking(null);
        }}
      >
        <DialogContent className="booking-action-dialog">
          <DialogTitle className="booking-action-title">Confirm booking request</DialogTitle>
          <DialogDescription className="booking-action-description">
            Review the appointment details before sending your request. The artisan will need to
            accept it before the booking is confirmed.
          </DialogDescription>
          <div className="booking-review-summary">
            <strong>{service?.title}</strong>
            <span>{service?.artisan_name || "Selected artisan"}</span>
            <span>
              {pendingBooking && availability.data
                ? (() => {
                    const selected = availability.data.find(
                      (slot) => slot.id === pendingBooking.slotId,
                    );
                    return selected
                      ? `${nairobiDate(selected.starts_at)} – ${nairobiDate(selected.ends_at)}`
                      : "Selected appointment time";
                  })()
                : "Selected appointment time"}
            </span>
            {pendingBooking?.notes && <span>Notes: {pendingBooking.notes}</span>}
          </div>
          <div className="booking-action-actions form-actions">
            <Button type="button" disabled={busy} onClick={confirmBooking}>
              {busy ? "Sending request…" : "Send booking request"}
            </Button>
            <Button
              variant="ghost"
              type="button"
              disabled={busy}
              onClick={() => setPendingBooking(null)}
            >
              Back to edit
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </main>
  );
}
