// client/src/pages/admin/ReportPage.jsx
// One generic report screen. Each report is described by a config object
// (filters, summary cards, columns). The table is memoised, so typing in a
// filter never re-renders hundreds of rows.

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Link, Navigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, FileText, Loader2, Sheet } from "lucide-react";
import { toast } from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { useAppContext } from "../../context/AppContext";
import usePageTitle from "../../hooks/usePageTitle";
import {
  formatDate,
  getDhakaDateInputValue,
  getDhakaDateMonthsAgo,
  getDhakaYearMonth,
} from "../../utils/formatDate";
import { downloadBlob, filenameFromResponse } from "../../utils/downLoadFile";

const BACKEND = import.meta.env.VITE_BACKEND_URL || "";

const money = (n) => `৳${Number(n || 0).toLocaleString()}`;
const dash = (n) => (n ? Number(n).toLocaleString() : "—");
const monthLabel = ({ month, year }) =>
  `${new Date(2000, month - 1).toLocaleDateString("en-GB", { month: "short" })} ${year}`;

const STATUS_BADGE = {
  active: "border-emerald-200 bg-emerald-50 text-emerald-700",
  removed: "border-slate-200 bg-slate-100 text-slate-600",
};

// ── Report definitions ───────────────────────────────────────────────────────

const REPORTS = {
  directory: {
    title: "Member Directory",
    description:
      "Members with contact details, plot count and total plot area.",
    filters: { status: true },
    summary: (d) => [
      { label: "Members", value: d.summary.totalMembers },
      { label: "Plots", value: d.summary.totalPlots },
      { label: "Total area", value: `${d.summary.totalArea}` },
    ],
    rows: (d) => d.rows,
    rowKey: (r) => r.membershipNo,
    columns: [
      {
        label: "Mem. no",
        render: (r) => (
          <span className="font-mono text-xs font-semibold">
            {r.membershipNo}
          </span>
        ),
      },
      {
        label: "Name",
        render: (r) => (
          <span className="font-medium text-slate-800">{r.name}</span>
        ),
      },
      { label: "Phone", render: (r) => r.phone || "—" },
      { label: "Designation", render: (r) => r.designation || "—" },
      {
        label: "Plot(s)",
        render: (r) => (
          <span className="whitespace-pre-line">
            {r.plots?.length
              ? r.plots
                  .map((p) => `${p.plotNo} · ${p.plotSize} `)
                  .join("\n")
              : "—"}
          </span>
        ),
      },
      { label: "Area", align: "right", render: (r) => r.totalArea },
      {
        label: "Status",
        render: (r) => (
          <span
            className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold capitalize ${STATUS_BADGE[r.status] || STATUS_BADGE.removed}`}
          >
            {r.status}
          </span>
        ),
      },
    ],
    note: "Individual plots are listed on each member's statement and profile.",
  },

  collection: {
    title: "Collection & Payments",
    description:
      "Cash received in a period, split into monthly dues, extra charges and advance credit.",
    filters: { range: true },
    summary: (d) => [
      {
        label: "Total collected",
        value: money(d.summary.totalCollection),
        strong: true,
      },
      { label: "Monthly dues", value: money(d.summary.totalMonthly) },
      { label: "Extra charges", value: money(d.summary.totalExtra) },
      { label: "Added to credit", value: money(d.summary.totalAdvance) },
      { label: "Payments", value: d.summary.totalPayments },
    ],
    rows: (d) => d.payments,
    rowKey: (p) => p._id,
    columns: [
      { label: "Date", render: (p) => formatDate(p.paidAt) },
      {
        label: "Receipt",
        render: (p) => (
          <span className="font-mono text-xs">{p.receiptNumber || "—"}</span>
        ),
      },
      {
        label: "Member",
        render: (p) => (
          <>
            <span className="font-medium text-slate-800">
              {p.member?.name || "—"}
            </span>
            <span className="ml-2 text-xs text-slate-400">
              {p.member?.membershipNo}
            </span>
          </>
        ),
      },
      {
        label: "Received",
        align: "right",
        render: (p) => <span className="font-semibold">{money(p.amount)}</span>,
      },

      {
        label: "Monthly",
        align: "right",
        render: (p) => dash(p.monthlyApplied),
      },
      { label: "Extra", align: "right", render: (p) => dash(p.extraApplied) },

      {
        label: "To credit",
        align: "right",
        render: (p) => dash(p.advanceAmount),
      },
    ],
    note: "Credit applied to a month later is not new cash and is not counted again.",
  },

  outstanding: {
    title: "Outstanding Dues",
    description:
      "Active members with unpaid charges, how much, since when, and any credit they hold.",
    filters: {},
    summary: (d) => [
      { label: "Members with dues", value: d.summary.membersWithDues },
      { label: "Monthly dues", value: money(d.summary.totalMonthly) },
      { label: "Extra charges", value: money(d.summary.totalExtra) },
      {
        label: "Total outstanding",
        value: money(d.summary.totalOutstanding),
        strong: true,
      },
    ],
    rows: (d) => d.rows,
    rowKey: (r) => r.memberId,
    columns: [
      {
        label: "Mem. no",
        render: (r) => (
          <span className="font-mono text-xs font-semibold">
            {r.membershipNo}
          </span>
        ),
      },
      {
        label: "Member",
        render: (r) => (
          <span className="font-medium text-slate-800">{r.name}</span>
        ),
      },
      { label: "Monthly", align: "right", render: (r) => money(r.monthlyDue) },
      { label: "Extra", align: "right", render: (r) => dash(r.extraDue) },
      {
        label: "Total due",
        align: "right",
        render: (r) => (
          <span className="font-bold text-red-600">{money(r.totalDue)}</span>
        ),
      },
      {
        label: "Oldest due",
        render: (r) => (r.oldestUnpaid ? monthLabel(r.oldestUnpaid) : "—"),
      },
      { label: "Credit", align: "right", render: (r) => dash(r.creditBalance) },
    ],
    note: "Credit is shown separately and is not subtracted from the dues.",
  },

  statement: {
    title: "Member Account Statement",
    description:
      "A member's full account history: charges, payments, credit used and balance.",
    filters: { range: true, member: true },
    summary: (d) => [
      { label: "Opening due", value: money(d.summary.openingDue) },
      { label: "Charges", value: money(d.summary.charges) },
      {
        label: "Closing due",
        value: money(d.summary.closingDue),
        strong: true,
      },
      { label: "Credit balance", value: money(d.summary.closingCredit) },
    ],
    // Opening and closing lines are added so the screen matches the PDF.
    rows: (d) => [
      {
        _id: "open",
        _bold: true,
        date: d.summary.periodStart,
        description: "Opening balance",
        due: d.summary.openingDue,
        creditBalance: d.summary.openingCredit,
      },
      ...d.rows.map((r, i) => ({ ...r, _id: `r${i}` })),
      {
        _id: "close",
        _bold: true,
        _shade: true,
        description: "Period totals / closing balance",
        charge: d.summary.charges,
        cash: d.summary.cash,
        creditUsed: d.summary.creditUsed,
        due: d.summary.closingDue,
        creditBalance: d.summary.closingCredit,
      },
    ],
    rowKey: (r) => r._id,
    columns: [
      { label: "Date", render: (r) => (r.date ? formatDate(r.date) : "") },
      {
        label: "Description",
        render: (r) => (
          <>
            {r.description}
            {r.note && (
              <span className="block text-xs font-normal text-slate-400">
                {r.note}
              </span>
            )}
          </>
        ),
      },
      { label: "Charge", align: "right", render: (r) => dash(r.charge) },
      { label: "Cash", align: "right", render: (r) => dash(r.cash) },
      {
        label: "Credit used",
        align: "right",
        render: (r) => dash(r.creditUsed),
      },
      {
        label: "Due",
        align: "right",
        render: (r) => Number(r.due ?? 0).toLocaleString(),
      },
      {
        label: "Credit bal.",
        align: "right",
        render: (r) => Number(r.creditBalance ?? 0).toLocaleString(),
      },
    ],
    note: "Cash is money received. Credit used is a month paid from the credit balance (not new money). Cancelled charges are not shown.",
  },
};

// ── Table (memoised: only re-renders when the rows really change) ─────────────

const DataTable = React.memo(function DataTable({ columns, rows, rowKey }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
      <table className="w-full min-w-[640px] text-sm">
        <thead className="border-b border-slate-200 bg-slate-50">
          <tr>
            {columns.map((c) => (
              <th
                key={c.label}
                scope="col"
                className={`px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 ${c.align === "right" ? "text-right" : "text-left"}`}
              >
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                className="px-4 py-12 text-center text-sm text-slate-400"
              >
                Nothing to show for these filters.
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr
                key={rowKey(row)}
                className={`${row._shade ? "bg-slate-50" : "hover:bg-slate-50/70"} ${row._bold ? "font-semibold" : ""}`}
              >
                {columns.map((c) => (
                  <td
                    key={c.label}
                    className={`px-4 py-3 text-slate-600 ${c.align === "right" ? "text-right tabular-nums" : "text-left"}`}
                  >
                    {c.render(row)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
});

// ── Member picker (statement) ─────────────────────────────────────────────────

const MemberPicker = ({ value, onSelect }) => {
  const { axios, getToken } = useAppContext();
  const [members, setMembers] = useState([]);
  const [query, setQuery] = useState("");

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const token = await getToken();
        const { data } = await axios.get("/api/admin/members", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (alive && data.success) {
          setMembers(
            data.members.map(({ _id, name, membershipNo, status }) => ({
              _id,
              name,
              membershipNo,
              status,
            })),
          );
        }
      } catch {
        if (alive) toast.error("Failed to load members");
      }
    })();
    return () => {
      alive = false;
    };
  }, [axios, getToken]);

  const selected = useMemo(
    () => members.find((m) => m._id === value),
    [members, value],
  );

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return members
      .filter(
        (m) =>
          m.name?.toLowerCase().includes(q) ||
          m.membershipNo?.toLowerCase().includes(q),
      )
      .slice(0, 8);
  }, [members, query]);

  if (selected) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
        <span className="font-medium text-slate-800">{selected.name}</span>
        <span className="font-mono text-xs text-slate-500">
          {selected.membershipNo}
        </span>
        {selected.status === "removed" && (
          <span className="text-xs text-slate-400">(removed)</span>
        )}
        <button
          type="button"
          onClick={() => onSelect("")}
          className="ml-1 text-xs font-semibold text-emerald-700 hover:underline"
        >
          Change
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search member by name or number…"
        aria-label="Search member"
        className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10 sm:w-72"
      />
      {matches.length > 0 && (
        <ul
          role="listbox"
          className="absolute z-20 mt-1 w-full overflow-hidden rounded-md border border-slate-200 bg-white shadow-lg sm:w-72"
        >
          {matches.map((m) => (
            <li key={m._id}>
              <button
                type="button"
                role="option"
                onClick={() => {
                  onSelect(m._id);
                  setQuery("");
                }}
                className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-slate-50"
              >
                <span className="truncate text-slate-800">{m.name}</span>
                <span className="shrink-0 font-mono text-xs text-slate-400">
                  {m.membershipNo}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

// ── Page ──────────────────────────────────────────────────────────────────────

const ReportView = ({ reportKey, config }) => {
  const { axios, getToken } = useAppContext();
  const [searchParams, setSearchParams] = useSearchParams();
  usePageTitle(config.title);

  const monthStart = useMemo(() => {
    const { year, month } = getDhakaYearMonth();
    return `${year}-${String(month).padStart(2, "0")}-01`;
  }, []);

  const [status, setStatus] = useState("active");
  const [startDate, setStartDate] = useState(
    reportKey === "statement" ? getDhakaDateMonthsAgo(12) : monthStart,
  );
  const [endDate, setEndDate] = useState(getDhakaDateInputValue);
  const memberId = searchParams.get("memberId") || "";

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [downloading, setDownloading] = useState(null);
  const controllerRef = useRef(null);

  const needsMember = !!config.filters.member;
  const today = getDhakaDateInputValue();

  const buildPath = useCallback(
    (format) => {
      const params = new URLSearchParams({ format });
      if (config.filters.range) {
        params.set("startDate", startDate);
        params.set("endDate", endDate);
      }
      if (config.filters.status) params.set("status", status);
      const path = needsMember ? `statement/${memberId}` : reportKey;
      return `/api/reports/admin/${path}?${params}`;
    },
    [config, reportKey, needsMember, memberId, startDate, endDate, status],
  );

  const rangeProblem =
    config.filters.range && (!startDate || !endDate || startDate > endDate)
      ? "Choose a valid date range."
      : "";
  const canRun = !rangeProblem && (!needsMember || !!memberId);

  const run = useCallback(async () => {
    if (!canRun) return;
    controllerRef.current?.abort(); // a newer request replaces an older one
    const controller = new AbortController();
    controllerRef.current = controller;

    setLoading(true);
    setError("");
    try {
      const token = await getToken();
      const { data: body } = await axios.get(buildPath("json"), {
        headers: { Authorization: `Bearer ${token}` },
        signal: controller.signal,
      });
      if (!controller.signal.aborted) setData(body);
    } catch (e) {
      if (e?.code === "ERR_CANCELED") return;
      setData(null);
      setError(e.response?.data?.message || "Failed to load the report.");
    } finally {
      if (controllerRef.current === controller) setLoading(false);
    }
  }, [axios, getToken, buildPath, canRun]);

  // Runs on open, and when the member / status changes. Date ranges use "Generate".
  useEffect(() => {
    run();
    return () => controllerRef.current?.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [memberId, status]);

  const download = useCallback(
    async (format) => {
      if (!canRun) return;
      setDownloading(format);
      try {
        const token = await getToken();
        const response = await fetch(`${BACKEND}${buildPath(format)}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok) {
          const err = await response.json().catch(() => ({}));
          toast.error(
            err.message || `Failed to download ${format.toUpperCase()}`,
          );
          return;
        }
        downloadBlob(
          await response.blob(),
          filenameFromResponse(response, `${reportKey}.${format}`),
        );
      } catch {
        toast.error("Download failed. Please try again.");
      } finally {
        setDownloading(null);
      }
    },
    [canRun, getToken, buildPath, reportKey],
  );

  const rows = useMemo(() => (data ? config.rows(data) : []), [data, config]);
  const summary = data ? config.summary(data) : [];

  return (
    <div className="min-h-screen bg-white pb-12">
      <Link
        to="/admin/reports"
        className="mb-3 inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-slate-800"
      >
        <ArrowLeft className="h-4 w-4" /> Reports
      </Link>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            {config.title}
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">
            {config.description}
          </p>
        </div>

        <div className="flex gap-2">
          {["pdf", "csv"].map((format) => (
            <Button
              key={format}
              type="button"
              variant="outline"
              size="sm"
              disabled={!canRun || !!downloading || !data}
              onClick={() => download(format)}
              className="gap-1.5"
            >
              {downloading === format ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : format === "pdf" ? (
                <FileText className="h-3.5 w-3.5" />
              ) : (
                <Sheet className="h-3.5 w-3.5" />
              )}
              {format.toUpperCase()}
            </Button>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div className="mt-5 flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
        {needsMember && (
          <div>
            <p className="mb-1 text-xs font-semibold text-slate-600">Member</p>
            <MemberPicker
              value={memberId}
              onSelect={(id) =>
                setSearchParams(id ? { memberId: id } : {}, { replace: true })
              }
            />
          </div>
        )}

        {config.filters.status && (
          <div>
            <label
              htmlFor="report-status"
              className="mb-1 block text-xs font-semibold text-slate-600"
            >
              Status
            </label>
            <select
              id="report-status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10"
            >
              <option value="active">Active</option>
              <option value="removed">Removed</option>
              <option value="all">All</option>
            </select>
          </div>
        )}

        {config.filters.range && (
          <>
            <div>
              <label
                htmlFor="report-from"
                className="mb-1 block text-xs font-semibold text-slate-600"
              >
                From
              </label>
              <input
                id="report-from"
                type="date"
                value={startDate}
                max={endDate || today}
                placeholder="YYYY-MM-DD"
                pattern="\d{4}-\d{2}-\d{2}"
                onChange={(e) => setStartDate(e.target.value)}
                className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10"
              />
            </div>
            <div>
              <label
                htmlFor="report-to"
                className="mb-1 block text-xs font-semibold text-slate-600"
              >
                To
              </label>
              <input
                id="report-to"
                type="date"
                value={endDate}
                min={startDate}
                max={today}
                placeholder="YYYY-MM-DD"
                pattern="\d{4}-\d{2}-\d{2}"
                onChange={(e) => setEndDate(e.target.value)}
                className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10"
              />
            </div>
            <Button
              type="button"
              onClick={run}
              disabled={!canRun || loading}
              className="h-10 gap-2 bg-emerald-600 hover:bg-emerald-700"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Generate
            </Button>
          </>
        )}
      </div>
      {rangeProblem && (
        <p className="mt-2 text-xs text-red-600">{rangeProblem}</p>
      )}

      {/* Body */}
      <div className="mt-5" aria-live="polite">
        {needsMember && !memberId && (
          <p className="rounded-2xl border border-dashed border-slate-200 py-14 text-center text-sm text-slate-400">
            Select a member to generate the statement.
          </p>
        )}

        {loading && !data && (
          <div className="flex items-center justify-center gap-2 py-14 text-sm text-slate-500">
            <Loader2 className="h-5 w-5 animate-spin" /> Loading report…
          </div>
        )}

        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}{" "}
            <button
              type="button"
              onClick={run}
              className="font-semibold underline"
            >
              Try again
            </button>
          </div>
        )}

        {data && (
          <div className={loading ? "opacity-60 transition-opacity" : ""}>
            {needsMember && data.member && (
              <div className="mb-4 rounded-2xl border border-slate-200 p-4 text-sm">
                <p className="font-semibold text-slate-900">
                  {data.member.name}{" "}
                  <span className="font-mono text-xs font-normal text-slate-500">
                    {data.member.membershipNo}
                  </span>
                </p>
                <p className="mt-1 whitespace-pre-line text-slate-500">
                  {data.member.plots?.length
                    ? data.member.plots
                        .map((p) => `${p.plotNo} · ${p.plotSize} `)
                        .join("\n")
                    : "No plots recorded"}
                </p>
              </div>
            )}

            {needsMember &&
              data.summary?.reconciliation &&
              !data.summary.reconciliation.ok && (
                <div
                  role="alert"
                  className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
                >
                  This statement does not match the live account (due difference
                  ৳{data.summary.reconciliation.dueDifference}, credit
                  difference ৳{data.summary.reconciliation.creditDifference}).
                  Check this member's records before issuing it.
                </div>
              )}

            <dl className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-5">
              {summary.map((s) => (
                <div
                  key={s.label}
                  className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                >
                  <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    {s.label}
                  </dt>
                  <dd
                    className={`mt-1 text-xl font-semibold ${s.strong ? "text-emerald-700" : "text-slate-900"}`}
                  >
                    {s.value}
                  </dd>
                </div>
              ))}
            </dl>

            <DataTable
              columns={config.columns}
              rows={rows}
              rowKey={config.rowKey}
            />

            {data.truncated && (
              <p className="mt-2 text-xs text-amber-700">
                Showing the first {rows.length} payments. Download the PDF or
                CSV for the complete list.
              </p>
            )}
            <p className="mt-3 text-xs text-slate-400">{config.note}</p>
          </div>
        )}
      </div>
    </div>
  );
};

const ReportPage = () => {
  const { reportKey } = useParams();
  const config = REPORTS[reportKey];

  if (!config) return <Navigate to="/admin/reports" replace />;

  // key remounts the view, so state never leaks from one report to another.
  return <ReportView key={reportKey} reportKey={reportKey} config={config} />;
};

export default ReportPage;
