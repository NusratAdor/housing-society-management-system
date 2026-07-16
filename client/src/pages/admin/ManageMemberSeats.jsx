// client/src/pages/admin/ManageMemberSeats.jsx
//
// Admin interface for MemberSeat records — manual CRUD + CSV bulk import.
//
// CSV import flow:
//   1. Admin downloads the sample CSV template
//   2. Fills in member data (membershipNo, name, plotNo, designation,
//      joinDate, dueAmount)
//   3. Uploads the CSV — system validates and shows per-row results
//   4. Import is an upsert — safe to re-upload corrected files

import React, { useState, useEffect, useCallback, useRef } from "react";
import { toast }   from "react-hot-toast";
import {
  Plus, Edit2, Trash2, Loader2, Search,
  CheckCircle2, Clock, Upload, Download,
  FileText, AlertCircle, ChevronDown, ChevronUp, X,
} from "lucide-react";
import { useAppContext } from "../../context/AppContext";
import usePageTitle      from "../../hooks/usePageTitle";

const EMPTY_FORM = {
  membershipNo: "",
  name:         "",
  plotNo:       "",
  designation:  "",
  joinDate:     "",
};

// Sample CSV content for download
const SAMPLE_CSV = `membershipNo,name,plotNo,dueAmount
1234,Md. Kamal Hossain,"Plot-1, Plot-3",4800
5443,Nasrin Begum,Plot-7,1600
3245,Abdul Karim,Plot-12,0
7821,Fatema Khanam,"Plot-2, Plot-5",3200
4432,Mohammad Rafiqul Islam,Plot-9,800`;

export default function ManageMemberSeats() {
  const { axios, getToken } = useAppContext();
  usePageTitle("Manage Member Seats");

  const [seats,        setSeats]        = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [saving,       setSaving]       = useState(false);
  const [deleting,     setDeleting]     = useState(null);
  const [search,       setSearch]       = useState("");
  const [editingSeat,  setEditingSeat]  = useState(null);
  const [form,         setForm]         = useState(EMPTY_FORM);
  const [showForm,     setShowForm]     = useState(false);
  const [showImport,   setShowImport]   = useState(false);
  const [csvFile,      setCsvFile]      = useState(null);
  const [importing,    setImporting]    = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [showErrors,   setShowErrors]   = useState(false);

  const csvInputRef = useRef(null);

  // ── Fetch ─────────────────────────────────────────────────────────────────

  const fetchSeats = useCallback(async () => {
    try {
      const token    = await getToken();
      const { data } = await axios.get("/api/admin/seats", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (data.success) setSeats(data.seats);
    } catch {
      toast.error("Failed to load member seats");
    } finally {
      setLoading(false);
    }
  }, [axios, getToken]);

  useEffect(() => { fetchSeats(); }, [fetchSeats]);

  // ── Form ──────────────────────────────────────────────────────────────────

  const openAdd = () => {
    setEditingSeat(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
    setShowImport(false);
  };

  const openEdit = (seat) => {
    setEditingSeat(seat);
    setForm({
      membershipNo: seat.membershipNo,
      name:         seat.name,
      plotNo:       seat.plotNo || "",
      designation:  seat.designation || "",
      joinDate:     seat.joinDate
        ? new Date(seat.joinDate).toISOString().slice(0, 10)
        : "",
    });
    setShowForm(true);
    setShowImport(false);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingSeat(null);
    setForm(EMPTY_FORM);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.membershipNo.trim()) { toast.error("Membership number is required"); return; }
    if (!form.name.trim())         { toast.error("Name is required");              return; }
    if (!form.joinDate)            { toast.error("Join date is required");         return; }

    setSaving(true);
    try {
      const token = await getToken();
      const cfg   = { headers: { Authorization: `Bearer ${token}` } };

      if (editingSeat) {
        const { data } = await axios.put(`/api/admin/seats/${editingSeat._id}`, form, cfg);
        if (data.success) {
          setSeats(prev => prev.map(s => s._id === editingSeat._id ? data.seat : s));
          toast.success("Seat updated");
          closeForm();
        }
      } else {
        const { data } = await axios.post("/api/admin/seats", form, cfg);
        if (data.success) {
          setSeats(prev => [data.seat, ...prev]);
          toast.success("Seat created");
          closeForm();
        }
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to save seat");
    } finally {
      setSaving(false);
    }
  };

  // ── Delete ────────────────────────────────────────────────────────────────

  const handleDelete = async (seat) => {
    if (seat.isClaimed) { toast.error("Cannot delete a claimed seat"); return; }
    if (!window.confirm(`Delete seat for ${seat.membershipNo} (${seat.name})?`)) return;

    setDeleting(seat._id);
    try {
      const token    = await getToken();
      const { data } = await axios.delete(`/api/admin/seats/${seat._id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (data.success) {
        setSeats(prev => prev.filter(s => s._id !== seat._id));
        toast.success("Seat deleted");
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to delete seat");
    } finally {
      setDeleting(null);
    }
  };

  // ── CSV Import ────────────────────────────────────────────────────────────

  const downloadSampleCSV = () => {
    const blob = new Blob([SAMPLE_CSV], { type: "text/csv" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = "member_seats_template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCSVFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith(".csv")) {
      toast.error("Please select a CSV file");
      return;
    }
    setCsvFile(file);
    setImportResult(null);
  };

  const handleImport = async () => {
    if (!csvFile) { toast.error("Please select a CSV file first"); return; }

    setImporting(true);
    setImportResult(null);

    try {
      const token   = await getToken();
      const payload = new FormData();
      payload.append("csvFile", csvFile);

      const { data } = await axios.post("/api/admin/seats/import", payload, {
        headers: {
          Authorization:  `Bearer ${token}`,
          "Content-Type": "multipart/form-data",
        },
      });

      setImportResult(data);

      if (data.success) {
        toast.success(data.message);
        await fetchSeats(); // refresh the seat list
      } else {
        toast.error(data.message);
      }
    } catch (err) {
      const msg = err.response?.data?.message || "Import failed";
      toast.error(msg);
      setImportResult({ success: false, message: msg });
    } finally {
      setImporting(false);
      setCsvFile(null);
      if (csvInputRef.current) csvInputRef.current.value = "";
    }
  };

  const closeImport = () => {
    setShowImport(false);
    setCsvFile(null);
    setImportResult(null);
    setShowErrors(false);
    if (csvInputRef.current) csvInputRef.current.value = "";
  };

  // ── Filter ────────────────────────────────────────────────────────────────

  const filtered = seats.filter(s =>
    s.membershipNo.toLowerCase().includes(search.toLowerCase()) ||
    s.name.toLowerCase().includes(search.toLowerCase())
  );

  const claimed   = seats.filter(s =>  s.isClaimed).length;
  const unclaimed = seats.filter(s => !s.isClaimed).length;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="w-full bg-white min-h-screen">

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="font-playfair text-2xl font-semibold text-gray-900">
            Member Seats
          </h1>
          <p className="text-sm text-gray-400 mt-1 font-outfit">
            Pre-register membership numbers. Only listed members can sign up.
          </p>
          <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
            <span><span className="font-semibold text-gray-700">{seats.length}</span> total</span>
            <span><span className="font-semibold text-emerald-600">{claimed}</span> claimed</span>
            <span><span className="font-semibold text-amber-600">{unclaimed}</span> unclaimed</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setShowImport(v => !v); setShowForm(false); }}
            className="flex items-center gap-2 px-4 py-2 border border-gray-200
              hover:bg-gray-50 text-gray-700 text-sm font-semibold rounded-xl
              transition-colors"
          >
            <Upload className="h-4 w-4" />
            Import CSV
          </button>
          <button
            onClick={openAdd}
            className="flex items-center gap-2 px-4 py-2
              bg-[var(--color-primary)] hover:bg-blue-700
              text-white text-sm font-semibold rounded-xl shadow-sm transition-colors"
          >
            <Plus className="h-4 w-4" />
            Add Seat
          </button>
        </div>
      </div>

      {/* CSV Import panel */}
      {showImport && (
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-gray-800">Bulk Import from CSV</h3>
              <p className="text-xs text-gray-500 mt-0.5">
                Upload a CSV file to create or update multiple seats at once.
                Existing seats are updated safely — claimed seats only update display fields.
              </p>
            </div>
            <button onClick={closeImport}
              className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg
                hover:bg-white transition-colors">
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Required columns info */}
          <div className="bg-white rounded-xl border border-blue-100 p-4 mb-4">
            <p className="text-xs font-semibold text-gray-600 mb-2">Required CSV columns:</p>
            <div className="flex flex-wrap gap-2">
              {["membershipNo", "name", "plotNo", "dueAmount"].map(col => (
                <span key={col} className="px-2 py-1 bg-blue-100 text-blue-700
                  text-[11px] font-mono rounded-lg">
                  {col}
                </span>
              ))}
              {["designation", "joinDate"].map(col => (
                <span key={col} className="px-2 py-1 bg-gray-100 text-gray-500
                  text-[11px] font-mono rounded-lg">
                  {col} (optional)
                </span>
              ))}
            </div>
            <p className="text-[11px] text-gray-400 mt-2">
              Required: membershipNo, name, plotNo, dueAmount &nbsp;·&nbsp;
              Optional: designation, joinDate &nbsp;·&nbsp;
              Multiple plots: "Plot-1, Plot-3" (with quotes) &nbsp;·&nbsp;
              dueAmount: total opening balance in taka (0 if fully paid)
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 mb-4">
            <button
              onClick={downloadSampleCSV}
              className="flex items-center gap-2 px-4 py-2 bg-white
                border border-gray-200 hover:border-gray-300
                text-gray-700 text-sm font-medium rounded-xl transition-colors"
            >
              <Download className="h-4 w-4" />
              Download Template
            </button>

            <label className="flex items-center gap-2 px-4 py-2 bg-white
              border border-gray-200 hover:border-[var(--color-primary)]
              text-gray-700 text-sm font-medium rounded-xl cursor-pointer transition-colors">
              <FileText className="h-4 w-4 text-gray-400" />
              {csvFile ? csvFile.name : "Choose CSV file"}
              <input
                ref={csvInputRef}
                type="file"
                accept=".csv,text/csv"
                onChange={handleCSVFileChange}
                className="hidden"
              />
            </label>

            {csvFile && (
              <button
                onClick={handleImport}
                disabled={importing}
                className="flex items-center gap-2 px-5 py-2
                  bg-[var(--color-primary)] hover:bg-blue-700
                  text-white text-sm font-semibold rounded-xl
                  transition-colors disabled:opacity-50"
              >
                {importing
                  ? <><Loader2 className="h-4 w-4 animate-spin" /> Importing…</>
                  : <><Upload className="h-4 w-4" /> Import Now</>
                }
              </button>
            )}
          </div>

          {/* Import results */}
          {importResult && (
            <div className={`rounded-xl border p-4 ${
              importResult.success
                ? "bg-emerald-50 border-emerald-200"
                : "bg-red-50 border-red-200"
            }`}>
              <p className={`text-sm font-semibold mb-2 ${
                importResult.success ? "text-emerald-700" : "text-red-700"
              }`}>
                {importResult.message}
              </p>

              {importResult.results && (
                <div className="flex gap-4 text-xs mb-2">
                  <span className="text-emerald-600">
                    ✓ {importResult.results.created} created
                  </span>
                  <span className="text-blue-600">
                    ↺ {importResult.results.updated} updated
                  </span>
                  {importResult.results.errors?.length > 0 && (
                    <span className="text-red-600">
                      ✗ {importResult.results.errors.length} errors
                    </span>
                  )}
                </div>
              )}

              {importResult.results?.errors?.length > 0 && (
                <div>
                  <button
                    onClick={() => setShowErrors(v => !v)}
                    className="flex items-center gap-1 text-xs text-red-600
                      hover:text-red-800 font-medium"
                  >
                    {showErrors ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                    {showErrors ? "Hide" : "Show"} error details
                  </button>

                  {showErrors && (
                    <div className="mt-2 space-y-1.5 max-h-48 overflow-y-auto">
                      {importResult.results.errors.map((err, i) => (
                        <div key={i} className="flex items-start gap-2 text-xs
                          bg-white rounded-lg p-2.5 border border-red-100">
                          <AlertCircle className="h-3.5 w-3.5 text-red-500 flex-shrink-0 mt-0.5" />
                          <div>
                            <span className="font-mono font-semibold text-gray-700">
                              Row {err.line} ({err.membershipNo}):
                            </span>{" "}
                            <span className="text-red-600">{err.errors.join("; ")}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Manual add/edit form */}
      {showForm && (
        <div className="bg-gray-50 border border-gray-200 rounded-2xl p-6 mb-6">
          <h3 className="font-semibold text-gray-800 mb-4">
            {editingSeat ? `Edit — ${editingSeat.membershipNo}` : "Add New Seat"}
          </h3>

          {editingSeat?.isClaimed && (
            <div className="flex items-center gap-2 mb-4 px-3 py-2
              bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-700">
              <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
              Claimed seat — membership number and join date are locked.
            </div>
          )}

          <form onSubmit={handleSave}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">
                  Membership Number *
                </label>
                <input
                  type="text"
                  value={form.membershipNo}
                  onChange={e => setForm(f => ({ ...f, membershipNo: e.target.value.toUpperCase() }))}
                  readOnly={!!editingSeat?.isClaimed}
                  placeholder="e.g. 1234"
                  className={`w-full px-3 py-2 text-sm border rounded-xl outline-none
                    focus:ring-2 focus:ring-[var(--color-primary)]/20
                    focus:border-[var(--color-primary)]
                    ${editingSeat?.isClaimed
                      ? "bg-gray-100 border-gray-200 text-gray-400 cursor-default"
                      : "bg-white border-gray-200"
                    }`}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">
                  Full Name *
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Member's full name"
                  className="w-full px-3 py-2 text-sm border border-gray-200
                    rounded-xl outline-none focus:ring-2
                    focus:ring-[var(--color-primary)]/20
                    focus:border-[var(--color-primary)] bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">
                  Plot Number(s)
                  <span className="text-gray-400 font-normal ml-1">
                    — separate multiple with commas
                  </span>
                </label>
                <input
                  type="text"
                  value={form.plotNo}
                  onChange={e => setForm(f => ({ ...f, plotNo: e.target.value }))}
                  placeholder='e.g. Plot-1  or  "Plot-1, Plot-3"'
                  className="w-full px-3 py-2 text-sm border border-gray-200
                    rounded-xl outline-none focus:ring-2
                    focus:ring-[var(--color-primary)]/20
                    focus:border-[var(--color-primary)] bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">
                  Designation
                </label>
                <input
                  type="text"
                  value={form.designation}
                  onChange={e => setForm(f => ({ ...f, designation: e.target.value }))}
                  placeholder="e.g. Deputy Secretary"
                  className="w-full px-3 py-2 text-sm border border-gray-200
                    rounded-xl outline-none focus:ring-2
                    focus:ring-[var(--color-primary)]/20
                    focus:border-[var(--color-primary)] bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">
                  Join Date *
                </label>
                <input
                  type="date"
                  value={form.joinDate}
                  onChange={e => setForm(f => ({ ...f, joinDate: e.target.value }))}
                  readOnly={!!editingSeat?.isClaimed}
                  max={new Date().toISOString().slice(0, 10)}
                  className={`w-full px-3 py-2 text-sm border rounded-xl outline-none
                    focus:ring-2 focus:ring-[var(--color-primary)]/20
                    focus:border-[var(--color-primary)]
                    ${editingSeat?.isClaimed
                      ? "bg-gray-100 border-gray-200 text-gray-400 cursor-default"
                      : "bg-white border-gray-200"
                    }`}
                />
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-2 px-5 py-2.5
                  bg-[var(--color-primary)] hover:bg-blue-700
                  text-white text-sm font-semibold rounded-xl
                  transition-colors disabled:opacity-50"
              >
                {saving
                  ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</>
                  : editingSeat ? "Update Seat" : "Create Seat"
                }
              </button>
              <button
                type="button"
                onClick={closeForm}
                className="px-5 py-2.5 text-sm text-gray-600 border border-gray-200
                  rounded-xl hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Search */}
      <div className="relative mb-5">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          type="text"
          placeholder="Search by membership number or name…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-xl
            text-sm focus:outline-none focus:ring-2
            focus:ring-[var(--color-primary)]/20
            focus:border-[var(--color-primary)]"
        />
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center items-center h-40">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-sm">
            {search ? "No seats match your search." : "No seats yet. Add manually or import CSV above."}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left min-w-[700px]">
            <thead className="text-xs uppercase text-gray-400 bg-gray-50
              border-b border-gray-100">
              <tr>
                <th className="px-4 py-3 font-semibold">Membership No</th>
                <th className="px-4 py-3 font-semibold">Name</th>
                <th className="px-4 py-3 font-semibold">Plot(s)</th>
                <th className="px-4 py-3 font-semibold">Join Date</th>
                <th className="px-4 py-3 font-semibold">Opening Balance</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map(seat => (
                <tr key={seat._id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-mono font-semibold text-gray-800">
                    {seat.membershipNo}
                  </td>
                  <td className="px-4 py-3 text-gray-700">{seat.name}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {seat.plotNo || "—"}
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {seat.joinDate
                      ? new Date(seat.joinDate).toLocaleDateString("en-GB", {
                          day: "numeric", month: "short", year: "numeric",
                        })
                      : "—"
                    }
                  </td>
                  <td className="px-4 py-3">
                    {seat.openingBalance > 0 ? (
                      <span className="text-amber-600 font-semibold text-xs">
                        ৳{seat.openingBalance.toLocaleString()}
                      </span>
                    ) : (
                      <span className="text-emerald-600 text-xs">Paid up</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {seat.isClaimed ? (
                      <span className="inline-flex items-center gap-1 px-2 py-1
                        bg-emerald-50 text-emerald-700 text-[10px] font-semibold
                        rounded-full border border-emerald-200">
                        <CheckCircle2 className="h-3 w-3" />
                        Claimed
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-1
                        bg-amber-50 text-amber-700 text-[10px] font-semibold
                        rounded-full border border-amber-200">
                        <Clock className="h-3 w-3" />
                        Unclaimed
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => openEdit(seat)}
                        className="p-1.5 rounded-lg text-gray-400
                          hover:text-[var(--color-primary)] hover:bg-blue-50
                          transition-colors"
                        title="Edit"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(seat)}
                        disabled={seat.isClaimed || deleting === seat._id}
                        className="p-1.5 rounded-lg text-gray-400
                          hover:text-red-500 hover:bg-red-50 transition-colors
                          disabled:opacity-30 disabled:cursor-not-allowed"
                        title={seat.isClaimed ? "Cannot delete claimed seat" : "Delete"}
                      >
                        {deleting === seat._id
                          ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          : <Trash2  className="h-3.5 w-3.5" />
                        }
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}