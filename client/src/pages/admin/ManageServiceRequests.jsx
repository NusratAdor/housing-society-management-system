import React, { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "react-hot-toast";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import Title from "../../components/Title";
import { useAppContext } from "../../context/AppContext";
import usePageTitle from "../../hooks/usePageTitle";
import { formatDate } from "../../utils/formatDate";

const NAMES = { "guest-house": "Guest House booking", water: "Water service", electrical: "Electrical service" };

const nights = ({ checkIn, checkOut }) =>
  Math.round((Date.parse(`${checkOut}T00:00:00Z`) - Date.parse(`${checkIn}T00:00:00Z`)) / 86_400_000);

const Detail = ({ label, children }) =>
  children ? (
    <div>
      <dt className="text-xs text-gray-500">{label}</dt>
      <dd className="text-sm text-gray-800 break-words">{children}</dd>
    </div>
  ) : null;

const ManageServiceRequests = () => {
  const { axios, getToken } = useAppContext();
  usePageTitle("Service Requests");

  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("new");
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const token = await getToken();
      const { data } = await axios.get("/api/admin/service-requests", { headers: { Authorization: `Bearer ${token}` } });
      setRequests(data.requests);
    } catch {
      toast.error("Failed to load service requests");
    } finally {
      setLoading(false);
    }
  }, [axios, getToken]);

  useEffect(() => {
    load();
  }, [load]);

  const newCount = useMemo(() => requests.filter((r) => r.status === "new").length, [requests]);
  const visible = useMemo(() => requests.filter((r) => r.status === tab), [requests, tab]);

  const markDone = async (id) => {
    setBusyId(id);
    try {
      const token = await getToken();
      await axios.patch(`/api/admin/service-requests/${id}/done`, null, { headers: { Authorization: `Bearer ${token}` } });
      setRequests((prev) => prev.map((r) => (r._id === id ? { ...r, status: "done" } : r)));
      toast.success("Marked as done");
    } catch (error) {
      toast.error(error.response?.data?.message || "Could not update the request");
      load();
    } finally {
      setBusyId(null);
    }
  };

  const tabClass = (key) =>
    `px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
      tab === key ? "border-emerald-600 text-emerald-700" : "border-transparent text-gray-500 hover:text-gray-700"
    }`;

  return (
    <div className="min-h-screen bg-white pb-12">
      <Title title="Service Requests" subTitle="Guest house bookings and water / electrical requests from members." />

      <div className="mt-6 flex items-center justify-between border-b border-gray-200">
        <div className="flex">
          <button type="button" onClick={() => setTab("new")} className={tabClass("new")}>
            New{newCount > 0 && <span className="ml-1.5 rounded-full bg-emerald-500 px-1.5 py-0.5 text-[10px] font-bold text-white">{newCount}</span>}
          </button>
          <button type="button" onClick={() => setTab("done")} className={tabClass("done")}>Done</button>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={load} disabled={loading} className="mb-1 gap-1.5">
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </div>

      {visible.length === 0 ? (
        <p className="py-16 text-center text-sm text-gray-400">{loading ? "Loading…" : tab === "new" ? "No new requests." : "Nothing done yet."}</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {visible.map((r) => (
            <li key={r._id} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-gray-900">{NAMES[r.serviceType]}</p>
                  <p className="text-xs text-gray-500">
                    {r.member?.name} · No. {r.member?.membershipNo} · {r.member?.phone} · {formatDate(r.createdAt)}
                  </p>
                </div>
                {r.status === "new" && (
                  <Button type="button" size="sm" disabled={busyId === r._id} onClick={() => markDone(r._id)} className="bg-emerald-600 hover:bg-emerald-700">
                    {busyId === r._id ? "Saving…" : "Mark as done"}
                  </Button>
                )}
              </div>

              <dl className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {r.serviceType === "guest-house" ? (
                  <>
                    <Detail label="Stay">{formatDate(r.stay.checkIn)} → {formatDate(r.stay.checkOut)} ({nights(r.stay)} {nights(r.stay) === 1 ? "night" : "nights"})</Detail>
                    <Detail label="Guest">{r.stay.guestName} · {r.stay.guests} guest{r.stay.guests === 1 ? "" : "s"}</Detail>
                    <Detail label="Contact number">{r.stay.contactNumber}</Detail>
                    <Detail label="Purpose">{r.stay.purpose}</Detail>
                    <Detail label="Additional note">{r.details}</Detail>
                  </>
                ) : (
                  <>
                    <Detail label="Plot">{r.plot?.plotNo} · {r.plot?.plotSize} Katha</Detail>
                    <Detail label="Service type">{r.issueType}</Detail>
                    <div className="sm:col-span-2"><Detail label="Description"><span className="whitespace-pre-line">{r.details}</span></Detail></div>
                  </>
                )}
              </dl>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default ManageServiceRequests;