import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  api,
  nairobiDate,
  type Dispute,
  type Location,
  type Page,
  type PendingArtisan,
  type User,
  type UUID,
  queryString,
} from "@/lib/local/api";
import { MapPin, RefreshCw, UserRound } from "lucide-react";
import { Empty, ErrorNotice, Pagination } from "./shared";
interface Stats {
  total_users: number;
  total_artisans: number;
  verified_artisans: number;
  active_disputes: number;
}
type Change =
  | { kind: "verify"; id: UUID; name: string }
  | { kind: "suspend"; id: UUID; name: string; blocked: boolean }
  | { kind: "role"; id: UUID; name: string; role: User["role"] }
  | { kind: "resolve"; id: number; name: string };
type AdminTab = "artisans" | "disputes" | "users";
const ADMIN_TABS: AdminTab[] = ["artisans", "disputes", "users"];

function readableStatus(status: string) {
  return status.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function shortReference(value: string) {
  return `${value.slice(0, 8)}…`;
}

function contains(value: string | null | undefined, search: string) {
  return String(value || "")
    .toLocaleLowerCase()
    .includes(search.toLocaleLowerCase());
}

function AdminStatsSkeleton() {
  return (
    <div className="stats-grid admin-stats-skeleton" role="status" aria-label="Loading metrics">
      {Array.from({ length: 4 }, (_, index) => (
        <div className="stat" key={index}>
          <span className="admin-skeleton admin-skeleton-label" />
          <span className="admin-skeleton admin-skeleton-value" />
        </div>
      ))}
    </div>
  );
}

function AdminListSkeleton() {
  return (
    <div className="admin-list-skeleton" role="status" aria-label="Loading admin records">
      {Array.from({ length: 3 }, (_, index) => (
        <div className="booking-row" key={index}>
          <div>
            <span className="admin-skeleton admin-skeleton-heading" />
            <span className="admin-skeleton admin-skeleton-line" />
            <span className="admin-skeleton admin-skeleton-line admin-skeleton-line-short" />
          </div>
          <span className="admin-skeleton admin-skeleton-action" />
        </div>
      ))}
    </div>
  );
}

export function AdminPage() {
  const [tab, setTab] = useState<AdminTab>("artisans");
  const [page, setPage] = useState(1);
  const [change, setChange] = useState<Change | null>(null);
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [searchDraft, setSearchDraft] = useState("");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("default");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const listLimit = search || roleFilter || statusFilter || sort !== "default" ? 100 : 10;
  const tabRefs = useRef<Record<AdminTab, HTMLButtonElement | null>>({
    artisans: null,
    disputes: null,
    users: null,
  });
  const query = useQueryClient();
  const stats = useQuery({
    queryKey: ["admin-stats"],
    queryFn: () => api<Stats>("/admin/dashboard/stats"),
    retry: false,
  });
  const artisans = useQuery({
    queryKey: ["admin-artisans", page, search, sort, listLimit],
    queryFn: () =>
      api<Page<PendingArtisan>>(
        `/admin/artisans/pending?${queryString({ page, limit: listLimit, q: search || undefined, sort: sort !== "default" ? sort : undefined })}`,
      ),
    enabled: tab === "artisans",
    retry: false,
  });
  const counties = useQuery({
    queryKey: ["counties"],
    queryFn: ({ signal }) => api<Location[]>("/locations/counties", { signal }),
    enabled: tab === "artisans",
    staleTime: 300000,
    retry: false,
  });
  const disputes = useQuery({
    queryKey: ["admin-disputes", page, search, sort, listLimit],
    queryFn: () =>
      api<Page<Dispute>>(
        `/admin/disputes?${queryString({ page, limit: listLimit, q: search || undefined, sort: sort !== "default" ? sort : undefined })}`,
      ),
    enabled: tab === "disputes",
    retry: false,
  });
  const users = useQuery({
    queryKey: ["admin-users", page, search, sort, roleFilter, statusFilter, listLimit],
    queryFn: () =>
      api<Page<User>>(
        `/auth/users?${queryString({
          page,
          limit: listLimit,
          q: search || undefined,
          sort: sort !== "default" ? sort : undefined,
          role: roleFilter || undefined,
          status: statusFilter || undefined,
        })}`,
      ),
    enabled: tab === "users",
    retry: false,
  });
  const current = tab === "artisans" ? artisans : tab === "disputes" ? disputes : users;
  const lastUpdated = Math.max(stats.dataUpdatedAt, current.dataUpdatedAt);
  const activeFilters = [
    search ? `Search: ${search}` : "",
    tab === "users" && roleFilter ? `Role: ${roleFilter}` : "",
    tab === "users" && statusFilter ? `Status: ${statusFilter}` : "",
    sort !== "default" ? `Sort: ${sort.replace(/_/g, " ")}` : "",
  ].filter(Boolean);
  const visibleArtisans = (artisans.data?.items || []).filter((artisan) => {
    if (!search) return true;
    return [artisan.name, artisan.email, artisan.primary_phone, artisan.specific_address].some(
      (value) => contains(value, search),
    );
  });
  const visibleUsers = (users.data?.items || []).filter((user) => {
    const matchesSearch =
      !search || [user.name, user.email, user.phone].some((value) => contains(value, search));
    const matchesRole = !roleFilter || user.role === roleFilter;
    const matchesStatus =
      !statusFilter || (statusFilter === "suspended" ? user.is_blocked : !user.is_blocked);
    return matchesSearch && matchesRole && matchesStatus;
  });
  const visibleDisputes = (disputes.data?.items || []).filter(
    (dispute) =>
      !search ||
      [dispute.reason, dispute.booking_id, dispute.raised_by].some((value) =>
        contains(value, search),
      ),
  );
  const visibleItems =
    tab === "artisans" ? visibleArtisans : tab === "disputes" ? visibleDisputes : visibleUsers;
  useEffect(() => {
    const pages = current.data?.pages ?? 0;
    if (pages > 0 && page > pages) setPage(pages);
    if (pages === 0 && page !== 1) setPage(1);
  }, [current.data, page]);
  function changeTab(nextTab: AdminTab) {
    setTab(nextTab);
    setPage(1);
    setSearchDraft("");
    setSearch("");
    setSort("default");
    setRoleFilter("");
    setStatusFilter("");
  }
  function submitFilters(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSearch(searchDraft.trim());
    setPage(1);
  }
  async function refreshAdminData() {
    if (refreshing) return;
    setRefreshing(true);
    setRefreshError("");
    try {
      await Promise.all([
        query.refetchQueries({ queryKey: ["admin-stats"], type: "active", throwOnError: true }),
        query.refetchQueries({
          queryKey:
            tab === "artisans"
              ? ["admin-artisans", page, search, sort, listLimit]
              : tab === "disputes"
                ? ["admin-disputes", page, search, sort, listLimit]
                : ["admin-users", page, search, sort, roleFilter, statusFilter, listLimit],
          exact: true,
          type: "active",
          throwOnError: true,
        }),
        ...(tab === "artisans"
          ? [query.refetchQueries({ queryKey: ["counties"], type: "active", throwOnError: true })]
          : []),
      ]);
    } catch (error) {
      setRefreshError(error instanceof Error ? error.message : "Refresh unsuccessful.");
    } finally {
      setRefreshing(false);
    }
  }
  function handleTabKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let nextIndex: number | null = null;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") nextIndex = (index + 1) % 3;
    if (event.key === "ArrowLeft" || event.key === "ArrowUp") nextIndex = (index + 2) % 3;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = 2;
    if (nextIndex === null) return;
    event.preventDefault();
    const nextTab = ADMIN_TABS[nextIndex];
    changeTab(nextTab);
    requestAnimationFrame(() => tabRefs.current[nextTab]?.focus());
  }
  function select(value: Change) {
    setChange(value);
    setError("");
    setSuccess("");
  }
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!change) return;
    setBusy(true);
    setError("");
    const f = new FormData(e.currentTarget);
    try {
      const path =
        change.kind === "verify"
          ? `/admin/artisans/${change.id}/verify`
          : change.kind === "suspend"
            ? `/admin/users/${change.id}/suspend`
            : change.kind === "role"
              ? `/auth/users/${change.id}/role`
              : `/admin/disputes/${encodeURIComponent(change.id)}/resolve`;
      const body =
        change.kind === "verify"
          ? { is_verified: true }
          : change.kind === "suspend"
            ? { is_blocked: !change.blocked }
            : change.kind === "role"
              ? { role: String(f.get("role")) }
              : {
                  resolution_status: String(f.get("resolution_status")),
                  resolution_details: String(f.get("resolution_details")),
                };
      const result = await api<{ message?: string }>(path, {
        method: change.kind === "resolve" ? "POST" : "PATCH",
        body,
      });
      setSuccess(result.message || "The action has been saved.");
      await Promise.all([
        query.invalidateQueries({ queryKey: ["admin-stats"] }),
        query.invalidateQueries({ queryKey: ["admin-artisans"] }),
        query.invalidateQueries({ queryKey: ["admin-disputes"] }),
        query.invalidateQueries({ queryKey: ["admin-users"] }),
      ]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action unsuccessful.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <h1 className="page-title">Community administration</h1>
      <p className="page-subtitle">Support artisans, manage accounts, and resolve open issues.</p>
      {stats.isLoading ? (
        <AdminStatsSkeleton />
      ) : stats.error ? (
        <ErrorNotice error={stats.error} retry={() => stats.refetch()} />
      ) : (
        stats.data && (
          <div className="stats-grid">
            {[
              { label: "Total users", value: stats.data.total_users },
              { label: "Artisans", value: stats.data.total_artisans },
              { label: "Verified artisans", value: stats.data.verified_artisans },
              { label: "Active disputes", value: stats.data.active_disputes },
            ].map((s) => (
              <div key={s.label} className="stat">
                <p>{s.label}</p>
                <strong>{s.value}</strong>
              </div>
            ))}
          </div>
        )
      )}
      <div className="segmented admin-tabs" role="tablist" aria-label="Administration sections">
        {ADMIN_TABS.map((t, index) => (
          <Button
            key={t}
            variant="ghost"
            className={t === tab ? "selected" : ""}
            role="tab"
            id={`admin-tab-${t}`}
            aria-controls={`admin-panel-${t}`}
            aria-selected={t === tab}
            tabIndex={t === tab ? 0 : -1}
            ref={(element) => {
              tabRefs.current[t] = element;
            }}
            onClick={() => changeTab(t)}
            onKeyDown={(event) => handleTabKeyDown(event, index)}
          >
            {t === "artisans" ? "Pending artisans" : t === "disputes" ? "Open disputes" : "Users"}
          </Button>
        ))}
      </div>
      <form className="admin-toolbar" onSubmit={submitFilters}>
        <label>
          Search
          <input
            value={searchDraft}
            onChange={(event) => setSearchDraft(event.target.value)}
            placeholder={tab === "disputes" ? "Search dispute reasons…" : "Name, email, or phone…"}
          />
        </label>
        <label>
          Sort by
          <select
            value={sort}
            onChange={(event) => {
              setSort(event.target.value);
              setPage(1);
            }}
          >
            <option value="default">Default</option>
            {tab === "artisans" && <option value="experience_desc">Most experience</option>}
            {tab === "users" && <option value="name_asc">Name A–Z</option>}
            {tab === "disputes" && <option value="created_desc">Newest first</option>}
            {tab === "disputes" && <option value="created_asc">Oldest first</option>}
          </select>
        </label>
        {tab === "users" && (
          <>
            <label>
              Role
              <select
                value={roleFilter}
                onChange={(event) => {
                  setRoleFilter(event.target.value);
                  setPage(1);
                }}
              >
                <option value="">All roles</option>
                <option value="customer">Customer</option>
                <option value="artisan">Artisan</option>
                <option value="admin">Administrator</option>
              </select>
            </label>
            <label>
              Status
              <select
                value={statusFilter}
                onChange={(event) => {
                  setStatusFilter(event.target.value);
                  setPage(1);
                }}
              >
                <option value="">All statuses</option>
                <option value="active">Active</option>
                <option value="suspended">Suspended</option>
              </select>
            </label>
          </>
        )}
        <Button type="submit">Apply filters</Button>
        <Button
          type="button"
          variant="outline"
          disabled={refreshing || stats.isFetching || current.isFetching}
          onClick={refreshAdminData}
          aria-label="Refresh admin data"
        >
          <RefreshCw /> {stats.isFetching || current.isFetching ? "Refreshing…" : "Refresh"}
        </Button>
        <span className="admin-last-updated" aria-live="polite">
          {lastUpdated
            ? `${current.isFetching ? "Refreshing" : "Updated"} ${nairobiDate(new Date(lastUpdated).toISOString())}`
            : "Not updated yet"}
        </span>
      </form>
      {refreshError && (
        <p className="inline-error admin-refresh-error" role="alert">
          {refreshError}
        </p>
      )}
      {activeFilters.length > 0 && (
        <p className="admin-filter-status" role="status">
          Showing results for {activeFilters.join(" · ")}.
        </p>
      )}
      <section
        id={`admin-panel-${tab}`}
        className="admin-tabpanel"
        role="tabpanel"
        aria-labelledby={`admin-tab-${tab}`}
        tabIndex={0}
      >
        {current.isLoading ? (
          <AdminListSkeleton />
        ) : current.error ? (
          <div className="admin-panel-state">
            <p className="admin-state-label">This section could not be loaded.</p>
            <ErrorNotice error={current.error} retry={() => current.refetch()} />
          </div>
        ) : !visibleItems.length ? (
          <Empty
            title={
              activeFilters.length > 0
                ? "No records match these filters"
                : tab === "artisans"
                  ? "No pending artisans"
                  : tab === "disputes"
                    ? "No open disputes"
                    : "No users found"
            }
          >
            {activeFilters.length > 0
              ? "Try adjusting the search or filter criteria."
              : tab === "artisans"
                ? "Verified artisans will move out of this queue."
                : tab === "disputes"
                  ? "New customer or artisan disputes will appear here."
                  : "Registered accounts will appear here once they are available."}
          </Empty>
        ) : (
          <>
            {tab === "artisans" && (
              <>
                {counties.error && (
                  <ErrorNotice error={counties.error} retry={() => counties.refetch()} />
                )}
                <div className="admin-table-wrap">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th scope="col">Artisan</th>
                        <th scope="col">Experience</th>
                        <th scope="col">Location</th>
                        <th scope="col">Bio</th>
                        <th scope="col">
                          <span className="sr-only">Actions</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleArtisans.map((a) => {
                        const county = counties.data?.find((item) => item.id === a.county_id);
                        const subCounty = county?.sub_counties?.find(
                          (item) => item.id === a.sub_county_id,
                        );
                        const location =
                          county && subCounty
                            ? `${county.name} · ${subCounty.name}`
                            : counties.isLoading
                              ? "Loading location names…"
                              : "Location unavailable";
                        return (
                          <tr key={a.id}>
                            <td>
                              <div className="admin-record-identity">
                                {a.profile_image_url ? (
                                  <img
                                    className="admin-record-avatar"
                                    src={a.profile_image_url}
                                    alt=""
                                  />
                                ) : (
                                  <span
                                    className="admin-record-avatar admin-record-placeholder"
                                    aria-hidden="true"
                                  >
                                    <UserRound size={20} />
                                  </span>
                                )}
                                <div>
                                  <strong>{a.name}</strong>
                                  <span>{a.email}</span>
                                  <span>{a.primary_phone}</span>
                                </div>
                              </div>
                            </td>
                            <td>{a.experience_years} years</td>
                            <td>
                              <span className="admin-artisan-location">
                                <MapPin size={14} /> {location}
                              </span>
                              <span>{a.specific_address}</span>
                            </td>
                            <td className="admin-table-description">
                              {a.bio || "No bio provided"}
                            </td>
                            <td>
                              <Button
                                onClick={() => select({ kind: "verify", id: a.id, name: a.name })}
                              >
                                Verify artisan
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
            {tab === "users" && (
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th scope="col">User</th>
                      <th scope="col">Role</th>
                      <th scope="col">Status</th>
                      <th scope="col">Joined</th>
                      <th scope="col">
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleUsers.map((u) => (
                      <tr key={u.id}>
                        <td>
                          <strong>{u.name}</strong>
                          <span>{u.email}</span>
                          <span>{u.phone || "No phone provided"}</span>
                        </td>
                        <td>
                          <span className="status admin-role-badge">{u.role}</span>
                        </td>
                        <td>
                          <span
                            className={`status ${u.is_blocked ? "status-disputed" : "status-accepted"}`}
                          >
                            {u.is_blocked ? "Suspended" : "Active"}
                          </span>
                        </td>
                        <td>{nairobiDate(u.created_at)}</td>
                        <td>
                          <div className="admin-table-actions">
                            <Button
                              variant="outline"
                              onClick={() =>
                                select({ kind: "role", id: u.id, name: u.name, role: u.role })
                              }
                            >
                              Change role
                            </Button>
                            {u.role !== "admin" && (
                              <Button
                                variant={u.is_blocked ? "outline" : "destructive"}
                                onClick={() =>
                                  select({
                                    kind: "suspend",
                                    id: u.id,
                                    name: u.name,
                                    blocked: u.is_blocked,
                                  })
                                }
                              >
                                {u.is_blocked ? "Restore access" : "Suspend"}
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {tab === "disputes" && (
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th scope="col">Reference</th>
                      <th scope="col">Reason</th>
                      <th scope="col">Booking / account</th>
                      <th scope="col">Filed</th>
                      <th scope="col">Status</th>
                      <th scope="col">
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleDisputes.map((d) => (
                      <tr key={d.id}>
                        <td>
                          <code>#{d.id}</code>
                        </td>
                        <td className="admin-table-description">
                          <strong>{d.reason}</strong>
                          {d.resolution_details && <span>{d.resolution_details}</span>}
                        </td>
                        <td>
                          <span title={d.booking_id}>
                            <code>Booking {shortReference(d.booking_id)}</code>
                          </span>
                          <span title={d.raised_by}>
                            <code>Account {shortReference(d.raised_by)}</code>
                          </span>
                        </td>
                        <td>
                          <time dateTime={d.created_at}>{nairobiDate(d.created_at)}</time>
                        </td>
                        <td>
                          <span className="status">{readableStatus(d.status)}</span>
                        </td>
                        <td>
                          <Button
                            onClick={() =>
                              select({ kind: "resolve", id: d.id, name: `Dispute #${d.id}` })
                            }
                          >
                            Resolve dispute
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <Pagination page={page} pages={current.data?.pages || 0} onPage={setPage} />
          </>
        )}
      </section>
      <Dialog
        open={!!change}
        onOpenChange={(open) => {
          if (!open && !busy) setChange(null);
        }}
      >
        <DialogContent className="admin-action-dialog">
          <DialogTitle className="admin-action-title">
            {change?.kind === "verify"
              ? "Verify artisan"
              : change?.kind === "suspend"
                ? change.blocked
                  ? "Restore account access"
                  : "Suspend account"
                : change?.kind === "role"
                  ? "Change account role"
                  : "Resolve dispute"}
          </DialogTitle>
          <DialogDescription className="admin-action-description">
            {change?.kind === "verify"
              ? `You are about to verify ${change.name}. This makes the artisan eligible to appear as verified in the marketplace.`
              : change?.kind === "suspend"
                ? change.blocked
                  ? `You are about to restore access for ${change.name}.`
                  : `You are about to suspend ${change.name}. They will not be able to use their account until access is restored.`
                : change?.kind === "role"
                  ? `Choose the new account role for ${change.name}. Role changes take effect immediately.`
                  : change?.kind === "resolve"
                    ? `Choose how to resolve ${change.name}. This action closes the dispute and cannot be undone from this screen.`
                    : ""}
          </DialogDescription>
          <form className="admin-action-form form-stack" onSubmit={submit}>
            {!success && (
              <>
                {change?.kind === "role" && (
                  <label>
                    Role
                    <select name="role" defaultValue={change.role}>
                      <option value="customer">Customer</option>
                      <option value="artisan">Artisan</option>
                      <option value="admin">Administrator</option>
                    </select>
                  </label>
                )}
                {change?.kind === "resolve" && (
                  <>
                    <label>
                      Resolution
                      <select name="resolution_status">
                        <option value="released_to_fundi">Release to artisan</option>
                        <option value="refunded">Refund</option>
                      </select>
                    </label>
                    <label>
                      Resolution details
                      <textarea
                        name="resolution_details"
                        required
                        minLength={10}
                        maxLength={2000}
                      />
                    </label>
                  </>
                )}
                {error && (
                  <p className="inline-error" role="alert">
                    {error}
                  </p>
                )}
                <div className="admin-action-actions form-actions">
                  <Button
                    variant={
                      change?.kind === "suspend" && !change.blocked ? "destructive" : "default"
                    }
                    disabled={busy}
                    type="submit"
                  >
                    {busy ? "Saving…" : "Confirm change"}
                  </Button>
                  <Button
                    variant="ghost"
                    type="button"
                    disabled={busy}
                    onClick={() => setChange(null)}
                  >
                    Cancel
                  </Button>
                </div>
              </>
            )}
            {success && (
              <>
                <p className="success-notice" role="status">
                  {success}
                </p>
                <Button className="admin-action-done" type="button" onClick={() => setChange(null)}>
                  Done
                </Button>
              </>
            )}
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
