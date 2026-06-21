// client/src/pages/admin/tabs/FeeHistory.jsx
// Read-only audit view of all fee changes.
// Most recent change highlighted as "Current".

import React, { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { toast } from "react-hot-toast";
import { History, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { useAppContext } from "../../../context/AppContext";
import { formatDate } from "../../../utils/formatDate";

export default function FeeHistory() {
  const { axios, getToken } = useAppContext();

  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchHistory = useCallback(async () => {
    try {
      setLoading(true);
      const token = await getToken();
      const { data } = await axios.get("/api/settings/fee-history", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (data.success) setHistory(data.history);
    } catch {
      toast.error("Failed to load fee history");
    } finally {
      setLoading(false);
    }
  }, [axios, getToken]);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  if (loading) {
    return (
      <div className="mt-6 space-y-3 max-w-xl">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-20 rounded-xl bg-gray-100 animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="mt-6 max-w-xl">
      <div className="flex items-center gap-2 mb-5">
        <History className="h-4 w-4 text-[var(--color-primary)]" />
        <div>
          <h3 className="font-playfair text-base font-semibold text-gray-800">
            Fee Change History
          </h3>
          <p className="text-xs text-gray-400 mt-0.5">
            Every change is permanent. Historical charges always use the fee
            that was active when they were created.
          </p>
        </div>
      </div>

      {history.length === 0 ? (
        <div className="text-center py-12 text-gray-400 border border-dashed
          border-gray-200 rounded-xl">
          <History className="h-8 w-8 mx-auto mb-2 text-gray-200" />
          <p>No fee changes recorded yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {history.map((record, idx) => {
            const isCurrent = idx === 0;
            const prevAmount = history[idx + 1]?.amount;
            const diff = prevAmount ? record.amount - prevAmount : null;
            const TrendIcon = diff === null ? null
              : diff > 0 ? TrendingUp
              : diff < 0 ? TrendingDown
              : Minus;

            return (
              <motion.div
                key={record._id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.04 }}
                className={`p-4 rounded-xl border ${
                  isCurrent
                    ? "border-[var(--color-primary)] bg-blue-50"
                    : "border-gray-200 bg-white"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-lg flex-shrink-0 ${
                    isCurrent ? "bg-blue-100" : "bg-gray-100"
                  }`}>
                    {TrendIcon
                      ? <TrendIcon className={`h-4 w-4 ${
                          isCurrent ? "text-blue-600"
                            : diff > 0 ? "text-red-500"
                            : "text-emerald-500"
                        }`} />
                      : <History className="h-4 w-4 text-gray-500" />
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-lg font-bold font-playfair ${
                        isCurrent ? "text-blue-800" : "text-gray-800"
                      }`}>
                        ৳{record.amount.toLocaleString()}
                      </span>
                      {isCurrent && (
                        <span className="text-[10px] bg-blue-600 text-white
                          px-2 py-0.5 rounded-full font-semibold">
                          CURRENT
                        </span>
                      )}
                      {diff !== null && (
                        <span className={`text-xs font-medium ${
                          diff > 0 ? "text-red-500" : "text-emerald-600"
                        }`}>
                          {diff > 0 ? `+৳${diff}` : `-৳${Math.abs(diff)}`}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Effective from:{" "}
                      <span className="font-medium text-gray-700">
                        {new Date(record.effectiveFrom).toLocaleDateString("en-GB", {
                          month: "long", year: "numeric",
                        })}
                      </span>
                    </p>
                    {record.reason && (
                      <p className="text-xs text-gray-400 mt-0.5 italic">
                        "{record.reason}"
                      </p>
                    )}
                    <p className="text-[11px] text-gray-400 mt-1">
                      Set on {formatDate(record.createdAt)}
                    </p>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}