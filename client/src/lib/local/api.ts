export type Role = "customer" | "artisan" | "admin";
export type UUID = string;
export interface User {
  id: UUID;
  name: string;
  email: string;
  phone?: string;
  role: Role;
  is_blocked: boolean;
  created_at: string;
}
export interface Category {
  id: number;
  name: string;
  slug: string;
  icon_name: string;
}
export interface Location {
  id: number;
  name: string;
  sub_counties?: Location[];
}
export interface Service {
  id: UUID;
  artisan_id: UUID;
  category_id: number;
  title: string;
  description: string;
  price_type: "fixed" | "hourly" | "negotiable";
  base_price: number;
  distance_km?: number;
  artisan_name?: string;
  artisan_photo_url?: string | null;
  is_verified?: boolean;
  specialty?: string;
  county_name?: string;
  sub_county_name?: string;
  average_rating?: number | null;
  review_count?: number;
  completed_job_count?: number;
}
export interface Booking {
  id: UUID;
  scheduled_date: string;
  status: string;
  notes?: string;
  service_title?: string | null;
  artisan_name?: string | null;
  customer_name?: string | null;
  customer_id: UUID;
  artisan_id: UUID;
  service_id: UUID | null;
  created_at: string;
  allowed_actions?: BookingStatusAction[];
}
export type BookingStatusAction = "accepted" | "dispatched" | "completed" | "cancelled";
export interface AvailabilitySlot {
  id: number;
  artisan_id: UUID;
  starts_at: string;
  ends_at: string;
  status: "available" | "booked";
}
export interface Page<T> {
  total: number;
  page: number;
  pages: number;
  items: T[];
}
export interface Profile {
  id?: UUID;
  user_id?: UUID;
  name?: string;
  email?: string;
  phone?: string | null;
  bio?: string | null;
  experience_years?: number;
  primary_phone?: string;
  profile_image?: string | null;
  profile_image_url?: string | null;
  is_verified?: boolean;
  county_id?: number;
  county_name?: string;
  sub_county_id?: number;
  sub_county_name?: string;
  specific_address?: string;
  latitude?: number | null;
  longitude?: number | null;
  work_photos?: string[];
  [key: string]: unknown;
}
export interface PendingArtisan {
  id: UUID;
  user_id: UUID;
  name: string;
  email: string;
  primary_phone: string;
  bio: string | null;
  experience_years: number;
  county_id: number;
  sub_county_id: number;
  specific_address: string;
  latitude: number | null;
  longitude: number | null;
  profile_image: string | null;
  profile_image_url?: string | null;
}
export interface Dispute {
  id: number;
  booking_id: UUID;
  raised_by: UUID;
  reason: string;
  status: string;
  resolution_details: string | null;
  created_at: string;
}
export interface PublicArtisan {
  id: UUID;
  name: string;
  profile_image_url: string | null;
  bio: string | null;
  experience_years: number;
  is_verified: boolean;
  county_name: string;
  sub_county_name: string;
  average_rating: number | null;
  review_count: number;
  completed_job_count: number;
}
export interface PublicArtisanProfile extends PublicArtisan {
  services: Service[];
  work_photos: string[];
}
export interface PublicReview {
  id: number;
  rating: number;
  comment: string | null;
  created_at: string;
}
export interface SavedArtisan {
  saved_at: string;
  artisan: PublicArtisan;
}
export const API_BASE = (
  import.meta.env["VITE_API_BASE_URL"] || "http://127.0.0.1:5000/api"
).replace(/\/$/, "");
const KEY = "local-artisan-session";
export function getStoredAuth(): { access_token: string; user: User } | null {
  if (typeof window === "undefined") return null;
  try {
    const value = JSON.parse(sessionStorage.getItem(KEY) || "null");
    return value?.access_token && value?.user ? value : null;
  } catch {
    return null;
  }
}
export function storeAuth(value: { access_token: string; user: User } | null) {
  if (value) sessionStorage.setItem(KEY, JSON.stringify(value));
  else sessionStorage.removeItem(KEY);
  window.dispatchEvent(new Event("local-auth"));
}
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
export async function api<T>(
  path: string,
  options: { method?: string; body?: unknown; signal?: AbortSignal | undefined } = {},
): Promise<T> {
  const headers = new Headers();
  const token = getStoredAuth()?.access_token;
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const multipart = options.body instanceof FormData;
  if (options.body && !multipart) headers.set("Content-Type", "application/json");
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method: options.method || "GET",
      headers,
      body: options.body
        ? multipart
          ? (options.body as FormData)
          : JSON.stringify(options.body)
        : null,
      signal: options.signal || null,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw error;
    throw new ApiError("We couldn’t connect to Local Artisan. Please try again shortly.", 0);
  }
  const data = await response.json().catch(() => ({}));
  if (response.status === 401) storeAuth(null);
  if (!response.ok) {
    const message =
      typeof data.message === "string"
        ? data.message
        : typeof data.error === "string"
          ? data.error
          : `Request unsuccessful (${response.status}). Please try again.`;
    const detail =
      typeof data.details === "string"
        ? data.details
        : data.details && typeof data.details === "object"
          ? Object.entries(data.details)
              .flatMap(([field, messages]) =>
                (Array.isArray(messages) ? messages : [messages]).map(
                  (item) => `${field}: ${String(item)}`,
                ),
              )
              .join("; ")
          : "";
    throw new ApiError(detail ? `${message}: ${detail}` : message, response.status);
  }
  return data as T;
}
export function queryString(values: Record<string, string | number | undefined>) {
  const params = new URLSearchParams();
  Object.entries(values).forEach(([key, value]) => {
    if (value !== undefined && value !== "") params.set(key, String(value));
  });
  return params.toString();
}
export const price = (service: Service) =>
  service.price_type === "negotiable"
    ? "Price on discussion"
    : `${new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES", maximumFractionDigits: 0 }).format(Number(service.base_price))}${service.price_type === "hourly" ? " / hour" : ""}`;
export const nairobiDate = (value: string) =>
  new Intl.DateTimeFormat("en-KE", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Africa/Nairobi",
  }).format(new Date(/(?:Z|[+-]\d{2}:\d{2})$/i.test(value) ? value : `${value}Z`));
export const nairobiLocalToIso = (value: string) => new Date(`${value}:00+03:00`).toISOString();
export function metadata(title: string, description: string) {
  return {
    meta: [
      { title: `${title} — Local Artisan` },
      { name: "description", content: description },
      { property: "og:title", content: `${title} — Local Artisan` },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  };
}
