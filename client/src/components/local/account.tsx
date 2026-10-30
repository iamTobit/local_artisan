import { useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  Bookmark,
  BriefcaseBusiness,
  CalendarDays,
  ShieldCheck,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  ApiError,
  api,
  getStoredAuth,
  nairobiDate,
  type Booking,
  type Page,
  type Profile,
  type Role,
  type SavedArtisan,
  type Service,
  type User,
} from "@/lib/local/api";
import { useAuth } from "@/lib/local/auth";
import { Empty, ErrorNotice, Loading } from "./shared";
export function AccountLayout({ children }: { children: ReactNode }) {
  const { user, ready } = useAuth();
  if (!ready || !user) return <Loading />;
  return (
    <main className="container page-main">
      <div className="section-label">YOUR LOCAL ARTISAN</div>
      <div className="workspace-nav">
        <Link to="/workspace">My account</Link>
        {user.role !== "admin" && <Link to="/bookings">Bookings</Link>}
        {user.role === "customer" && <Link to="/saved-artisans">Saved artisans</Link>}
        {user.role === "artisan" && (
          <>
            <Link to="/onboarding">Artisan setup</Link>
            <Link to="/services">My services</Link>
          </>
        )}
        {user.role === "admin" && <Link to="/admin">Administration</Link>}
      </div>
      {children}
    </main>
  );
}
export function RoleOnly({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const { user, ready } = useAuth();
  if (!ready) return <Loading />;
  if (!user || !roles.includes(user.role))
    return (
      <div>
        <h1 className="page-title">This area isn’t available for your account.</h1>
        <Link className="text-link" to="/workspace">
          Back to my account
        </Link>
      </div>
    );
  return <>{children}</>;
}
export function AccountPage() {
  const { user, setSession } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  if (!user) return <Loading />;
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setSuccess("");
    const f = new FormData(e.currentTarget);
    try {
      const result = await api<{ message: string; user: User }>("/auth/profile", {
        method: "PUT",
        body: { name: String(f.get("name")).trim(), phone: String(f.get("phone") || "").trim() },
      });
      const token = getStoredAuth()?.access_token;
      if (token) setSession(token, result.user);
      setSuccess(result.message || "Your account has been updated.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update unsuccessful.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <h1 className="page-title">Hello, {user.name}.</h1>
      <p className="page-subtitle">
        {user.role === "artisan"
          ? "A place for your craft, your services, and your next opportunity."
          : user.role === "admin"
            ? "Manage the community and keep connections running smoothly."
            : "Your next project, and the people who can make it happen."}
      </p>
      <RoleDashboard role={user.role} />
      <section className="form-section max-w-2xl">
        <h2>Your details</h2>
        <form className="form-stack" onSubmit={submit}>
          <label>
            Name
            <input name="name" required minLength={2} maxLength={100} defaultValue={user.name} />
          </label>
          <label>
            Email
            <input type="email" value={user.email} disabled />
          </label>
          <label>
            Phone number
            <input
              name="phone"
              type="tel"
              defaultValue={user.phone || ""}
              placeholder="+254 7XX XXX XXX"
            />
          </label>
          {error && (
            <p className="inline-error" role="alert">
              {error}
            </p>
          )}
          {success && (
            <p className="success-notice" role="status">
              {success}
            </p>
          )}
          <Button type="submit" disabled={busy}>
            {busy ? "Saving…" : "Save details"}
          </Button>
        </form>
      </section>
    </>
  );
}

type DashboardLink =
  "/bookings" | "/saved-artisans" | "/services" | "/onboarding" | "/admin" | "/browse";

function DashboardMetric({
  label,
  value,
  detail,
  icon,
  to,
  loading = false,
}: {
  label: string;
  value: string | number;
  detail: string;
  icon: ReactNode;
  to: DashboardLink;
  loading?: boolean;
}) {
  return (
    <Link className="dashboard-metric" to={to}>
      <span className="dashboard-metric-label">
        {icon}
        {label}
      </span>
      <strong>{loading ? <span className="dashboard-metric-skeleton" /> : value}</strong>
      <span className="dashboard-metric-detail">{detail}</span>
    </Link>
  );
}

function RoleDashboard({ role }: { role: Role }) {
  if (role === "customer") return <CustomerDashboard />;
  if (role === "artisan") return <ArtisanDashboard />;
  return <AdminDashboard />;
}

function CustomerDashboard() {
  const bookings = useQuery({
    queryKey: ["bookings", 1],
    queryFn: ({ signal }) => api<Page<Booking>>("/bookings/history?page=1&limit=10", { signal }),
    retry: false,
  });
  const saved = useQuery({
    queryKey: ["saved-artisans"],
    queryFn: ({ signal }) => api<SavedArtisan[]>("/marketplace/saved-artisans", { signal }),
    retry: false,
  });

  return (
    <section className="account-dashboard" aria-labelledby="account-overview-heading">
      <h2 id="account-overview-heading">Your overview</h2>
      <div className="dashboard-metrics">
        <DashboardMetric
          label="Bookings"
          value={bookings.data?.total ?? "—"}
          loading={bookings.isLoading}
          detail="Requests and history"
          icon={<CalendarDays />}
          to="/bookings"
        />
        <DashboardMetric
          label="Saved artisans"
          value={saved.data?.length ?? "—"}
          loading={saved.isLoading}
          detail="Profiles to revisit"
          icon={<Bookmark />}
          to="/saved-artisans"
        />
        <DashboardMetric
          label="Find a service"
          value="Browse"
          detail="Explore local skills"
          icon={<ArrowRight />}
          to="/browse"
        />
      </div>
      {bookings.error && <ErrorNotice error={bookings.error} retry={() => bookings.refetch()} />}
      {saved.error && <ErrorNotice error={saved.error} retry={() => saved.refetch()} />}
      <RecentBookings
        bookings={bookings.data?.items || []}
        role="customer"
        loading={bookings.isLoading}
        error={bookings.error}
        retry={() => bookings.refetch()}
      />
    </section>
  );
}

function ArtisanDashboard() {
  const profile = useQuery({
    queryKey: ["artisan-profile"],
    queryFn: ({ signal }) => api<{ profile: Profile }>("/artisan/profile", { signal }),
    retry: false,
  });
  const services = useQuery({
    queryKey: ["artisan-services"],
    queryFn: ({ signal }) => api<Service[]>("/artisan/services", { signal }),
    retry: false,
  });
  const bookings = useQuery({
    queryKey: ["bookings", 1],
    queryFn: ({ signal }) => api<Page<Booking>>("/bookings/history?page=1&limit=10", { signal }),
    retry: false,
  });
  const profileStatus = profile.isLoading
    ? "…"
    : profile.data?.profile.is_verified
      ? "Verified"
      : profile.error instanceof ApiError && profile.error.status === 404
        ? "Setup needed"
        : profile.data
          ? "In review"
          : "Unavailable";

  return (
    <section className="account-dashboard" aria-labelledby="account-overview-heading">
      <h2 id="account-overview-heading">Your work</h2>
      <div className="dashboard-metrics">
        <DashboardMetric
          label="Profile"
          value={profileStatus}
          loading={profile.isLoading}
          detail={profileStatus === "Verified" ? "Visible to customers" : "Check your profile"}
          icon={<ShieldCheck />}
          to="/onboarding"
        />
        <DashboardMetric
          label="Services"
          value={services.data?.length ?? "—"}
          loading={services.isLoading}
          detail="In your catalog"
          icon={<BriefcaseBusiness />}
          to="/services"
        />
        <DashboardMetric
          label="Bookings"
          value={bookings.data?.total ?? "—"}
          loading={bookings.isLoading}
          detail="Requests and history"
          icon={<CalendarDays />}
          to="/bookings"
        />
      </div>
      {profile.error && !(profile.error instanceof ApiError && profile.error.status === 404) && (
        <ErrorNotice error={profile.error} retry={() => profile.refetch()} />
      )}
      {profile.error instanceof ApiError && profile.error.status === 404 && (
        <div className="dashboard-attention">
          <div>
            <strong>Complete your artisan profile</strong>
            <p>
              Add your location, experience, and contact details to become visible to customers.
            </p>
          </div>
          <Button asChild size="sm">
            <Link to="/onboarding">Complete setup</Link>
          </Button>
        </div>
      )}
      {services.error && <ErrorNotice error={services.error} retry={() => services.refetch()} />}
      <RecentBookings
        bookings={bookings.data?.items || []}
        role="artisan"
        loading={bookings.isLoading}
        error={bookings.error}
        retry={() => bookings.refetch()}
      />
    </section>
  );
}

interface AdminStats {
  total_users: number;
  total_artisans: number;
  verified_artisans: number;
  active_disputes: number;
}

function AdminDashboard() {
  const stats = useQuery({
    queryKey: ["admin-stats"],
    queryFn: ({ signal }) => api<AdminStats>("/admin/dashboard/stats", { signal }),
    retry: false,
  });

  return (
    <section className="account-dashboard" aria-labelledby="account-overview-heading">
      <h2 id="account-overview-heading">Community overview</h2>
      {stats.isLoading ? (
        <Loading />
      ) : stats.error ? (
        <ErrorNotice error={stats.error} retry={() => stats.refetch()} />
      ) : stats.data ? (
        <div className="dashboard-metrics">
          <DashboardMetric
            label="Total users"
            value={stats.data.total_users}
            detail="Community accounts"
            icon={<Users />}
            to="/admin"
          />
          <DashboardMetric
            label="Artisans"
            value={stats.data.total_artisans}
            detail="Registered providers"
            icon={<BriefcaseBusiness />}
            to="/admin"
          />
          <DashboardMetric
            label="Verified artisans"
            value={stats.data.verified_artisans}
            detail="Approved profiles"
            icon={<ShieldCheck />}
            to="/admin"
          />
          <DashboardMetric
            label="Active disputes"
            value={stats.data.active_disputes}
            detail="Requiring review"
            icon={<CalendarDays />}
            to="/admin"
          />
        </div>
      ) : null}
      <div className="form-actions">
        <Button asChild>
          <Link to="/admin">
            Open administration <ArrowRight />
          </Link>
        </Button>
      </div>
    </section>
  );
}

function RecentBookings({
  bookings,
  role,
  loading = false,
  error,
  retry,
}: {
  bookings: Booking[];
  role: "customer" | "artisan";
  loading?: boolean;
  error?: unknown;
  retry?: () => void;
}) {
  return (
    <div className="dashboard-recent">
      <div className="dashboard-recent-heading">
        <h3>{role === "artisan" ? "Recent requests" : "Recent bookings"}</h3>
        <Link className="text-link" to="/bookings">
          View all <ArrowRight size={14} />
        </Link>
      </div>
      {loading ? (
        <div
          className="dashboard-recent-skeleton"
          role="status"
          aria-label="Loading recent bookings"
        >
          <span />
          <span />
          <span />
        </div>
      ) : error ? (
        <ErrorNotice error={error} retry={retry} />
      ) : bookings.length ? (
        <div className="dashboard-booking-list">
          {bookings.slice(0, 3).map((booking) => (
            <Link className="dashboard-booking" to="/bookings" key={booking.id}>
              <span>
                <strong>{booking.service_title || "Service details unavailable"}</strong>
                <span>
                  {role === "artisan"
                    ? booking.customer_name || "Customer"
                    : booking.artisan_name || "Artisan"}
                  {` · ${nairobiDate(booking.scheduled_date)}`}
                </span>
              </span>
              <span className={`status status-${booking.status}`}>{booking.status}</span>
            </Link>
          ))}
        </div>
      ) : (
        <Empty title={role === "artisan" ? "No booking requests yet" : "No bookings yet"}>
          {role === "artisan"
            ? "New customer requests will appear here."
            : "Your booking activity will appear here."}
        </Empty>
      )}
    </div>
  );
}
