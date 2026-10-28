import * as React from "react";
import { useStyletron } from "baseui";
import { Button, KIND, SIZE } from "baseui/button";
import { X } from "lucide-react";
import { useConfig } from "./config";
import { useDay } from "./day";
import { buildSales, STATE_TEXT } from "./sale";
import { useHistoryLayer } from "./anchors";
import { useQueue, confirmPrintAttempt, type PrintJob } from "./print-queue";
import { WorkflowDialog } from "./workflow-dialog";
import {
  openCapturedPrintCopy,
  retrySourcePrint,
  type PrintFeedback,
  PRINT_FEEDBACK_EVENT,
} from "./browser-print";

const ACTIVITY_EVENT = "rocoto:print-activity";
export type OutputActivityFocus = "status" | "activity";
export const openPrintActivity = (
  saleId?: string,
  focus: OutputActivityFocus = "activity",
): void => {
  window.dispatchEvent(
    new CustomEvent(ACTIVITY_EVENT, { detail: { saleId, focus } }),
  );
};

function when(value?: string): string {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
}

type ActivityEvent = {
  id: string;
  at: string;
  sortAt: number;
  title: string;
  detail: string;
  job?: PrintJob;
};

/* Source history sometimes has only a local clock time, while browser print attempts have an ISO
   timestamp. Keep the original string for the person and sort by an actual instant whenever one
   exists; a clock-only history item never pretends to be more precise than it is. */
function activityTime(value: string, day?: string): number {
  const parsed = Date.parse(value);
  if (!Number.isNaN(parsed)) return parsed;
  /* The document owns an ISO delivery day. A source fold that only stores 08:15 therefore still
     has an exact instant for this delivery, rather than sorting underneath all ISO print attempts. */
  const dated = day && /^\d{1,2}:\d{2}$/.test(value)
    ? Date.parse(`${day}T${value.length === 4 ? `0${value}` : value}:00`)
    : Number.NaN;
  return !Number.isNaN(dated) ? dated : Number.NEGATIVE_INFINITY;
}

/** One shared activity and feedback surface for every print entry point. */
export function PrintActivityHost() {
  const [css, theme] = useStyletron();
  const { config, derived } = useConfig();
  const day = useDay(derived.cast.sector);
  const jobs = useQueue(derived.cast.sector);
  const [feedback, setFeedback] = React.useState<PrintFeedback | null>(null);
  const [open, setOpen] = React.useState(false);
  const [exportVisible, setExportVisible] = React.useState(false);
  const [saleId, setSaleId] = React.useState<string | undefined>();
  const [focus, setFocus] = React.useState<OutputActivityFocus>("activity");
  const [error, setError] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  React.useEffect(() => {
    const activity = (event: Event) => {
      const detail = (
        event as CustomEvent<{ saleId?: string; focus?: OutputActivityFocus }>
      ).detail;
      setSaleId(detail?.saleId);
      setFocus(detail?.focus === "status" ? "status" : "activity");
      setError("");
      setOpen(true);
    };
    const result = (event: Event) => {
      const next = (event as CustomEvent<PrintFeedback>).detail;
      if (next.sector === derived.cast.sector) setFeedback(next);
    };
    const exportChanged = (event: Event) =>
      setExportVisible(
        Boolean((event as CustomEvent<{ open: boolean }>).detail?.open),
      );
    window.addEventListener("rocoto:export-visibility", exportChanged);
    window.addEventListener(ACTIVITY_EVENT, activity);
    window.addEventListener(PRINT_FEEDBACK_EVENT, result);
    return () => {
      window.removeEventListener("rocoto:export-visibility", exportChanged);
      window.removeEventListener(ACTIVITY_EVENT, activity);
      window.removeEventListener(PRINT_FEEDBACK_EVENT, result);
    };
  }, [derived.cast.sector]);
  React.useEffect(() => {
    setFeedback(null);
    setOpen(false);
    setError("");
  }, [derived.cast.sector]);
  useHistoryLayer({
    id: "print:activity",
    active: open,
    snapshot: { saleId: saleId ?? null, focus },
    onRestore: (saved) => {
      setOpen(Boolean(saved));
      setSaleId(typeof saved?.saleId === "string" ? saved.saleId : undefined);
      setFocus(saved?.focus === "status" ? "status" : "activity");
    },
  });
  const historicSource = React.useMemo(
    () =>
      open && saleId
        ? buildSales(derived.cast, day, {
            includeArchived: true,
          }).find((sale) => sale.id === saleId)
        : undefined,
    [open, saleId, derived.cast, day],
  );
  const shown = React.useMemo(
    () =>
      jobs.filter(
        (job) =>
          !saleId ||
          (job.subject.kind === "albaran" && job.subject.sale === saleId),
      ),
    [jobs, saleId],
  );
  /* One time-ordered feed. Source folds are intentionally described as history or plans, never as
     receipts: neither an email's provider delivery nor an ERP acknowledgement exists in this model. */
  const events = React.useMemo<ActivityEvent[]>(() => {
    const next: ActivityEvent[] = [];
    if (historicSource?.printed) {
      const printed = historicSource.printed;
      next.push({
        id: "source-print",
        at: printed.at,
        sortAt: activityTime(printed.at, historicSource.day),
        title: printed.stale
          ? "Document changed after a recorded print"
          : "Recorded print in delivery history",
        detail: `${printed.count} ${printed.count === 1 ? "copy" : "copies"} · person and browser result unavailable`,
      });
    }
    if (historicSource?.sentToErp) {
      const system = historicSource.sentToErp;
      next.push({
        id: "system",
        at: system.at,
        sortAt: activityTime(system.at, historicSource.day),
        title: system.stale
          ? "Document changed after a planned system transfer"
          : "System transfer marked in delivery history",
        detail: "Provider acknowledgement is unavailable",
      });
    }
    if (historicSource?.emailScheduled) {
      const email = historicSource.emailScheduled;
      const at = email.sent ?? email.at;
      next.push({
        id: "email",
        at,
        sortAt: activityTime(at, historicSource.day),
        title: email.sent
          ? "Prepared email time reached"
          : "Email plan prepared",
        detail: email.sent
          ? "Provider delivery and customer receipt are still to arrive"
          : `Planned for ${email.sendAt} · the send request is still to make`,
      });
    }
    if (historicSource?.archived) {
      const archived = historicSource.archived;
      next.push({
        id: "archive",
        at: archived.at,
        sortAt: activityTime(archived.at, historicSource.day),
        title: "Archived",
        detail: archived.by
          ? `Archived by ${archived.by}`
          : "Archive actor unavailable",
      });
    }
    if (historicSource?.read) {
      const read = historicSource.read;
      next.push({
        id: "viewed",
        at: read.at,
        sortAt: activityTime(read.at, historicSource.day),
        title: "Viewed",
        detail: read.by ? `Viewed by ${read.by}` : "Viewer unavailable",
      });
    }
    day.events.forEach((event, index) => {
      if (event.sale !== saleId || (event.kind !== "flag" && event.kind !== "unflag")) return;
      next.push({
        id: `${event.kind}-${index}`,
        at: event.at,
        sortAt: activityTime(event.at, historicSource?.day),
        title: event.kind === "flag" ? "Flagged" : "Flag removed",
        detail: `${event.kind === "flag" ? "Flagged" : "Removed"} by ${event.by}`,
      });
    });
    shown.forEach((job) => {
      const at = job.done ?? job.requestedAt;
      const state =
        job.state === "printed"
          ? "Print confirmed"
          : job.state === "printing"
            ? "Browser print dialog opened"
            : "Print request prepared";
      const confirmation =
        job.state === "printed"
          ? ` · confirmed by ${job.confirmedBy ?? "operator"}`
          : job.state === "printing"
            ? " · browser completion is unknown"
            : " · browser dialog still to open";
      next.push({
        id: `print-${job.id}`,
        at,
        sortAt: activityTime(at, historicSource?.day),
        title: state,
        detail: `${job.requestedBy} · ${job.paper} · ${job.copies} ${job.copies === 1 ? "copy" : "copies"}${confirmation}`,
        job,
      });
    });
    return next.sort(
      (a, b) =>
        b.sortAt - a.sortAt ||
        b.at.localeCompare(a.at) ||
        b.id.localeCompare(a.id),
    );
  }, [historicSource, shown, day.events, saleId]);
  const statusFocusRef = React.useRef<HTMLElement | null>(null);
  React.useEffect(() => {
    if (!open || focus !== "status") return;
    const frame = window.requestAnimationFrame(() => {
      statusFocusRef.current?.scrollIntoView({ block: "nearest" });
      statusFocusRef.current?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [open, focus, saleId]);
  const current = jobs.filter((job) => feedback?.jobIds.includes(job.id));
  const unconfirmed = current.filter((job) => job.state === "printing");
  const confirm = (selected: PrintJob[]) => {
    setError("");
    const sources = buildSales(
      derived.cast,
      day,
      { includeArchived: true },
    );
    const activeSources = new Set(
      sources.filter((sale) => !sale.archived).map((sale) => sale.id),
    );
    const unavailable = selected.some((job) => {
      if (job.subject.kind === "albaran")
        return !activeSources.has(job.subject.sale);
      const ids = job.subject.salesIds ?? [];
      return ids.length === 0 || ids.some((id) => !activeSources.has(id));
    });
    if (unavailable) {
      setError(
        "Some orders are archived or unavailable. This print remains unconfirmed.",
      );
      return;
    }
    const at = new Date().toISOString();
    const accepted = selected.filter((job) =>
      confirmPrintAttempt(job.id, at, config.owner.name || "You"),
    ).length;
    if (accepted !== selected.length)
      setError(
        `${accepted} of ${selected.length} confirmed. Saving the rest stalled.`,
      );
  };
  const openCopy = async (job: PrintJob) => {
    setBusy(true);
    setError("");
    const result = await openCapturedPrintCopy(job.id, derived.cast.sector);
    if (!result.ok) setError(result.message);
    setBusy(false);
  };
  const small = {
    ...theme.typography.ParagraphXSmall,
    color: theme.colors.contentSecondary,
  };
  const confirmed =
    current.length > 0 && current.every((job) => job.state === "printed");
  return (
    <>
      {feedback && !open && !exportVisible && (
        <aside
          data-testid="print-feedback"
          role="status"
          className={css({
            position: "fixed",
            right: "92px",
            bottom: "24px",
            zIndex: 11,
            width: "min(390px, calc(100vw - 120px))",
            backgroundColor: theme.colors.backgroundPrimary,
            border: `1px solid ${theme.colors.borderOpaque}`,
            borderRadius: theme.borders.radius400,
            boxShadow: theme.lighting.shadow600,
            padding: theme.sizing.scale500,
            "@media (max-width: 600px)": {
              left: "16px",
              right: "16px",
              bottom: "144px",
              width: "auto",
            },
          })}
        >
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: theme.sizing.scale200,
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <strong style={{ ...theme.typography.LabelSmall }}>
                {confirmed
                  ? "Printed"
                  : feedback.status === "preparing"
                    ? "Preparing print…"
                    : feedback.status === "dialog-requested"
                      ? "Dialog opened · print unknown"
                      : "Print needs attention"}
              </strong>
              <p
                style={{
                  ...small,
                  margin: `${theme.sizing.scale200} 0 0`,
                  overflowWrap: "anywhere",
                }}
              >
                {feedback.status === "blocked" ||
                feedback.status === "host-unavailable"
                  ? feedback.message
                  : feedback.title}
              </p>
            </div>
            <Button
              kind={KIND.tertiary}
              size={SIZE.mini}
              aria-label="Dismiss print status"
              onClick={() => setFeedback(null)}
            >
              <X size={16} aria-hidden />
            </Button>
          </div>
          {error && (
            <p role="alert" style={{ ...small, color: theme.colors.negative }}>
              {error}
            </p>
          )}
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: theme.sizing.scale200,
              marginTop: theme.sizing.scale300,
            }}
          >
            {unconfirmed.length > 0 && (
              <Button
                size={SIZE.compact}
                data-testid="print-feedback-confirm"
                onClick={() => confirm(unconfirmed)}
              >
                Confirm printed
              </Button>
            )}
            {(feedback.status === "blocked" ||
              feedback.status === "host-unavailable") &&
              feedback.jobIds.length > 0 && (
                <Button
                  size={SIZE.compact}
                  data-testid="print-feedback-retry"
                  onClick={() =>
                    void retrySourcePrint(feedback.key, feedback.sector)
                  }
                >
                  Try again
                </Button>
              )}
            <Button
              kind={KIND.tertiary}
              size={SIZE.compact}
              onClick={() => openPrintActivity()}
              data-testid="print-feedback-activity"
            >
              Activity
            </Button>
          </div>
        </aside>
      )}
      <WorkflowDialog
        isOpen={open}
        title={saleId ? "Delivery note activity" : "Output activity"}
        onClose={() => setOpen(false)}
        testId="print-activity"
        actions={
          <Button
            kind={KIND.tertiary}
            size={SIZE.compact}
            onClick={() => setOpen(false)}
          >
            Done
          </Button>
        }
      >
        <div
          data-testid="output-activity"
          data-focus={focus}
          style={{ display: "grid", gap: theme.sizing.scale500 }}
        >
          {historicSource && (
            <section
              ref={statusFocusRef}
              tabIndex={-1}
              data-testid="activity-status"
              data-highlighted={focus === "status" ? "yes" : "no"}
              style={{
                display: "grid",
                gap: theme.sizing.scale300,
                padding: theme.sizing.scale400,
                border: `${focus === "status" ? 2 : 1}px solid ${focus === "status" ? theme.colors.contentPrimary : theme.colors.borderOpaque}`,
                borderRadius: theme.borders.radius300,
                backgroundColor:
                  focus === "status"
                    ? theme.colors.backgroundTertiary
                    : theme.colors.backgroundSecondary,
                outline: "none",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  justifyContent: "space-between",
                  gap: theme.sizing.scale300,
                  flexWrap: "wrap",
                }}
              >
                <strong style={{ ...theme.typography.LabelLarge }}>
                  {STATE_TEXT[historicSource.state]}
                </strong>
                <span style={small}>
                  {historicSource.number} · {historicSource.deliveryDay}
                </span>
              </div>
              <span style={small}>{historicSource.customer.name}</span>
            </section>
          )}
          {error && (
            <p
              role="alert"
              style={{ ...small, color: theme.colors.negative, margin: 0 }}
            >
              {error}
            </p>
          )}
          {events.length === 0 && (
            <p style={{ ...small, margin: 0 }}>Output activity shows here.</p>
          )}
          {events.length > 0 && (
            <section
              data-testid="activity-timeline"
              aria-label="Delivery note activity"
              style={{ display: "grid", gap: theme.sizing.scale300 }}
            >
              {events.map((event) => (
                <article
                  key={event.id}
                  data-testid={
                    event.job
                      ? `print-activity-row-${event.job.id}`
                      : `output-activity-event-${event.id}`
                  }
                  data-state={event.job?.state}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "12px minmax(0, 1fr)",
                    gap: theme.sizing.scale300,
                    alignItems: "start",
                    borderBottom: `1px solid ${theme.colors.borderOpaque}`,
                    paddingBottom: theme.sizing.scale400,
                    minWidth: 0,
                  }}
                >
                  <span
                    aria-hidden="true"
                    style={{
                      width: 8,
                      height: 8,
                      marginTop: 6,
                      borderRadius: "50%",
                      backgroundColor:
                        event.job?.state === "printing"
                          ? theme.colors.warning
                          : theme.colors.contentTertiary,
                    }}
                  />
                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: theme.sizing.scale200,
                        flexWrap: "wrap",
                      }}
                    >
                      <strong
                        style={{
                          ...theme.typography.LabelSmall,
                          overflowWrap: "anywhere",
                        }}
                      >
                        {event.job?.what ?? event.title}
                      </strong>
                      {event.job && <span style={small}>{event.title}</span>}
                    </div>
                    {!event.job && (
                      <strong style={{ ...theme.typography.LabelSmall }}>
                        {event.title}
                      </strong>
                    )}
                    <p
                      style={{
                        ...small,
                        margin: `${theme.sizing.scale100} 0 0`,
                        overflowWrap: "anywhere",
                      }}
                    >
                      {event.detail} ·{" "}
                      <time dateTime={event.at} title={event.at}>
                        {when(event.at)}
                      </time>
                    </p>
                    {event.job && (
                      <>
                        <details
                          style={{ ...small, marginTop: theme.sizing.scale200 }}
                        >
                          <summary>Copy details</summary>
                          <p style={{ overflowWrap: "anywhere" }}>
                            Version {event.job.revision}
                            <br />
                            {event.job.printer} · {event.job.sheets}{" "}
                            {event.job.sheets === 1 ? "page" : "pages"} per copy
                          </p>
                        </details>
                        <div
                          style={{
                            display: "flex",
                            gap: theme.sizing.scale200,
                            flexWrap: "wrap",
                            marginTop: theme.sizing.scale300,
                          }}
                        >
                          <Button
                            kind={KIND.tertiary}
                            size={SIZE.compact}
                            disabled={busy}
                            onClick={() => void openCopy(event.job!)}
                          >
                            Open copy
                          </Button>
                          {event.job.reprintOf &&
                            shown.some(
                              (prior) => prior.id === event.job!.reprintOf,
                            ) && (
                              <Button
                                kind={KIND.tertiary}
                                size={SIZE.compact}
                                onClick={() => {
                                  const previous = document.querySelector(
                                    '[data-testid="print-activity-row-' +
                                      CSS.escape(event.job!.reprintOf!) +
                                      '"]',
                                  );
                                  previous?.scrollIntoView({ block: "center" });
                                  const detail =
                                    previous?.querySelector("details");
                                  if (detail) detail.open = true;
                                }}
                              >
                                Previous request
                              </Button>
                            )}
                          {event.job.state === "printing" && (
                            <Button
                              kind={KIND.secondary}
                              size={SIZE.compact}
                              onClick={() => confirm([event.job!])}
                            >
                              Confirm printed
                            </Button>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </article>
              ))}
            </section>
          )}
        </div>
      </WorkflowDialog>
    </>
  );
}
