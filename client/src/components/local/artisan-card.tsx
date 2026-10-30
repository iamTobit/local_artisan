import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { CheckCircle2, MapPin, MessageCircle, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api, price, type Category, type Service } from "@/lib/local/api";
import { useAuth } from "@/lib/local/auth";
import { CategoryIcon } from "./shared";
import { ModernArtisanChatModal } from "@/components/common/ModernArtisanChatModal";

export function ArtisanCard({
  service,
  category,
  showProfileLink = true,
}: {
  service: Service;
  category: Category | undefined;
  showProfileLink?: boolean;
}) {
  const { user } = useAuth();
  const [modalOpen, setModalOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [contactUrl, setContactUrl] = useState("");
  async function contact() {
    setBusy(true);
    setError("");
    try {
      const result = await api<{ whatsapp_url: string }>(
        `/marketplace/listings/${service.id}/whatsapp`,
      );
      const url = new URL(result.whatsapp_url);
      if (
        url.protocol !== "https:" ||
        !["wa.me", "api.whatsapp.com", "www.whatsapp.com", "web.whatsapp.com"].includes(
          url.hostname,
        )
      ) {
        throw new Error("The contact link is not a valid WhatsApp address.");
      }
      setContactUrl(url.href);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Contact is unavailable.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <article className="artisan-card" aria-label={service.title}>
      <div className="artisan-card-header">
        {service.artisan_photo_url ? (
          <img
            className="artisan-card-avatar artisan-card-photo"
            src={service.artisan_photo_url}
            alt={service.artisan_name ? `Profile of ${service.artisan_name}` : ""}
          />
        ) : (
          <span className="artisan-card-avatar" aria-hidden="true">
            <CategoryIcon name={category?.icon_name} size={25} />
          </span>
        )}
        <div className="artisan-card-identity">
          <p className="artisan-card-name">{service.artisan_name || "Local artisan"}</p>
          {showProfileLink && (
            <Link
              className="artisan-card-profile-link"
              to="/artisans/$id"
              params={{ id: service.artisan_id }}
            >
              View profile
            </Link>
          )}
          <h2 title={service.title}>{service.title}</h2>
          {service.is_verified !== undefined && (
            <span
              className={
                service.is_verified ? "artisan-card-verification" : "artisan-card-unverified"
              }
            >
              {service.is_verified && <CheckCircle2 size={12} />}
              {service.is_verified ? "Verified artisan" : "Not verified"}
            </span>
          )}
          {(service.county_name ||
            service.sub_county_name ||
            service.distance_km !== undefined) && (
            <span className="artisan-card-location">
              <MapPin size={12} />
              {[service.county_name, service.sub_county_name].filter(Boolean).join(" · ") ||
                `${service.distance_km?.toFixed(1)} km away`}
            </span>
          )}
        </div>
      </div>
      <div className="artisan-card-tags">
        <span>{category?.name || service.specialty || "Service category"}</span>
        <span>
          {service.price_type === "fixed"
            ? "Fixed price"
            : service.price_type === "hourly"
              ? "Hourly"
              : "Negotiable"}
        </span>
      </div>
      <div className="artisan-card-trust" aria-label="Artisan service record">
        {service.review_count !== undefined &&
          (service.review_count > 0 &&
          service.average_rating !== null &&
          service.average_rating !== undefined ? (
            <span
              className="artisan-card-rating"
              aria-label={`${service.average_rating.toFixed(1)} out of 5 from ${service.review_count} reviews`}
            >
              <Star size={13} fill="currentColor" />
              {service.average_rating.toFixed(1)} ({service.review_count}{" "}
              {service.review_count === 1 ? "review" : "reviews"})
            </span>
          ) : (
            <span>No reviews yet</span>
          ))}
        {service.completed_job_count !== undefined && service.completed_job_count > 0 && (
          <span>
            {service.completed_job_count} completed{" "}
            {service.completed_job_count === 1 ? "job" : "jobs"}
          </span>
        )}
      </div>
      <p className="artisan-card-description">{service.description}</p>
      <strong className="artisan-card-price">{price(service)}</strong>
      <div className="artisan-card-actions">
        <Button asChild>
          <Link to="/listing/$id" params={{ id: String(service.id) }}>
            View service
          </Link>
        </Button>
        {!user ? (
          <Button variant="outline" asChild title="Log in to contact the artisan">
            <Link to="/auth" search={{ redirect: `/listing/${service.id}` }}>
              <span className="tech-artisan-chat-btn-pulse" />
              <MessageCircle className="size-4" />
              Chat
            </Link>
          </Button>
        ) : (
          <button
            type="button"
            className="tech-artisan-chat-btn"
            onClick={() => setModalOpen(true)}
            title="Open modern tech artisan chat gateway"
          >
            <span className="tech-artisan-chat-btn-pulse" />
            <MessageCircle className="size-4" />
            <span>Chat</span>
          </button>
        )}
      </div>
      {error && (
        <p className="inline-error artisan-card-error" role="alert">
          {error}
        </p>
      )}

      {/* Modern Tech Artisan Chat & WhatsApp Bridge Modal */}
      <ModernArtisanChatModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        service={service}
      />
    </article>
  );
}
