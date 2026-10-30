import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  api,
  nairobiDate,
  type Booking,
  type BookingStatusAction,
  type Page,
} from "@/lib/local/api";
import { useAuth } from "@/lib/local/auth";
import { Empty, ErrorNotice, Loading, Pagination } from "./shared";
type Action = "checkout" | "review" | "dispute" | "status";
const statusActionLabels: Record<BookingStatusAction, string> = {
  accepted: "Accept",
  dispatched: "Mark dispatched",
  completed: "Mark completed",
  cancelled: "Cancel",
};
const bookingStatusLabels: Record<string, string> = {
  pending: "Pending",
  accepted: "Accepted",
  dispatched: "Dispatched",
  completed: "Completed",
  cancelled: "Cancelled",
  disputed: "Disputed",
};
export function BookingsPage() {
  const { user } = useAuth();
  const [page, setPage] = useState(1);
  const query = useQueryClient();
  const bookings = useQuery({
    queryKey: ["bookings", page],
    queryFn: ({ signal }) =>
      api<Page<Booking>>(`/bookings/history?page=${page}&limit=10`, { signal }),
    retry: false,
  });
  const [action, setAction] = useState<{
    kind: Action;
    booking: Booking;
    status?: string | undefined;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [rating, setRating] = useState(5);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!action) return;
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      const id = action.booking.id;
      if (action.kind === "checkout") {
        const result = await api<{
          MerchantRequestID: string;
          CheckoutRequestID: string;
          ResponseDescription: string;
        }>(`/operations/checkout/${id}`, {
          method: "POST",
          body: { phone_number: String(f.get("phone")).replace(/[\s-]/g, "") },
        });
        setSuccess(
          `${result.ResponseDescription} Simulated request only — no real payment has been confirmed. Request ID: ${result.CheckoutRequestID}`,
        );
      } else {
        const path =
          action.kind === "status"
            ? `/bookings/${id}/status`
            : `/operations/bookings/${id}/${action.kind}`;
        const body =
          action.kind === "status"
            ? { status: action.status }
            : action.kind === "review"
              ? { rating, comment: String(f.get("comment") || "") }
              : { reason: String(f.get("reason")) };
        const result = await api<{ message: string }>(path, {
          method: action.kind === "status" ? "PATCH" : "POST",
          body,
        });
        setSuccess(result.message || "Submitted successfully.");
        await query.invalidateQueries({ queryKey: ["bookings"] });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request unsuccessful.");
    } finally {
      setBusy(false);
    }
  }
  function open(kind: Action, booking: Booking, status?: string) {
    setError("");
    setSuccess("");
    setAction({ kind, booking, status });
  }
  const actionTitle =
    action?.kind === "checkout"
      ? "Simulated M-Pesa request"
      : action?.kind === "review"
        ? "Review your booking"
        : action?.kind === "dispute"
          ? "Raise a dispute"
          : action?.status === "cancelled"
            ? "Cancel booking"
            : `Update booking to ${bookingStatusLabels[action?.status || ""] || action?.status}`;
  const submitLabel =
    action?.kind === "checkout"
      ? "Send payment request"
      : action?.kind === "review"
        ? "Publish review"
        : action?.kind === "dispute"
          ? "Submit dispute"
          : action?.status === "cancelled"
            ? "Confirm cancellation"
            : `Confirm ${statusActionLabels[action?.status as BookingStatusAction] || "update"}`;
  return (
    <>
      <h1 className="page-title">
        {user?.role === "artisan" ? "Your booking requests" : "My bookings"}
      </h1>
      <p className="page-subtitle">
        Keep track of your work, from the first request to completion.
      </p>
      {bookings.isLoading ? (
        <Loading />
      ) : bookings.error ? (
        <ErrorNotice error={bookings.error} retry={() => bookings.refetch()} />
      ) : bookings.data?.items.length ? (
        <>
          {bookings.data.items.map((b) => (
            <article className="booking-row booking-history-row" key={b.id}>
              <div>
                <h3>
                  {b.service_title || "Service details unavailable"}{" "}
                  <span
                    className={`status status-${b.status}`}
                    aria-label={`Booking status: ${bookingStatusLabels[b.status] || b.status}`}
                  >
                    {bookingStatusLabels[b.status] || b.status}
                  </span>
                </h3>
                <p>{nairobiDate(b.scheduled_date)} · Nairobi time</p>
                <p>
                  {user?.role === "artisan" ? "Customer" : "Artisan"}:{" "}
                  {user?.role === "artisan"
                    ? b.customer_name || "Name unavailable"
                    : b.artisan_name || "Name unavailable"}
                </p>
                <p className="form-hint" title={`Full booking reference: ${b.id}`}>
                  Booking ref {b.id.slice(0, 8).toUpperCase()}
                </p>
                {b.notes && <p>{b.notes}</p>}
                <div className="row-actions">
                  {user?.role === "artisan" &&
                    (b.allowed_actions || []).map((status) => (
                      <Button
                        key={status}
                        variant="outline"
                        size="sm"
                        onClick={() => open("status", b, status)}
                      >
                        {statusActionLabels[status]}
                      </Button>
                    ))}
                  {user?.role === "customer" && (
                    <>
                      {(b.allowed_actions || []).includes("cancelled") && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => open("status", b, "cancelled")}
                        >
                          Cancel booking
                        </Button>
                      )}
                      {["accepted", "dispatched", "completed"].includes(b.status) && (
                        <Button variant="outline" size="sm" onClick={() => open("checkout", b)}>
                          Simulated M-Pesa
                        </Button>
                      )}
                      {b.status === "completed" && (
                        <Button variant="outline" size="sm" onClick={() => open("review", b)}>
                          Leave a review
                        </Button>
                      )}
                      {!["pending", "cancelled", "disputed"].includes(b.status) && (
                        <Button variant="outline" size="sm" onClick={() => open("dispute", b)}>
                          Raise a dispute
                        </Button>
                      )}
                    </>
                  )}
                </div>
              </div>
            </article>
          ))}
          <Pagination page={page} pages={bookings.data.pages} onPage={setPage} />
        </>
      ) : (
        <Empty title="No bookings yet">Your booking requests will appear here.</Empty>
      )}
      <Dialog
        open={!!action}
        onOpenChange={(open) => {
          if (!open && !busy) setAction(null);
        }}
      >
        <DialogContent className="booking-action-dialog">
          <DialogTitle className="booking-action-title">{actionTitle}</DialogTitle>
          <DialogDescription className="booking-action-description">
            Booking #{action?.booking.id}
            {action?.kind === "checkout"
              ? " · This is a simulated payment request, not a real transaction."
              : action?.kind === "dispute"
                ? " · Filing a dispute freezes escrow tracking. The service will check whether this booking is eligible."
                : action?.status === "cancelled"
                  ? " · This cannot be undone after it is submitted."
                  : " · Review the details before submitting this change."}
          </DialogDescription>
          <form className="booking-action-form form-stack" onSubmit={submit}>
            {!success && (
              <>
                {action?.kind === "checkout" && (
                  <label>
                    M-Pesa phone number
                    <input
                      name="phone"
                      type="tel"
                      required
                      pattern="\+?[0-9\s-]{10,18}"
                      defaultValue={user?.phone || ""}
                      placeholder="+254712345678"
                    />
                  </label>
                )}
                {action?.kind === "review" && (
                  <>
                    <label>
                      Rating
                      <select value={rating} onChange={(e) => setRating(Number(e.target.value))}>
                        {[5, 4, 3, 2, 1].map((v) => (
                          <option key={v} value={v}>
                            {v} {v === 1 ? "star" : "stars"}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Comment (optional)
                      <textarea name="comment" maxLength={1000} />
                    </label>
                  </>
                )}
                {action?.kind === "dispute" && (
                  <label>
                    Reason
                    <textarea name="reason" required minLength={10} maxLength={2000} />
                  </label>
                )}
                {error && (
                  <p className="inline-error" role="alert">
                    {error}
                  </p>
                )}
                <div className="booking-action-actions form-actions">
                  <Button
                    type="submit"
                    variant={action?.status === "cancelled" ? "destructive" : "default"}
                    disabled={busy}
                  >
                    {busy ? "Submitting…" : submitLabel}
                  </Button>
                  <Button
                    variant="ghost"
                    type="button"
                    disabled={busy}
                    onClick={() => setAction(null)}
                  >
                    Cancel
                  </Button>
                </div>
              </>
            )}
            {success && (
              <>
                <div className="success-notice" role="status">
                  {success}
                </div>
                <Button
                  className="booking-action-done"
                  type="button"
                  onClick={() => setAction(null)}
                >
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
