// client/src/pages/admin/ManageMemberSeats.jsx
//
// MemberSeat administration.
//
// MemberSeat contains only:
//   - membershipNo
//   - registeredPhone
//   - paidThroughMonth
//
// It does NOT contain member profile information.
//
// Claimed seats are historical identity records and are locked.
// The member's current phone belongs to Member.phone and is managed
// from ManageMembers.
//
// Performance:
//   - One initial API request.
//   - Client-side filtering/sorting for ~500–550 seats is inexpensive.
//   - Only one page of rows is rendered at a time.
//   - Create/update/delete update local state directly instead of
//     downloading the complete seat list again.

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Clock,
  Download,
  Edit2,
  FileText,
  Loader2,
  Plus,
  Search,
  Trash2,
  Upload,
  X,
} from "lucide-react";

import { toast } from "react-hot-toast";

import { useAppContext } from "../../context/AppContext";
import usePageTitle from "../../hooks/usePageTitle";
import { normalizePhone } from "../../utils/phoneUtils";

import { Button } from "@/components/ui/button";

const MEMBERS_PER_PAGE = 25;

const EMPTY_FORM = {
  membershipNo: "",
  phone: "",
  paidThroughMonth: "",
};

const SAMPLE_CSV = `membershipNo,phone,paidThroughMonth
001,+8801712345678,2026-03
002,+8801812345678,2026-05
003,+14155552671,2025-12
004,+8801912345678,2026-01`;

const getCurrentMonth = () => {
  const now = new Date();

  return `${now.getFullYear()}-${String(
    now.getMonth() + 1,
  ).padStart(2, "0")}`;
};

const monthLabel = (value) => {
  if (!value) return "—";

  const match = /^(\d{4})-(\d{2})$/.exec(value);

  if (!match) return value;

  const year = Number(match[1]);
  const month = Number(match[2]);

  if (
    month < 1 ||
    month > 12
  ) {
    return value;
  }

  // Use UTC so the displayed month cannot shift because of
  // the browser's local timezone.
  const date = new Date(
    Date.UTC(year, month - 1, 1),
  );

  return new Intl.DateTimeFormat(
    undefined,
    {
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    },
  ).format(date);
};

const isValidMembershipNo = (value) =>
  /^\d+$/.test(value.trim());

const isValidPaidThroughMonth = (value) =>
  /^\d{4}-(0[1-9]|1[0-2])$/.test(
    value.trim(),
  );

const getSeatStatusClasses = (isClaimed) =>
  isClaimed
    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
    : "border-amber-200 bg-amber-50 text-amber-700";

export default function ManageMemberSeats() {
  const { axios, getToken } = useAppContext();

  usePageTitle("Manage Member Seats");

  const [seats, setSeats] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");

  // null = original server order
  // asc/desc = membership number sorting
  const [membershipSort, setMembershipSort] =
    useState(null);

  const [currentPage, setCurrentPage] =
    useState(1);

  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] =
    useState(null);

  const [editingSeat, setEditingSeat] =
    useState(null);

  const [form, setForm] =
    useState(EMPTY_FORM);

  const [showForm, setShowForm] =
    useState(false);

  const [showImport, setShowImport] =
    useState(false);

  const [csvFile, setCsvFile] =
    useState(null);

  const [importing, setImporting] =
    useState(false);

  const [importResult, setImportResult] =
    useState(null);

  const [showImportWarnings, setShowImportWarnings] =
    useState(false);

  const csvInputRef = useRef(null);

  // ─────────────────────────────────────────────────────────────────────────
  // Fetch
  // ─────────────────────────────────────────────────────────────────────────

  const fetchSeats = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const token = await getToken();

      if (!token) {
        throw new Error(
          "Authentication token unavailable",
        );
      }

      const { data } = await axios.get(
        "/api/admin/seats",
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (!data?.success) {
        throw new Error(
          data?.message ||
            "Failed to load member seats",
        );
      }

      setSeats(data.seats || []);
    } catch (err) {
      console.error(
        "ManageMemberSeats fetch error:",
        err,
      );

      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to load member seats.",
      );
    } finally {
      setLoading(false);
    }
  }, [axios, getToken]);

  useEffect(() => {
    fetchSeats();
  }, [fetchSeats]);

  // ─────────────────────────────────────────────────────────────────────────
  // Form
  // ─────────────────────────────────────────────────────────────────────────

  const openAdd = () => {
    setEditingSeat(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
    setShowImport(false);
  };

  const openEdit = (seat) => {
    // Claimed/retired seats should never enter the edit flow.
    if (seat.isClaimed || seat.isRetired) {
      return;
    }

    setEditingSeat(seat);

    setForm({
      membershipNo: seat.membershipNo || "",
      phone: seat.registeredPhone || "",
      paidThroughMonth:
        seat.paidThroughMonth || "",
    });

    setShowForm(true);
    setShowImport(false);
  };

  const closeForm = () => {
    if (saving) return;

    setShowForm(false);
    setEditingSeat(null);
    setForm(EMPTY_FORM);
  };

  const updateForm = (field, value) => {
    setForm((previous) => ({
      ...previous,
      [field]: value,
    }));
  };

  const validateForm = () => {
    const membershipNo =
      form.membershipNo.trim();

    const paidThroughMonth =
      form.paidThroughMonth.trim();

    if (!membershipNo) {
      toast.error(
        "Membership number is required.",
      );
      return false;
    }

    if (!isValidMembershipNo(membershipNo)) {
      toast.error(
        "Membership number must contain digits only.",
      );
      return false;
    }

    if (!form.phone.trim()) {
      toast.error(
        "Registered phone is required.",
      );
      return false;
    }

    if (!paidThroughMonth) {
      toast.error(
        "Paid-through month is required.",
      );
      return false;
    }

    if (
      !isValidPaidThroughMonth(
        paidThroughMonth,
      )
    ) {
      toast.error(
        "Paid-through month must use YYYY-MM format.",
      );
      return false;
    }

    if (
      paidThroughMonth > getCurrentMonth()
    ) {
      toast.error(
        "Paid-through month cannot be in the future.",
      );
      return false;
    }

    return true;
  };

  const handleSave = async (event) => {
    event.preventDefault();

    if (saving || editingSeat?.isClaimed) {
      return;
    }

    if (!validateForm()) {
      return;
    }

    try {
      setSaving(true);

      const token = await getToken();

      if (!token) {
        toast.error(
          "Your session has expired.",
        );
        return;
      }

      const normalizedPhone =
        normalizePhone(form.phone);

      if (!normalizedPhone) {
        toast.error(
          "Invalid international phone number.",
        );
        return;
      }

      const payload = {
        membershipNo:
          form.membershipNo.trim(),
        phone: normalizedPhone,
        paidThroughMonth:
          form.paidThroughMonth.trim(),
      };

      const config = {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      };

      if (editingSeat) {
        const { data } =
          await axios.put(
            `/api/admin/seats/${editingSeat._id}`,
            payload,
            config,
          );

        if (!data?.success) {
          throw new Error(
            data?.message ||
              "Failed to update seat.",
          );
        }

        setSeats((previous) =>
          previous.map((seat) =>
            seat._id === editingSeat._id
              ? data.seat
              : seat,
          ),
        );

        toast.success(
          "Member seat updated.",
        );
      } else {
        const { data } =
          await axios.post(
            "/api/admin/seats",
            payload,
            config,
          );

        if (!data?.success) {
          throw new Error(
            data?.message ||
              "Failed to create seat.",
          );
        }

        setSeats((previous) => [
          data.seat,
          ...previous,
        ]);

        toast.success(
          "Member seat created.",
        );
      }

      closeForm();
    } catch (err) {
      console.error(
        "ManageMemberSeats save error:",
        err,
      );

      toast.error(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to save member seat.",
      );
    } finally {
      setSaving(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Delete
  // ─────────────────────────────────────────────────────────────────────────

  const handleDelete = async (seat) => {
    if (
      seat.isClaimed ||
      seat.isRetired ||
      deletingId
    ) {
      return;
    }

    const confirmed = window.confirm(
      `Delete membership seat ${seat.membershipNo}?`,
    );

    if (!confirmed) return;

    try {
      setDeletingId(seat._id);

      const token = await getToken();

      if (!token) {
        toast.error(
          "Your session has expired.",
        );
        return;
      }

      const { data } =
        await axios.delete(
          `/api/admin/seats/${seat._id}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        );

      if (!data?.success) {
        throw new Error(
          data?.message ||
            "Failed to delete seat.",
        );
      }

      setSeats((previous) =>
        previous.filter(
          (item) =>
            item._id !== seat._id,
        ),
      );

      toast.success(
        "Member seat deleted.",
      );
    } catch (err) {
      console.error(
        "ManageMemberSeats delete error:",
        err,
      );

      toast.error(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to delete seat.",
      );
    } finally {
      setDeletingId(null);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // CSV
  // ─────────────────────────────────────────────────────────────────────────

  const downloadSampleCSV = () => {
    const blob = new Blob(
      [SAMPLE_CSV],
      {
        type: "text/csv;charset=utf-8;",
      },
    );

    const url =
      URL.createObjectURL(blob);

    const anchor =
      document.createElement("a");

    anchor.href = url;
    anchor.download =
      "member_seats_template.csv";

    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();

    URL.revokeObjectURL(url);
  };

  const handleCSVFileChange = (
    event,
  ) => {
    const file =
      event.target.files?.[0];

    if (!file) return;

    const isCSV =
      file.name
        .toLowerCase()
        .endsWith(".csv");

    if (!isCSV) {
      toast.error(
        "Please select a CSV file.",
      );

      event.target.value = "";
      return;
    }

    setCsvFile(file);
    setImportResult(null);
    setShowImportWarnings(false);
  };

  const handleImport = async () => {
    if (!csvFile || importing) {
      return;
    }

    try {
      setImporting(true);
      setImportResult(null);
      setShowImportWarnings(false);

      const token = await getToken();

      if (!token) {
        toast.error(
          "Your session has expired.",
        );
        return;
      }

      const formData =
        new FormData();

      formData.append(
        "csvFile",
        csvFile,
      );

      // Do NOT manually set Content-Type.
      //
      // The browser/Axios must generate:
      // multipart/form-data; boundary=...
      //
      // Manually setting it can cause malformed
      // multipart requests in some environments.
      const { data } =
        await axios.post(
          "/api/admin/seats/import",
          formData,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        );

      setImportResult(data);

      if (!data?.success) {
        toast.error(
          data?.message ||
            "CSV import failed.",
        );
        return;
      }

      toast.success(
        data.message ||
          "CSV import completed.",
      );

      // Refresh because the import can create/update
      // many seats and local reconciliation would be
      // more complex than simply fetching the authoritative
      // server state once.
      await fetchSeats();
    } catch (err) {
      console.error(
        "ManageMemberSeats import error:",
        err,
      );

      const message =
        err?.response?.data?.message ||
        err?.message ||
        "CSV import failed.";

      setImportResult({
        success: false,
        message,
      });

      toast.error(message);
    } finally {
      setImporting(false);
      setCsvFile(null);

      if (csvInputRef.current) {
        csvInputRef.current.value =
          "";
      }
    }
  };

  const closeImport = () => {
    if (importing) return;

    setShowImport(false);
    setCsvFile(null);
    setImportResult(null);
    setShowImportWarnings(false);

    if (csvInputRef.current) {
      csvInputRef.current.value =
        "";
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Filtering + sorting
  // ─────────────────────────────────────────────────────────────────────────

  const filteredAndSortedSeats =
    useMemo(() => {
      const query =
        search.trim();

      let result = seats;

      if (query) {
        result = seats.filter(
          (seat) =>
            seat.membershipNo?.includes(
              query,
            ),
        );
      }

      if (!membershipSort) {
        return result;
      }

      return [...result].sort(
        (a, b) => {
          const numberA = Number(
            a.membershipNo,
          );

          const numberB = Number(
            b.membershipNo,
          );

          const numericComparison =
            numberA - numberB;

          // Numeric sorting is the correct primary
          // behavior because membership numbers are
          // digits-only.
          if (
            numericComparison !== 0
          ) {
            return membershipSort ===
              "asc"
              ? numericComparison
              : -numericComparison;
          }

          // Stable tie-breaker for unexpected
          // duplicate/legacy data.
          return String(
            a.membershipNo,
          ).localeCompare(
            String(b.membershipNo),
          );
        },
      );
    }, [
      seats,
      search,
      membershipSort,
    ]);

  const totalPages = Math.max(
    1,
    Math.ceil(
      filteredAndSortedSeats.length /
        MEMBERS_PER_PAGE,
    ),
  );

  const safeCurrentPage =
    Math.min(
      currentPage,
      totalPages,
    );

  const currentSeats =
    useMemo(() => {
      const start =
        (safeCurrentPage - 1) *
        MEMBERS_PER_PAGE;

      return filteredAndSortedSeats.slice(
        start,
        start + MEMBERS_PER_PAGE,
      );
    }, [
      filteredAndSortedSeats,
      safeCurrentPage,
    ]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, membershipSort]);

  const toggleMembershipSort =
    () => {
      setMembershipSort(
        (previous) => {
          if (!previous) return "asc";

          if (previous === "asc") {
            return "desc";
          }

          return null;
        },
      );
    };

  // ─────────────────────────────────────────────────────────────────────────
  // Summary
  // ─────────────────────────────────────────────────────────────────────────

  const totalSeats =
    seats.length;

  const claimedSeats =
    useMemo(
      () =>
        seats.filter(
          (seat) =>
            seat.isClaimed,
        ).length,
      [seats],
    );

  const unclaimedSeats =
    totalSeats - claimedSeats;

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex items-center gap-3 text-sm text-slate-500">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading member seats...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
          <AlertCircle className="mx-auto h-8 w-8 text-red-500" />

          <h2 className="mt-3 text-base font-semibold text-red-800">
            Unable to load member seats
          </h2>

          <p className="mt-2 text-sm text-red-700">
            {error}
          </p>

          <Button
            type="button"
            variant="outline"
            className="mt-5"
            onClick={fetchSeats}
          >
            Try again
          </Button>
        </div>
      </main>
    );
  }

  return (
    <main className="w-full">
      <div className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8">
        {/* ─────────────────────────────────────────────────────────────── */}
        {/* Header */}
        {/* ─────────────────────────────────────────────────────────────── */}

        <section className="mb-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
                Member Seats
              </h1>

              <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">
                Manage pre-registered membership numbers
                and their historical paid-through dates.
                Member profile information is collected
                after the seat is claimed.
              </p>

              <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-slate-500">
                <span>
                  <strong className="text-slate-800">
                    {totalSeats}
                  </strong>{" "}
                  total
                </span>

                <span>
                  <strong className="text-emerald-700">
                    {claimedSeats}
                  </strong>{" "}
                  claimed
                </span>

                <span>
                  <strong className="text-amber-700">
                    {unclaimedSeats}
                  </strong>{" "}
                  available
                </span>
              </div>
            </div>

            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowImport(
                    (previous) =>
                      !previous,
                  );
                  setShowForm(false);
                }}
                className="w-full gap-2 sm:w-auto"
              >
                <Upload className="h-4 w-4" />
                Import CSV
              </Button>

              <Button
                type="button"
                onClick={openAdd}
                className="w-full gap-2 sm:w-auto"
              >
                <Plus className="h-4 w-4" />
                Add seat
              </Button>
            </div>
          </div>
        </section>

        {/* ─────────────────────────────────────────────────────────────── */}
        {/* CSV Import */}
        {/* ─────────────────────────────────────────────────────────────── */}

        {showImport && (
          <section className="mb-6 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">
                  Import member seats
                </h2>

                <p className="mt-1 text-xs leading-5 text-slate-500">
                  Upload a CSV to create new seats or
                  synchronize unclaimed seats. Claimed and
                  retired seats are never overwritten.
                </p>
              </div>

              <button
                type="button"
                onClick={closeImport}
                disabled={importing}
                className="rounded-lg p-1.5 text-slate-400 transition hover:bg-white hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="Close import panel"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 rounded-lg border border-slate-200 bg-white p-4">
              <p className="text-xs font-semibold text-slate-700">
                Required columns
              </p>

              <div className="mt-2 flex flex-wrap gap-2">
                {[
                  "membershipNo",
                  "phone",
                  "paidThroughMonth",
                ].map((column) => (
                  <span
                    key={column}
                    className="rounded-md bg-slate-100 px-2 py-1 font-mono text-[11px] text-slate-600"
                  >
                    {column}
                  </span>
                ))}
              </div>

              <p className="mt-3 text-xs leading-5 text-slate-500">
                Membership numbers contain digits only.
                Phone numbers should use an international
                format. paidThroughMonth uses YYYY-MM and
                cannot be a future month.
              </p>
            </div>

            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              <button
                type="button"
                onClick={downloadSampleCSV}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                <Download className="h-4 w-4" />
                Download template
              </button>

              <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50">
                <FileText className="h-4 w-4 text-slate-400" />

                <span className="max-w-[220px] truncate">
                  {csvFile
                    ? csvFile.name
                    : "Choose CSV file"}
                </span>

                <input
                  ref={csvInputRef}
                  type="file"
                  accept=".csv,text/csv"
                  onChange={
                    handleCSVFileChange
                  }
                  className="sr-only"
                />
              </label>

              {csvFile && (
                <Button
                  type="button"
                  disabled={importing}
                  onClick={handleImport}
                  className="gap-2"
                >
                  {importing ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Importing...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4" />
                      Import now
                    </>
                  )}
                </Button>
              )}
            </div>

            {importResult && (
              <div
                className={`mt-4 rounded-lg border p-4 ${
                  importResult.success
                    ? "border-emerald-200 bg-emerald-50"
                    : "border-red-200 bg-red-50"
                }`}
              >
                <p
                  className={`text-sm font-semibold ${
                    importResult.success
                      ? "text-emerald-800"
                      : "text-red-800"
                  }`}
                >
                  {importResult.message}
                </p>

                {importResult.results && (
                  <>
                    <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                      <ImportStat
                        label="Created"
                        value={
                          importResult.results
                            .created ?? 0
                        }
                      />

                      <ImportStat
                        label="Updated"
                        value={
                          importResult.results
                            .updated ?? 0
                        }
                      />

                      <ImportStat
                        label="Claimed skipped"
                        value={
                          importResult.results
                            .skippedClaimed ?? 0
                        }
                      />

                      <ImportStat
                        label="Retired skipped"
                        value={
                          importResult.results
                            .skippedRetired ?? 0
                        }
                      />
                    </div>

                    {importResult.results
                      .warnings?.length >
                      0 && (
                      <div className="mt-3">
                        <button
                          type="button"
                          onClick={() =>
                            setShowImportWarnings(
                              (previous) =>
                                !previous,
                            )
                          }
                          className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700"
                        >
                          {showImportWarnings ? (
                            <ChevronUp className="h-3.5 w-3.5" />
                          ) : (
                            <ChevronDown className="h-3.5 w-3.5" />
                          )}

                          {showImportWarnings
                            ? "Hide"
                            : "Show"}{" "}
                          skipped-seat details
                        </button>

                        {showImportWarnings && (
                          <div className="mt-2 max-h-48 space-y-1.5 overflow-y-auto">
                            {importResult.results.warnings.map(
                              (
                                warning,
                                index,
                              ) => (
                                <div
                                  key={`${warning.membershipNo}-${index}`}
                                  className="rounded-md border border-amber-100 bg-white p-2.5 text-xs"
                                >
                                  <span className="font-mono font-semibold text-slate-700">
                                    {warning.membershipNo}
                                  </span>

                                  <span className="ml-2 text-amber-700">
                                    {warning.message}
                                  </span>
                                </div>
                              ),
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {importResult.results
                      .errors?.length >
                      0 && (
                      <div className="mt-3 rounded-lg border border-red-200 bg-white p-3">
                        <p className="text-xs font-semibold text-red-700">
                          Validation errors
                        </p>

                        <div className="mt-2 max-h-48 space-y-1.5 overflow-y-auto">
                          {importResult.results.errors.map(
                            (
                              item,
                              index,
                            ) => (
                              <div
                                key={`${item.line}-${index}`}
                                className="text-xs text-red-700"
                              >
                                <span className="font-mono font-semibold">
                                  Row{" "}
                                  {
                                    item.line
                                  }
                                  :
                                </span>{" "}
                                {item.errors.join(
                                  "; ",
                                )}
                              </div>
                            ),
                          )}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </section>
        )}

        {/* ─────────────────────────────────────────────────────────────── */}
        {/* Manual form */}
        {/* ─────────────────────────────────────────────────────────────── */}

        {showForm && (
          <section className="mb-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">
                  {editingSeat
                    ? `Edit seat ${editingSeat.membershipNo}`
                    : "Add member seat"}
                </h2>

                <p className="mt-1 text-xs text-slate-500">
                  {editingSeat
                    ? "Only unclaimed seats can be edited."
                    : "Add the membership information supplied by the society office."}
                </p>
              </div>

              <button
                type="button"
                onClick={closeForm}
                disabled={saving}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-50 hover:text-slate-700"
                aria-label="Close form"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form
              onSubmit={handleSave}
              className="mt-5"
            >
              <div className="grid gap-4 md:grid-cols-3">
                <Field
                  label="Membership number"
                  required
                >
                  <input
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    value={
                      form.membershipNo
                    }
                    onChange={(event) =>
                      updateForm(
                        "membershipNo",
                        event.target.value.replace(
                          /\D/g,
                          "",
                        ),
                      )
                    }
                    placeholder="e.g. 1234"
                    className={inputClass}
                    disabled={
                      Boolean(
                        editingSeat,
                      )
                    }
                  />
                </Field>

                <Field
                  label="Registered phone"
                  required
                  hint="+8801712345678"
                >
                  <input
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    value={form.phone}
                    onChange={(event) =>
                      updateForm(
                        "phone",
                        event.target.value,
                      )
                    }
                    placeholder="+8801712345678"
                    className={inputClass}
                  />
                </Field>

                <Field
                  label="Paid through month"
                  required
                  hint="YYYY-MM"
                >
                  <input
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    maxLength={7}
                    value={
                      form.paidThroughMonth
                    }
                    onChange={(event) =>
                      updateForm(
                        "paidThroughMonth",
                        event.target.value.replace(
                          /[^0-9-]/g,
                          "",
                        ),
                      )
                    }
                    placeholder="2026-03"
                    className={inputClass}
                  />
                </Field>
              </div>

              {editingSeat && (
                <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                  This seat is still unclaimed, so the
                  registered phone and paid-through month
                  may be corrected. Once claimed, these
                  provisioning fields become permanently
                  locked.
                </div>
              )}

              <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={closeForm}
                  disabled={saving}
                >
                  Cancel
                </Button>

                <Button
                  type="submit"
                  disabled={saving}
                  className="gap-2"
                >
                  {saving && (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  )}

                  {saving
                    ? "Saving..."
                    : editingSeat
                      ? "Update seat"
                      : "Create seat"}
                </Button>
              </div>
            </form>
          </section>
        )}

        {/* ─────────────────────────────────────────────────────────────── */}
        {/* Search / controls */}
        {/* ─────────────────────────────────────────────────────────────── */}

        <section className="mb-4 rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

              <input
                type="search"
                value={search}
                onChange={(event) =>
                  setSearch(
                    event.target.value,
                  )
                }
                placeholder="Search membership number..."
                className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-4 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10"
                aria-label="Search member seats"
              />
            </div>

            <div className="flex items-center justify-between gap-3 md:w-auto">
              <span className="text-xs text-slate-500">
                {filteredAndSortedSeats.length}{" "}
                result
                {filteredAndSortedSeats.length ===
                1
                  ? ""
                  : "s"}
              </span>

              {(search ||
                membershipSort) && (
                <button
                  type="button"
                  onClick={() => {
                    setSearch("");
                    setMembershipSort(
                      null,
                    );
                  }}
                  className="text-xs font-semibold text-emerald-700 hover:text-emerald-800"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        </section>

        {/* ─────────────────────────────────────────────────────────────── */}
        {/* Table */}
        {/* ─────────────────────────────────────────────────────────────── */}

        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          {currentSeats.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <Search className="mx-auto h-7 w-7 text-slate-300" />

              <h2 className="mt-3 text-sm font-semibold text-slate-700">
                No member seats found
              </h2>

              <p className="mt-1 text-xs text-slate-500">
                {search
                  ? "Try a different membership number."
                  : "Add a seat manually or import a CSV file."}
              </p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead className="border-b border-slate-200 bg-slate-50">
                    <tr>
                      <th className="px-4 py-3.5">
                        <button
                          type="button"
                          onClick={
                            toggleMembershipSort
                          }
                          className="group inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500 transition hover:text-slate-800"
                        >
                          Membership No

                          {membershipSort ===
                          "asc" ? (
                            <ChevronUp className="h-3.5 w-3.5 text-emerald-600" />
                          ) : membershipSort ===
                            "desc" ? (
                            <ChevronDown className="h-3.5 w-3.5 text-emerald-600" />
                          ) : (
                            <span className="text-slate-300">
                              ↕
                            </span>
                          )}
                        </button>
                      </th>

                      <th className="px-4 py-3.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Registered phone
                      </th>

                      <th className="px-4 py-3.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Paid through
                      </th>

                      <th className="px-4 py-3.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Status
                      </th>

                      <th className="px-4 py-3.5 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Actions
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100">
                    {currentSeats.map(
                      (seat) => {
                        const locked =
                          seat.isClaimed ||
                          seat.isRetired;

                        return (
                          <tr
                            key={
                              seat._id
                            }
                            className="transition-colors hover:bg-slate-50/80"
                          >
                            <td className="px-4 py-3.5">
                              <span className="font-mono text-sm font-semibold text-slate-800">
                                {
                                  seat.membershipNo
                                }
                              </span>
                            </td>

                            <td className="px-4 py-3.5 text-xs text-slate-600">
                              {
                                seat.registeredPhone
                              }
                            </td>

                            <td className="px-4 py-3.5">
                              <span className="text-xs font-medium text-slate-700">
                                {monthLabel(
                                  seat.paidThroughMonth,
                                )}
                              </span>
                            </td>

                            <td className="px-4 py-3.5">
                              <span
                                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${getSeatStatusClasses(
                                  seat.isClaimed,
                                )}`}
                              >
                                {seat.isClaimed ? (
                                  <CheckCircle2 className="h-3 w-3" />
                                ) : (
                                  <Clock className="h-3 w-3" />
                                )}

                                {seat.isClaimed
                                  ? "Claimed"
                                  : "Available"}
                              </span>
                            </td>

                            <td className="px-4 py-3.5">
                              <div className="flex justify-end gap-1">
                                <button
                                  type="button"
                                  onClick={() =>
                                    openEdit(
                                      seat,
                                    )
                                  }
                                  disabled={
                                    locked
                                  }
                                  className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-30"
                                  title={
                                    locked
                                      ? "Claimed or retired seats cannot be edited"
                                      : "Edit seat"
                                  }
                                  aria-label={`Edit membership ${seat.membershipNo}`}
                                >
                                  <Edit2 className="h-4 w-4" />
                                </button>

                                <button
                                  type="button"
                                  onClick={() =>
                                    handleDelete(
                                      seat,
                                    )
                                  }
                                  disabled={
                                    locked ||
                                    deletingId ===
                                      seat._id
                                  }
                                  className="rounded-lg p-2 text-slate-400 transition hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-30"
                                  title={
                                    locked
                                      ? "Claimed or retired seats cannot be deleted"
                                      : "Delete seat"
                                  }
                                  aria-label={`Delete membership ${seat.membershipNo}`}
                                >
                                  {deletingId ===
                                  seat._id ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <Trash2 className="h-4 w-4" />
                                  )}
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      },
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="flex flex-col gap-3 border-t border-slate-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-slate-500">
                  Showing{" "}
                  <strong className="text-slate-700">
                    {(safeCurrentPage -
                      1) *
                      MEMBERS_PER_PAGE +
                      1}
                  </strong>{" "}
                  to{" "}
                  <strong className="text-slate-700">
                    {Math.min(
                      safeCurrentPage *
                        MEMBERS_PER_PAGE,
                      filteredAndSortedSeats.length,
                    )}
                  </strong>{" "}
                  of{" "}
                  <strong className="text-slate-700">
                    {
                      filteredAndSortedSeats.length
                    }
                  </strong>
                </p>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={
                      safeCurrentPage ===
                      1
                    }
                    onClick={() =>
                      setCurrentPage(
                        (page) =>
                          Math.max(
                            1,
                            page - 1,
                          ),
                      )
                    }
                    className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 px-2.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                    Previous
                  </button>

                  <span className="min-w-16 text-center text-xs font-medium text-slate-600">
                    {safeCurrentPage} /{" "}
                    {totalPages}
                  </span>

                  <button
                    type="button"
                    disabled={
                      safeCurrentPage ===
                      totalPages
                    }
                    onClick={() =>
                      setCurrentPage(
                        (page) =>
                          Math.min(
                            totalPages,
                            page + 1,
                          ),
                      )
                    }
                    className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 px-2.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Next
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </>
          )}
        </section>
      </div>
    </main>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Small presentational helpers
// ─────────────────────────────────────────────────────────────────────────────

const inputClass =
  "h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400";

function Field({
  label,
  required = false,
  hint,
  children,
}) {
  return (
    <div>
      <label className="mb-1.5 flex items-center gap-1 text-xs font-semibold text-slate-600">
        <span>{label}</span>

        {required && (
          <span className="text-red-500">
            *
          </span>
        )}
      </label>

      {children}

      {hint && (
        <p className="mt-1 text-[11px] text-slate-400">
          {hint}
        </p>
      )}
    </div>
  );
}

function ImportStat({
  label,
  value,
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <p className="text-[11px] text-slate-500">
        {label}
      </p>

      <p className="mt-1 text-lg font-semibold text-slate-800">
        {value}
      </p>
    </div>
  );
}