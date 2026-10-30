import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, CheckCircle2, Heart, MapPin, Star, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  api,
  type Page,
  type PublicArtisan,
  type PublicArtisanProfile,
  type PublicReview,
  type SavedArtisan as SavedArtisanRecord,
} from "@/lib/local/api";
import { useAuth } from "@/lib/local/auth";
import { RoleOnly } from "./account";
import { ArtisanCard } from "./artisan-card";
import { Empty, ErrorNotice, Loading, Pagination } from "./shared";

const REVIEW_PAGE_SIZE = 10;

export function ArtisanProfilePage({ id }: { id: string }) {
  const [reviewPage, setReviewPage] = useState(1);
  const profile = useQuery({
    queryKey: ["public-artisan", id],
    queryFn: ({ signal }) =>
      api<PublicArtisanProfile>(`/marketplace/artisans/${encodeURIComponent(id)}`, { signal }),
    retry: false,
  });
  const reviews = useQuery({
    queryKey: ["artisan-reviews", id, reviewPage],
    queryFn: ({ signal }) =>
      api<Page<PublicReview>>(
        `/marketplace/artisans/${encodeURIComponent(id)}/reviews?page=${reviewPage}&limit=${REVIEW_PAGE_SIZE}`,
        { signal },
      ),
    enabled: Boolean(profile.data),
    retry: false,
  });

  return (
    <main className="container page-main">
      <Button asChild variant="ghost">
        <Link to="/browse">
          <ArrowLeft /> Back to marketplace
        </Link>
      </Button>
      {profile.isLoading ? (
        <Loading />
      ) : profile.error ? (
        <ErrorNotice error={profile.error} retry={() => profile.refetch()} />
      ) : profile.data ? (
        <>
          <ProfileHeader artisan={profile.data} />
          {profile.data.work_photos.length > 0 && (
            <section aria-labelledby="work-photos-heading">
              <h2 className="profile-section-heading" id="work-photos-heading">
                Work photos
              </h2>
              <div className="public-work-gallery">
                {profile.data.work_photos.map((photo, index) => (
                  <img
                    key={photo}
                    src={photo}
                    alt={`${profile.data.name} work photo ${index + 1}`}
                  />
                ))}
              </div>
            </section>
          )}
          <section aria-labelledby="services-heading">
            <h2 className="profile-section-heading" id="services-heading">
              Services
            </h2>
            {profile.data.services.length ? (
              <div className="public-artisan-services-grid">
                {profile.data.services.map((service) => (
                  <ArtisanCard
                    key={service.id}
                    service={service}
                    category={undefined}
                    showProfileLink={false}
                  />
                ))}
              </div>
            ) : (
              <Empty title="No services listed yet" />
            )}
          </section>
          <section aria-labelledby="reviews-heading">
            <h2 className="profile-section-heading" id="reviews-heading">
              Reviews ({profile.data.review_count})
            </h2>
            {reviews.isLoading ? (
              <Loading />
            ) : reviews.error ? (
              <ErrorNotice error={reviews.error} retry={() => reviews.refetch()} />
            ) : reviews.data?.items.length ? (
              <>
                <div className="public-review-list">
                  {reviews.data.items.map((review) => (
                    <article className="public-review" key={review.id}>
                      <div className="public-review-heading">
                        <span
                          className="public-review-rating"
                          aria-label={`${review.rating} out of 5 stars`}
                        >
                          <RatingStars rating={review.rating} />
                          <span>{review.rating} / 5</span>
                        </span>
                        <time dateTime={review.created_at}>
                          {new Intl.DateTimeFormat("en-KE", { dateStyle: "medium" }).format(
                            new Date(review.created_at),
                          )}
                        </time>
                      </div>
                      <p>{review.comment || "No written feedback provided."}</p>
                    </article>
                  ))}
                </div>
                <Pagination
                  page={reviews.data.page}
                  pages={reviews.data.pages}
                  onPage={setReviewPage}
                />
              </>
            ) : (
              <Empty title="No reviews yet" />
            )}
          </section>
        </>
      ) : null}
    </main>
  );
}

function ProfileHeader({ artisan }: { artisan: PublicArtisanProfile }) {
  return (
    <header className="public-artisan-header">
      {artisan.profile_image_url ? (
        <img className="public-artisan-photo" src={artisan.profile_image_url} alt={artisan.name} />
      ) : (
        <span className="public-artisan-placeholder" aria-hidden="true">
          <UserRound size={32} />
        </span>
      )}
      <div className="public-artisan-identity">
        <div className="public-artisan-identity-top">
          <div>
            <div className="section-label">ARTISAN</div>
            <h1 className="page-title">{artisan.name}</h1>
          </div>
          <SaveArtisanButton artisan={artisan} redirectTo={`/artisans/${artisan.id}`} />
        </div>
        <p className="public-artisan-location">
          <MapPin size={14} /> {artisan.county_name} · {artisan.sub_county_name}
        </p>
        {artisan.is_verified && (
          <p className="artisan-card-verification">
            <CheckCircle2 size={14} /> Verified artisan
          </p>
        )}
        <div className="public-artisan-stats">
          {artisan.review_count > 0 && artisan.average_rating !== null ? (
            <span
              className="public-artisan-rating"
              aria-label={`${artisan.average_rating.toFixed(1)} out of 5 stars from ${artisan.review_count} ${artisan.review_count === 1 ? "review" : "reviews"}`}
            >
              <RatingStars rating={artisan.average_rating} />
              <span className="public-artisan-stat-copy">
                {artisan.average_rating.toFixed(1)} · {artisan.review_count}{" "}
                {artisan.review_count === 1 ? "review" : "reviews"}
              </span>
            </span>
          ) : (
            <span>No reviews yet</span>
          )}
          <span>
            {artisan.experience_years > 0
              ? `${artisan.experience_years} years of experience`
              : "Experience not specified"}
          </span>
          <span>
            {artisan.completed_job_count > 0
              ? `${artisan.completed_job_count} completed jobs`
              : "No completed jobs yet"}
          </span>
        </div>
      </div>
      <div className="public-artisan-bio" aria-label="About the artisan">
        <span className="public-artisan-bio-label">About</span>
        <p>{artisan.bio || "This artisan has not added a bio yet."}</p>
      </div>
    </header>
  );
}

function RatingStars({ rating }: { rating: number }) {
  return (
    <span className="rating-stars" aria-hidden="true">
      {Array.from({ length: 5 }, (_, index) => (
        <Star key={index} size={14} fill={index < Math.round(rating) ? "currentColor" : "none"} />
      ))}
    </span>
  );
}

export function SaveArtisanButton({
  artisan,
  redirectTo,
}: {
  artisan: PublicArtisan;
  redirectTo: string;
}) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const saved = useQuery({
    queryKey: ["saved-artisans"],
    queryFn: ({ signal }) => api<SavedArtisanRecord[]>("/marketplace/saved-artisans", { signal }),
    enabled: user?.role === "customer",
    retry: false,
  });

  if (!user) {
    return (
      <Button variant="outline" asChild>
        <Link to="/auth" search={{ redirect: redirectTo }}>
          <Heart /> Save profile
        </Link>
      </Button>
    );
  }
  if (user.role !== "customer") return null;

  const isSaved = saved.data?.some((entry) => entry.artisan.id === artisan.id) ?? false;
  async function toggleSaved() {
    setBusy(true);
    setError("");
    setFeedback("");
    const nextSavedState = !isSaved;
    try {
      if (isSaved) {
        await api<{ saved: false }>(
          `/marketplace/saved-artisans/${encodeURIComponent(artisan.id)}`,
          {
            method: "DELETE",
          },
        );
      } else {
        await api<{ saved: true; artisan: PublicArtisan }>("/marketplace/saved-artisans", {
          method: "POST",
          body: { artisan_id: artisan.id },
        });
      }
      await queryClient.invalidateQueries({ queryKey: ["saved-artisans"] });
      setFeedback(nextSavedState ? "Profile saved." : "Profile removed from saved artisans.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update saved artisans.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <Button
        variant="outline"
        disabled={busy || saved.isLoading || saved.isError}
        onClick={toggleSaved}
        aria-pressed={isSaved}
        aria-busy={busy}
      >
        <Heart fill={isSaved ? "currentColor" : "none"} />
        {busy
          ? isSaved
            ? "Removing…"
            : "Saving…"
          : isSaved
            ? "Remove saved profile"
            : "Save profile"}
      </Button>
      {(error || saved.error) && (
        <p className="inline-error" role="alert">
          {error || saved.error?.message}
        </p>
      )}
      {feedback && (
        <p className="success-notice save-artisan-feedback" role="status" aria-live="polite">
          {feedback}
        </p>
      )}
    </div>
  );
}

export function SavedArtisansPage() {
  return (
    <RoleOnly roles={["customer"]}>
      <SavedArtisansContent />
    </RoleOnly>
  );
}

function SavedArtisansContent() {
  const saved = useQuery({
    queryKey: ["saved-artisans"],
    queryFn: ({ signal }) => api<SavedArtisanRecord[]>("/marketplace/saved-artisans", { signal }),
    retry: false,
  });

  return (
    <>
      <h1 className="page-title">Saved artisans</h1>
      <p className="page-subtitle">The local professionals you want to keep close.</p>
      {saved.isLoading ? (
        <Loading />
      ) : saved.error ? (
        <ErrorNotice error={saved.error} retry={() => saved.refetch()} />
      ) : saved.data?.length ? (
        <div>
          {saved.data.map(({ artisan, saved_at }) => (
            <article className="saved-artisan-row" key={artisan.id}>
              {artisan.profile_image_url ? (
                <img src={artisan.profile_image_url} alt={artisan.name} />
              ) : (
                <span className="saved-artisan-placeholder" aria-hidden="true">
                  <UserRound size={22} />
                </span>
              )}
              <div className="saved-artisan-details">
                <h2>{artisan.name}</h2>
                <p className="form-hint">
                  {artisan.county_name} · {artisan.sub_county_name}
                  {artisan.review_count > 0 && artisan.average_rating !== null
                    ? ` · ${artisan.average_rating.toFixed(1)} (${artisan.review_count} reviews)`
                    : " · No reviews yet"}
                </p>
                <time className="form-hint" dateTime={saved_at}>
                  Saved{" "}
                  {new Intl.DateTimeFormat("en-KE", { dateStyle: "medium" }).format(
                    new Date(saved_at),
                  )}
                </time>
              </div>
              <Button variant="outline" asChild>
                <Link to="/artisans/$id" params={{ id: artisan.id }}>
                  View profile
                </Link>
              </Button>
              <SaveArtisanButton artisan={artisan} redirectTo={`/artisans/${artisan.id}`} />
            </article>
          ))}
        </div>
      ) : (
        <Empty title="No saved artisans yet">
          Browse local services and save an artisan’s profile to find it here.
        </Empty>
      )}
    </>
  );
}
