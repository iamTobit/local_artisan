import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  ArrowLeft,
  RefreshCw,
  AlertCircle,
  Hammer,
  Wrench,
  Zap,
  Paintbrush,
  Scissors,
  Sprout,
  Home,
  Menu,
  X,
  MapPin,
  LogOut,
  Sun,
  Moon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { api, type Category, type Location } from "@/lib/local/api";
import { useAuth } from "@/lib/local/auth";
export function Brand() {
  return (
    <Link to="/" className="brand" aria-label="Local Artisan home">
      <span className="brand-mark">
        <Hammer size={21} />
      </span>
      <span>
        local<span className="brand-second">artisan</span>
        <span className="brand-dot">.</span>
      </span>
    </Link>
  );
}
export function Header() {
  const [open, setOpen] = useState(false);
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const headerRef = useRef<HTMLElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const { user, logout } = useAuth();

  useEffect(() => {
    try {
      const saved = localStorage.getItem("local_artisan_theme") as "dark" | "light" | null;
      const initial = saved === "light" ? "light" : "dark";
      setTheme(initial);
      document.documentElement.classList.toggle("dark", initial === "dark");
      document.documentElement.classList.toggle("light", initial === "light");
    } catch {
      // ignore storage errors
    }
  }, []);

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.classList.toggle("dark", next === "dark");
    document.documentElement.classList.toggle("light", next === "light");
    try {
      localStorage.setItem("local_artisan_theme", next);
    } catch {
      // ignore storage errors
    }
  }

  useEffect(() => {
    if (!open) return;

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        menuButtonRef.current?.focus();
      }
    }

    function closeOnOutsidePointer(event: PointerEvent) {
      if (event.target instanceof Node && !headerRef.current?.contains(event.target)) {
        setOpen(false);
      }
    }

    document.addEventListener("keydown", closeOnEscape);
    document.addEventListener("pointerdown", closeOnOutsidePointer);
    return () => {
      document.removeEventListener("keydown", closeOnEscape);
      document.removeEventListener("pointerdown", closeOnOutsidePointer);
    };
  }, [open]);

  return (
    <header ref={headerRef} className="site-header">
      <div className="container header-inner">
        <Brand />
        <nav
          id="main-navigation"
          className={open ? "main-nav nav-open" : "main-nav"}
          aria-label="Main navigation"
        >
          <Link to="/" activeProps={{ className: "nav-active" }} onClick={() => setOpen(false)}>
            Home
          </Link>
          <Link
            to="/browse"
            activeProps={{ className: "nav-active" }}
            onClick={() => setOpen(false)}
          >
            Find a service
          </Link>
          <Link
            to="/about"
            activeProps={{ className: "nav-active" }}
            onClick={() => setOpen(false)}
          >
            About us
          </Link>
          <div className="mobile-nav-auth">
            {user ? (
              <>
                <Link
                  to="/workspace"
                  activeProps={{ className: "nav-active" }}
                  onClick={() => setOpen(false)}
                >
                  My account
                </Link>
                <button
                  type="button"
                  className="mobile-nav-logout"
                  onClick={() => {
                    setOpen(false);
                    logout();
                  }}
                >
                  <LogOut size={16} /> Sign out
                </button>
              </>
            ) : (
              <>
                <Link
                  to="/auth"
                  search={{ mode: "login" }}
                  activeProps={{ className: "nav-active" }}
                  onClick={() => setOpen(false)}
                >
                  Log in
                </Link>
                <Link
                  to="/auth"
                  search={{ mode: "register", role: "artisan" }}
                  activeProps={{ className: "nav-active" }}
                  onClick={() => setOpen(false)}
                >
                  Join as an artisan
                </Link>
              </>
            )}
          </div>
        </nav>
        <div className="header-actions">
          {user ? (
            <>
              <Button variant="ghost" asChild>
                <Link to="/workspace">My account</Link>
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Sign out"
                title="Sign out"
                onClick={logout}
              >
                <LogOut />
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" asChild className="sign-in-link">
                <Link to="/auth" search={{ mode: "login" }}>
                  Log in
                </Link>
              </Button>
              <Button asChild>
                <Link to="/auth" search={{ mode: "register", role: "artisan" }}>
                  Join as an artisan <ArrowRight />
                </Link>
              </Button>
            </>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="theme-toggle"
            aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            title={theme === "dark" ? "Switch to light tech mode" : "Switch to dark tech mode"}
            onClick={toggleTheme}
          >
            {theme === "dark" ? <Sun /> : <Moon />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="menu-toggle"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            aria-controls="main-navigation"
            ref={menuButtonRef}
            onClick={() => setOpen(!open)}
          >
            {open ? <X /> : <Menu />}
          </Button>
        </div>
      </div>
    </header>
  );
}
export function Footer() {
  return (
    <footer className="site-footer">
      <div className="container footer-main">
        <div>
          <Brand />
          <p>
            Local skills. Real connections.
            <br />A little closer to home.
          </p>
          <span className="kenya-tag">
            <MapPin size={14} /> Made for Kenya
          </span>
        </div>
        <div>
          <h3>Discover</h3>
          <Link to="/browse">Find a service</Link>
          <Link to="/about">Our story</Link>
        </div>
        <div>
          <h3>For artisans</h3>
          <Link to="/auth" search={{ mode: "register", role: "artisan" }}>
            Join the community
          </Link>
          <Link to="/workspace">Manage your services</Link>
        </div>
        <div>
          <h3>Your account</h3>
          <Link to="/auth">Log in</Link>
          <Link to="/bookings">My bookings</Link>
        </div>
      </div>
      <div className="container footer-bottom">
        <span>© {new Date().getFullYear()} Local Artisan. All rights reserved.</span>
        <span>Connecting communities, one craft at a time.</span>
      </div>
    </footer>
  );
}
const iconMap = {
  hammer: Hammer,
  wrench: Wrench,
  zap: Zap,
  paintbrush: Paintbrush,
  scissors: Scissors,
  sprout: Sprout,
  home: Home,
  plumbing: Wrench,
  electrical: Zap,
  carpentry: Hammer,
  painting: Paintbrush,
};
export function CategoryIcon({ name, size = 24 }: { name?: string | undefined; size?: number }) {
  const key = (name || "").toLowerCase().replace(/[-_ ]/g, "");
  const Icon = iconMap[key as keyof typeof iconMap] || Wrench;
  return <Icon size={size} />;
}
export function ErrorNotice({ error, retry }: { error: unknown; retry?: () => void }) {
  return (
    <div className="error-notice" role="alert">
      <AlertCircle size={20} />
      <div>
        <strong>We couldn’t load this right now</strong>
        <p>{error instanceof Error ? error.message : "Please try again shortly."}</p>
      </div>
      {retry && (
        <Button
          variant="ghost"
          size="icon"
          onClick={retry}
          aria-label="Try again"
          title="Try again"
        >
          <RefreshCw />
        </Button>
      )}
    </div>
  );
}
export function Empty({
  title,
  children,
  icon: Icon = Wrench,
}: {
  title: string;
  children?: ReactNode;
  icon?: React.ComponentType<{ size?: number; className?: string }>;
}) {
  return (
    <div className="empty-state">
      <Icon size={30} />
      <h3>{title}</h3>
      {children && <p>{children}</p>}
    </div>
  );
}
export function Loading() {
  return (
    <div className="loading-state" role="status">
      <span className="loading-dot" /> Loading…
    </div>
  );
}
export function Pagination({
  page,
  pages,
  onPage,
}: {
  page: number;
  pages: number;
  onPage: (value: number) => void;
}) {
  if (pages <= 1) return null;
  return (
    <div className="pagination">
      <Button variant="outline" disabled={page <= 1} onClick={() => onPage(page - 1)}>
        <ArrowLeft /> Previous
      </Button>
      <span>
        Page {page} of {pages}
      </span>
      <Button variant="outline" disabled={page >= pages} onClick={() => onPage(page + 1)}>
        Next <ArrowRight />
      </Button>
    </div>
  );
}
export function useCategories() {
  return useQuery({
    queryKey: ["categories"],
    queryFn: ({ signal }) => api<Category[]>("/marketplace/categories", { signal }),
    retry: false,
    staleTime: 300000,
  });
}
export function LocationFields({
  county,
  subcounty,
  onCounty,
  onSubcounty,
  required = false,
}: {
  county: string;
  subcounty: string;
  onCounty: (v: string) => void;
  onSubcounty: (v: string) => void;
  required?: boolean;
}) {
  const counties = useQuery({
    queryKey: ["counties"],
    queryFn: ({ signal }) => api<Location[]>("/locations/counties", { signal }),
    retry: false,
  });
  const selectedCounty = counties.data?.find((item) => String(item.id) === county);
  const nestedSubcounties = selectedCounty?.sub_counties || [];
  const subs = useQuery({
    queryKey: ["subcounties", county],
    queryFn: ({ signal }) =>
      api<Location[]>(`/locations/counties/${county}/subcounties`, { signal }),
    enabled: !!county && nestedSubcounties.length === 0,
    retry: false,
  });
  const subcountyOptions = nestedSubcounties.length ? nestedSubcounties : subs.data || [];
  return (
    <>
      <label>
        County
        <select value={county} required={required} onChange={(e) => onCounty(e.target.value)}>
          <option value="">{counties.isLoading ? "Loading counties…" : "All counties"}</option>
          {counties.data?.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Subcounty
        <select
          value={subcounty}
          required={required}
          disabled={!county}
          onChange={(e) => onSubcounty(e.target.value)}
        >
          <option value="">
            {subs.isLoading && county && nestedSubcounties.length === 0
              ? "Loading subcounties…"
              : "All subcounties"}
          </option>
          {subcountyOptions.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name}
            </option>
          ))}
        </select>
      </label>
      {counties.error && <ErrorNotice error={counties.error} retry={() => counties.refetch()} />}
      {subs.error && <ErrorNotice error={subs.error} retry={() => subs.refetch()} />}
    </>
  );
}
