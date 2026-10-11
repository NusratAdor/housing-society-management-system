import React, { useCallback, useEffect, useMemo, useRef, useState, useLayoutEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "react-hot-toast";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Edit,
  Filter,
  Loader2,
  Mail,
  MapPin,
  Phone,
  Plus,
  Search,
  Shield,
  Trash2,
  User,
  UserRound,
  Info,

  X,
} from "lucide-react";


import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

import { useAppContext } from "../../context/AppContext";
import { normalizePhone, isValidPhone } from "../../utils/phoneUtils";
import usePageTitle from "../../hooks/usePageTitle";



const PLOT_SIZES = [6.5, 7, 9, 10, 13];

const MEMBERS_PER_PAGE = 25;

const createEmptyPlot = () => ({
  plotNo: "",
  plotSize: "",
});

const buildEditForm = (member) => ({
  name: member?.name || "",
  phone: member?.phone || "",
  email: member?.email || "",
  membershipNo: member?.membershipNo || "",
  designation: member?.designation || "",

  permanentAddress: member?.permanentAddress || "",
  presentAddress: member?.presentAddress || "",

  plots:
    Array.isArray(member?.plots) && member.plots.length > 0
      ? member.plots.map((plot) => ({
          plotNo: plot.plotNo || "",
          plotSize: plot.plotSize ?? "",
        }))
      : [createEmptyPlot()],

  nominee: {
    name: member?.nominee?.name || "",
    phone: member?.nominee?.phone || "",
    email: member?.nominee?.email || "",
  },

  role: member?.role || "member",
});

const formatCurrency = (amount = 0) =>
  `৳${Number(amount || 0).toLocaleString()}`;

const getMemberPlotSizes = (member) => {
  if (!Array.isArray(member?.plots)) return [];

  return member.plots
    .map((plot) => Number(plot?.plotSize))
    .filter((size) => PLOT_SIZES.includes(size));
};

const getTotalPlotSize = (member) => {
  if (!Array.isArray(member?.plots)) return 0;

  return member.plots.reduce(
    (total, plot) => total + Number(plot?.plotSize || 0),
    0,
  );
};

const getSmallestPlotSize = (member) => {
  const sizes = getMemberPlotSizes(member);

  if (sizes.length === 0) {
    return null;
  }

  return Math.min(...sizes);
};

const getPaymentStatusClasses = (status) => {
  if (status === "Paid") {
    return "bg-emerald-50 text-emerald-700 border-emerald-200";
  }

  return "bg-red-50 text-red-700 border-red-200";
};

const getRoleClasses = (role) => {
  if (role === "admin") {
    return "bg-violet-50 text-violet-700 border-violet-200";
  }

  return "bg-slate-50 text-slate-700 border-slate-200";
};

const getStatusClasses = (status) => {
  if (status === "active") {
    return "bg-emerald-50 text-emerald-700 border-emerald-200";
  }

  return "bg-slate-100 text-slate-600 border-slate-200";
};


const compareMembershipNumbers = (a, b) => {
    const numberA = Number(a?.membershipNo);
    const numberB = Number(b?.membershipNo);

    if (
      Number.isFinite(numberA) &&
      Number.isFinite(numberB) &&
      numberA !== numberB
    ) {
      return numberA - numberB;
    }

    return String(a?.membershipNo || "").localeCompare(
      String(b?.membershipNo || ""),
      undefined,
      {
        numeric: true,
        sensitivity: "base",
      },
    );
  };
  

const ManageMembers = () => {
  const { axios, getToken } = useAppContext();

  usePageTitle("Manage Members");

  const [members, setMembers] = useState([]);
  const [dueByMemberId, setDueByMemberId] = useState({});

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  /*
   * Search is intentionally restricted to:
   *   1. name
   *   2. membership number
   *
   * Plot size is handled separately through plotSizeFilter.
   *
   * Email and phone are deliberately NOT searchable.
   */
  const [searchTerm, setSearchTerm] = useState("");
  const [plotSizeFilter, setPlotSizeFilter] = useState("all");

  const [sortField, setSortField] = useState("membershipNo");
  const [sortDirection, setSortDirection] = useState("asc");
  const [currentPage, setCurrentPage] = useState(1);

  const [editingMember, setEditingMember] = useState(null);
  const [editForm, setEditForm] = useState(null);

  const [saving, setSaving] = useState(false);
  const [editErrors, setEditErrors] = useState({});

  const [confirmRemove, setConfirmRemove] = useState(null);
  const [removing, setRemoving] = useState(false);

  const [rejectingMemberId, setRejectingMemberId] = useState(null);
  const [rejecting, setRejecting] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  const [demotionTarget, setDemotionTarget] = useState(null);
  const [demoting, setDemoting] = useState(false);

  const [openDuePopover, setOpenDuePopover] = useState(null);
const [duePopoverPos, setDuePopoverPos] = useState(null);
const dueBtnRefs = useRef({});

  /*
   * ------------------------------------------------------------
   * Fetch members
   * ------------------------------------------------------------
   */

  const fetchMembers = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const token = await getToken();

      if (!token) {
        throw new Error("Authentication token unavailable");
      }

      const [membersResponse, dueResponse] = await Promise.all([
        axios.get("/api/admin/members", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }),

        axios
          .get("/api/admin/dashboard/member-due-status", {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          })
          .catch(() => null),
      ]);

      if (!membersResponse?.data?.success) {
        throw new Error(
          membersResponse?.data?.message || "Failed to load members",
        );
      }

      const loadedMembers = membersResponse.data.members || [];

      setMembers(loadedMembers);

      if (dueResponse?.data?.success) {
        const dueMap = {};

        for (const row of dueResponse.data.members || []) {
          dueMap[row.memberId] = {
            totalDue: Number(row.totalDue || 0),
            monthlyDue: Number(row.monthlyDue || 0),
            extraDue: Number(row.extraDue || 0),
            paymentStatus: row.paymentStatus,
          };
        }

        setDueByMemberId(dueMap);
      } else {
        setDueByMemberId({});
      }
    } catch (err) {
      console.error("ManageMembers fetch error:", err);

      const status = err?.response?.status;

      if (status === 401 || status === 403) {
        setError("You are not authorized to manage members.");
      } else {
        setError(
          err?.response?.data?.message ||
            err?.message ||
            "Failed to load members.",
        );
      }
    } finally {
      setLoading(false);
    }
  }, [axios, getToken]);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  /*
   * ------------------------------------------------------------
   * Filtering
   * ------------------------------------------------------------
   */

  const filteredMembers = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    const selectedPlotSize = Number(plotSizeFilter);

    return members.filter((member) => {
      const matchesText =
        !query ||
        member.name?.toLowerCase().includes(query) ||
        member.membershipNo?.toLowerCase().includes(query) ||
        member.plots?.some((plot) =>
          String(plot?.plotNo || "")
            .toLowerCase()
            .includes(query),
        );

      /*
       * Plot-size filtering is intentionally independent from text search.
       *
       * Example:
       * Member owns [13, 7].
       *
       * Selecting "7 Katha"   -> member appears
       * Selecting "13 Katha"  -> member appears
       * Selecting "10 Katha"  -> member does not appear
       *
       * This is different from sorting.
       */
      const matchesPlotSize =
        plotSizeFilter === "all" ||
        getMemberPlotSizes(member).includes(selectedPlotSize);

      return matchesText && matchesPlotSize;
    });
  }, [members, searchTerm, plotSizeFilter]);

  /*
   * ------------------------------------------------------------
   * Sorting
   * ------------------------------------------------------------
   */

  

  const sortedMembers = useMemo(() => {
    return [...filteredMembers].sort((a, b) => {
      let comparison = 0;

      if (sortField === "membershipNo") {
        comparison = compareMembershipNumbers(a, b);
      }

      if (sortField === "smallestPlotSize") {
        const smallestA = getSmallestPlotSize(a);
        const smallestB = getSmallestPlotSize(b);

        /*
         * Members without a valid plot size should stay at the bottom
         * regardless of ascending/descending direction.
         */
        if (smallestA === null && smallestB !== null) {
          return 1;
        }

        if (smallestA !== null && smallestB === null) {
          return -1;
        }

        if (smallestA !== null && smallestB !== null) {
          comparison = smallestA - smallestB;
        }

        /*
         * Stable secondary ordering.
         */
        if (comparison === 0) {
          comparison = compareMembershipNumbers(a, b);
        }
      }

      return sortDirection === "desc" ? comparison * -1 : comparison;
    });
  }, [filteredMembers, sortField, sortDirection]);

  /*
   * ------------------------------------------------------------
   * Pagination
   * ------------------------------------------------------------
   */

  const totalPages = Math.max(
    1,
    Math.ceil(sortedMembers.length / MEMBERS_PER_PAGE),
  );

  const safeCurrentPage = Math.min(currentPage, totalPages);

  const currentMembers = sortedMembers.slice(
    (safeCurrentPage - 1) * MEMBERS_PER_PAGE,
    safeCurrentPage * MEMBERS_PER_PAGE,
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, plotSizeFilter, sortField, sortDirection]);



  useEffect(() => {
  setOpenDuePopover(null);
}, [currentPage, searchTerm, plotSizeFilter]);


  useEffect(() => {
    if (!openDuePopover) return;
    const close = () => setOpenDuePopover(null);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [openDuePopover]);


useLayoutEffect(() => {
  if (!openDuePopover) {
    setDuePopoverPos(null);
    return;
  }

  const button = dueBtnRefs.current[openDuePopover];

  if (!button) return;

  const rect = button.getBoundingClientRect();

  const popoverHeight = 150;
  const margin = 4;

  const spaceBelow = window.innerHeight - rect.bottom;
  const opensUpward =
    spaceBelow < popoverHeight + margin;

  setDuePopoverPos({
    top: opensUpward
      ? Math.max(
          rect.top - popoverHeight - margin,
          margin,
        )
      : rect.bottom + margin,

    left: rect.left,
  });
}, [openDuePopover]);

  /*
   * ------------------------------------------------------------
   * Summary
   * ------------------------------------------------------------
   */

  const activeCount = members.filter(
    (member) => member.status === "active",
  ).length;

  const removedCount = members.filter(
    (member) => member.status === "removed",
  ).length;

  /*
   * ------------------------------------------------------------
   * Edit handling
   * ------------------------------------------------------------
   */

  const openEdit = (member) => {
    setEditingMember(member);
    setEditForm(buildEditForm(member));
    setEditErrors({});
  };

  const closeEdit = () => {
    if (saving) return;

    setEditingMember(null);
    setEditForm(null);
    setEditErrors({});
  };

  const updateEditField = (field, value) => {
    setEditForm((previous) => ({
      ...previous,
      [field]: value,
    }));

    setEditErrors((previous) => {
      if (!previous[field]) return previous;

      const next = { ...previous };
      delete next[field];
      return next;
    });
  };

  const updateEditPlot = (index, field, value) => {
    setEditForm((previous) => {
      const plots = [...previous.plots];

      plots[index] = {
        ...plots[index],
        [field]: value,
      };

      return {
        ...previous,
        plots,
      };
    });

    const errorKey = `plot.${index}.${field}`;

    setEditErrors((previous) => {
      if (!previous[errorKey]) return previous;

      const next = { ...previous };
      delete next[errorKey];
      return next;
    });
  };

  const addEditPlot = () => {
    setEditForm((previous) => ({
      ...previous,
      plots: [...previous.plots, createEmptyPlot()],
    }));
  };

  const removeEditPlot = (index) => {
    if (editForm.plots.length <= 1) return;

    setEditForm((previous) => ({
      ...previous,
      plots: previous.plots.filter((_, plotIndex) => plotIndex !== index),
    }));
  };

  const updateNomineeField = (field, value) => {
    setEditForm((previous) => ({
      ...previous,
      nominee: {
        ...previous.nominee,
        [field]: value,
      },
    }));

    const errorKey = `nominee.${field}`;

    setEditErrors((previous) => {
      if (!previous[errorKey]) return previous;

      const next = { ...previous };
      delete next[errorKey];
      return next;
    });
  };

  /*
   * ------------------------------------------------------------
   * Edit validation
   * ------------------------------------------------------------
   */

  const validateEditForm = () => {
    const errors = {};

    if (!editForm.name.trim()) {
      errors.name = "Name is required.";
    }

    if (!isValidPhone(editForm.phone)) {
      errors.phone = "Enter a valid phone number.";
    }

    if (!editForm.designation.trim()) {
      errors.designation = "Designation is required.";
    }

    if (!editForm.permanentAddress.trim()) {
      errors.permanentAddress = "Permanent address is required.";
    }

    if (!editForm.presentAddress.trim()) {
      errors.presentAddress = "Present address is required.";
    }

    if (!Array.isArray(editForm.plots) || editForm.plots.length === 0) {
      errors.plots = "At least one plot is required.";
    } else {
      editForm.plots.forEach((plot, index) => {
        if (!plot.plotNo.trim()) {
          errors[`plot.${index}.plotNo`] = "Plot number is required.";
        }

        if (!PLOT_SIZES.includes(Number(plot.plotSize))) {
          errors[`plot.${index}.plotSize`] = "Select a valid plot size.";
        }
      });
    }

    if (!editForm.nominee.name.trim()) {
      errors["nominee.name"] = "Nominee name is required.";
    }

    if (!isValidPhone(editForm.nominee.phone)) {
      errors["nominee.phone"] = "Enter a valid phone number.";
    }

    if (!editForm.nominee.email.trim()) {
      errors["nominee.email"] = "Nominee email is required.";
    } else if (
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(editForm.nominee.email.trim())
    ) {
      errors["nominee.email"] = "Enter a valid email address.";
    }

    setEditErrors(errors);

    return Object.keys(errors).length === 0;
  };

  /*
   * ------------------------------------------------------------
   * Save member
   * ------------------------------------------------------------
   */

  const handleSave = async (event) => {
    event.preventDefault();

    if (!editForm || saving) return;

    if (!validateEditForm()) {
      toast.error("Please fix the highlighted fields.");
      return;
    }

    try {
      setSaving(true);

      const token = await getToken();

      if (!token) {
        toast.error("Your session has expired.");
        return;
      }

      /*
       * IMPORTANT:
       *
       * membershipNo is deliberately NOT included.
       * email is deliberately NOT included.
       *
       * membershipNo is permanently locked.
       * Email belongs to the authenticated identity.
       */
      const payload = {
        name: editForm.name.trim(),

        phone: normalizePhone(editForm.phone),

        designation: editForm.designation.trim(),

        permanentAddress: editForm.permanentAddress.trim(),

        presentAddress: editForm.presentAddress.trim(),

        plots: editForm.plots.map((plot) => ({
          plotNo: plot.plotNo.trim().toUpperCase(),

          plotSize: Number(plot.plotSize),
        })),

        nominee: {
          name: editForm.nominee.name.trim(),

          phone: normalizePhone(editForm.nominee.phone),

          email: editForm.nominee.email.trim().toLowerCase(),
        },
      };

      const { data } = await axios.put(
        `/api/admin/members/${editingMember._id}`,
        payload,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (!data?.success) {
        toast.error(data?.message || "Failed to update member.");
        return;
      }

      /*
       * Update the row immediately instead of
       * downloading the complete member list again.
       */
      if (data.member) {
        setMembers((previous) =>
          previous.map((member) =>
            member._id === editingMember._id ? data.member : member,
          ),
        );
      }

      toast.success("Member updated successfully.");

      closeEdit();
    } catch (err) {
      console.error("Update member error:", err);

      toast.error(err?.response?.data?.message || "Failed to update member.");
    } finally {
      setSaving(false);
    }
  };

  /*
   * ------------------------------------------------------------
   * Remove member
   * ------------------------------------------------------------
   */

  const handleRemove = async () => {
    if (!confirmRemove || removing) return;

    try {
      setRemoving(true);

      const token = await getToken();

      if (!token) {
        toast.error("Your session has expired.");
        return;
      }

      const { data } = await axios.delete(
        `/api/admin/members/${confirmRemove._id}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (!data?.success) {
        toast.error(data?.message || "Failed to remove member.");
        return;
      }

      /*
       * This is a soft removal.
       *
       * The backend preserves:
       * - member profile
       * - payment history
       * - financial records
       * - audit history
       *
       * MemberSeat becomes retired.
       */
      if (data.member) {
        setMembers((previous) =>
          previous.map((member) =>
            member._id === confirmRemove._id ? data.member : member,
          ),
        );
      } else {
        await fetchMembers();
      }

      toast.success("Member removed. Historical records have been preserved.");

      setConfirmRemove(null);
    } catch (err) {
      console.error("Remove member error:", err);

      toast.error(err?.response?.data?.message || "Failed to remove member.");
    } finally {
      setRemoving(false);
    }
  };

  /*
   * ------------------------------------------------------------
   * Admin request approval
   * ------------------------------------------------------------
   */

  const handleApproveAdmin = async (member) => {
    try {
      const token = await getToken();

      if (!token) {
        toast.error("Your session has expired.");
        return;
      }

      const { data } = await axios.put(
        `/api/admin/members/${member._id}/approve`,
        {},
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (!data?.success) {
        toast.error(data?.message || "Failed to approve request.");
        return;
      }

      setMembers((previous) =>
        previous.map((item) =>
          item._id === member._id
            ? {
                ...item,
                role: "admin",
                pendingAdmin: false,
              }
            : item,
        ),
      );

      toast.success(`${member.name} is now an administrator.`);
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to approve request.");
    }
  };

  /*
   * ------------------------------------------------------------
   * Admin request rejection
   * ------------------------------------------------------------
   */

    const handleRejectAdmin = async (member) => {
    if (rejecting) return;

    setRejecting(true);

    try {
      const token = await getToken();

      if (!token) {
        toast.error("Your session has expired.");
        return;
      }

      const { data } = await axios.put(
        `/api/admin/members/${member._id}/reject-admin-request`,
        {
          reason: rejectReason.trim(),
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (!data?.success) {
        toast.error(data?.message || "Failed to reject request.");
        return;
      }

      setMembers((previous) =>
        previous.map((item) =>
          item._id === member._id
            ? {
                ...item,
                pendingAdmin: false,
              }
            : item,
        ),
      );

      toast.success("Admin request rejected.");
      setRejectReason("");
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to reject request.");
    } finally {
      setRejecting(false);
      setRejectingMemberId(null);
    }
  };

  const handleDemoteMember = async () => {
    if (!demotionTarget || demoting) return;

    try {
      setDemoting(true);

      const token = await getToken();

      if (!token) {
        toast.error("Your session has expired.");
        return;
      }

      const { data } = await axios.patch(
        `/api/admin/members/${demotionTarget._id}/demote`,
        {},
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (!data?.success) {
        toast.error(data?.message || "Failed to demote administrator.");
        return;
      }

      setMembers((previous) =>
        previous.map((member) =>
          member._id === demotionTarget._id
            ? {
                ...member,
                role: "member",
                pendingAdmin: false,
              }
            : member,
        ),
      );

      toast.success(`${demotionTarget.name} is no longer an administrator.`);

      setDemotionTarget(null);
    } catch (err) {
      console.error("Demote member error:", err);

      toast.error(
        err?.response?.data?.message || "Failed to demote administrator.",
      );
    } finally {
      setDemoting(false);
    }
  };

  /*
   * ------------------------------------------------------------
   * Loading state
   * ------------------------------------------------------------
   */

  if (loading) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <div className="flex items-center gap-3 text-sm text-slate-500">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading members...
        </div>
      </div>
    );
  }

  /*
   * ------------------------------------------------------------
   * Error state
   * ------------------------------------------------------------
   */

  if (error) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
          <AlertTriangle className="mx-auto h-8 w-8 text-red-500" />

          <h2 className="mt-3 font-semibold text-red-800">
            Unable to load members
          </h2>

          <p className="mt-2 text-sm text-red-700">{error}</p>

          <Button variant="outline" className="mt-5" onClick={fetchMembers}>
            Try again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <>
      <motion.main
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8"
      >
        {/* --------------------------------------------------------
            Page header
        --------------------------------------------------------- */}

        <div className="mb-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-600">
                Administration
              </p>

              <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
                Manage Members
              </h1>

              <p className="mt-1 max-w-2xl text-sm text-slate-500">
                View member information, manage profiles, review access
                requests, and preserve membership records.
              </p>
            </div>
          </div>
        </div>

        {/* --------------------------------------------------------
            Summary cards
        --------------------------------------------------------- */}

        <div className="mb-6 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Total members
            </p>

            <p className="mt-2 text-2xl font-semibold text-slate-900">
              {members.length}
            </p>
          </div>

          <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-emerald-700">
              Active
            </p>

            <p className="mt-2 text-2xl font-semibold text-emerald-800">
              {activeCount}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Removed
            </p>

            <p className="mt-2 text-2xl font-semibold text-slate-700">
              {removedCount}
            </p>
          </div>
        </div>

        {/* --------------------------------------------------------
            Filters
        --------------------------------------------------------- */}

        <section className="mb-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="mb-4 flex items-center gap-2">
            <Filter className="h-4 w-4 text-slate-500" />

            <h2 className="text-sm font-semibold text-slate-800">
              Find a member
            </h2>
          </div>

          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

              <Input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search by name, membership number, or plot number..."
                className="h-11 pl-9"
              />
            </div>

            <select
              value={plotSizeFilter}
              onChange={(event) => setPlotSizeFilter(event.target.value)}
              className="h-11 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10"
            >
              <option value="all">All plot sizes</option>

              {PLOT_SIZES.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>

            <div className="flex flex-col gap-2 sm:flex-row">
              <select
                value={sortField}
                onChange={(event) => setSortField(event.target.value)}
                aria-label="Sort members by"
                className="h-11 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10"
              >
                <option value="membershipNo">Membership No.</option>
                <option value="smallestPlotSize">Smallest Plot Size</option>
              </select>

              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  setSortDirection((previous) =>
                    previous === "asc" ? "desc" : "asc",
                  )
                }
                className="h-11 whitespace-nowrap"
              >
                {sortDirection === "asc" ? "Ascending ↑" : "Descending ↓"}
              </Button>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span>
              Showing{" "}
              <strong className="text-slate-700">{sortedMembers.length}</strong>{" "}
              of <strong className="text-slate-700">{members.length}</strong>{" "}
              members
            </span>

            {(searchTerm || plotSizeFilter !== "all") && (
              <button
                type="button"
                onClick={() => {
                  setSearchTerm("");
                  setPlotSizeFilter("all");
                }}
                className="font-medium text-emerald-700 hover:text-emerald-800"
              >
                Clear filters
              </button>
            )}
          </div>
        </section>

        {/* --------------------------------------------------------
            Member table
        --------------------------------------------------------- */}

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1050px] text-sm">
              <thead className="border-b border-slate-200 bg-slate-50">
                <tr>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Member
                  </th>

                  <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Membership
                  </th>

                  <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Plot
                  </th>

                  <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Payment
                  </th>

                  <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Access
                  </th>

                  <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Status
                  </th>

                  <th className="px-5 py-3.5 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {currentMembers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-14 text-center">
                      <Search className="mx-auto h-7 w-7 text-slate-300" />

                      <p className="mt-3 text-sm font-medium text-slate-700">
                        No members found
                      </p>

                      <p className="mt-1 text-xs text-slate-500">
                        Try another name, membership number, plot number, or
                        plot size.
                      </p>
                    </td>
                  </tr>
                ) : (
                  currentMembers.map((member) => {
                    const due = dueByMemberId[member._id];

                    const plotCount = Array.isArray(member.plots)
                      ? member.plots.length
                      : 0;

                    return (
                      <motion.tr
                        key={member._id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.15 }}
                        className="transition hover:bg-slate-50/70"
                      >
                        {/* Member */}
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className="h-9 w-9 shrink-0 overflow-hidden rounded-full bg-emerald-50">
                              {member.profileImageUrl ? (
                                <img
                                  src={member.profileImageUrl}
                                  alt=""
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <div className="flex h-full w-full items-center justify-center text-sm font-semibold text-emerald-700">
                                  {(
                                    member.name?.trim()?.[0] || "M"
                                  ).toUpperCase()}
                                </div>
                              )}
                            </div>

                            <div className="min-w-0">
                              <p className="truncate font-semibold text-slate-800">
                                {member.name}
                              </p>

                              <p className="truncate text-xs text-slate-500">
                                {member.designation || "—"}
                              </p>
                            </div>
                          </div>
                        </td>
                        {/* Membership */}
                        <td className="px-5 py-4">
                          <span className="font-mono text-xs font-semibold text-slate-700">
                            {member.membershipNo || "—"}
                          </span>
                        </td>
                        {/* Plot */}
                        <td className="px-5 py-4">
                          <div className="space-y-1.5">
                            {Array.isArray(member.plots) &&
                            member.plots.length > 0 ? (
                              <>
                                <div className="flex items-center gap-1.5">
                                  <MapPin className="h-3.5 w-3.5 text-slate-400" />

                                  <span className="font-medium text-slate-700">
                                    {member.plots.length}{" "}
                                    {member.plots.length === 1
                                      ? "Plot"
                                      : "Plots"}
                                  </span>

                                  <span className="text-slate-400">•</span>

                                  <span className="font-medium text-slate-600">
                                    {getTotalPlotSize(member)}
                                  </span>
                                </div>

                                <p className="text-xs text-slate-400">
                                  {member.plots
                                    .map(
                                      (plot) =>
                                        `${plot.plotNo} (${plot.plotSize})`,
                                    )
                                    .join(", ")}
                                </p>
                              </>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </div>
                        </td>
                        {/* Payment */}
                       {/* Payment */}
<td className="px-5 py-4">
  {due ? (
    <>
      <button
        type="button"
        ref={(element) => {
          if (element) {
            dueBtnRefs.current[member._id] = element;
          }
        }}
        onClick={() =>
          setOpenDuePopover((current) =>
            current === member._id ? null : member._id,
          )
        }
        className="inline-flex items-center gap-1.5"
      >
        <span
          className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${
            due.totalDue > 0
              ? "border-red-200 bg-red-50 text-red-700"
              : "border-emerald-200 bg-emerald-50 text-emerald-700"
          }`}
        >
          {due.totalDue > 0
            ? `${formatCurrency(due.totalDue)} due`
            : "Paid"}
        </span>

        {due.totalDue > 0 && (
          <Info className="h-3.5 w-3.5 text-slate-400" />
        )}
      </button>

      <AnimatePresence>
        {openDuePopover === member._id &&
          due.totalDue > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{
                opacity: duePopoverPos ? 1 : 0,
                y: 0,
              }}
              exit={{ opacity: 0, y: 4 }}
              transition={{ duration: 0.12 }}
              style={{
                position: "fixed",
                top: duePopoverPos?.top ?? -9999,
                left: duePopoverPos?.left ?? 0,
                zIndex: 9999,
              }}
              className="w-52 rounded-xl border border-slate-200 bg-white p-4 shadow-xl"
            >
              <p className="mb-3 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                Due Breakdown
              </p>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between gap-4">
                  <span className="text-slate-500">
                    Monthly Dues
                  </span>

                  <span className="font-semibold text-slate-800">
                    ৳{due.monthlyDue.toLocaleString()}
                  </span>
                </div>

                <div className="flex justify-between gap-4">
                  <span className="text-slate-500">
                    Extra Charges
                  </span>

                  <span className="font-semibold text-slate-800">
                    ৳{due.extraDue.toLocaleString()}
                  </span>
                </div>

                <div className="flex justify-between gap-4 border-t border-slate-100 pt-2">
                  <span className="font-medium text-slate-700">
                    Total
                  </span>

                  <span className="font-bold text-red-600">
                    ৳{due.totalDue.toLocaleString()}
                  </span>
                </div>
              </div>
            </motion.div>
          )}
      </AnimatePresence>
    </>
  ) : (
    <span className="text-xs text-slate-400">—</span>
  )}
</td>
                        {/* Access */}
                        <td className="px-5 py-4">
                          <div className="space-y-2">
                            <span
                              className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold capitalize ${getRoleClasses(
                                member.role,
                              )}`}
                            >
                              {member.role}
                            </span>

                            {member.pendingAdmin && member.role !== "admin" && (
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleApproveAdmin(member)}
                                  className="text-xs font-semibold text-emerald-700 hover:text-emerald-800"
                                >
                                  Approve
                                </button>

                                <button
                                  type="button"
                                  onClick={() => {
                                    setRejectingMemberId(member._id);
                                    setRejectReason("");
                                  }}
                                  className="text-xs font-semibold text-red-600 hover:text-red-700"
                                >
                                  Reject
                                </button>
                              </div>
                            )}
                          </div>
                        </td>
                        {/* Status */}
                        <td className="px-5 py-4">
                          <span
                            className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold capitalize ${getStatusClasses(
                              member.status,
                            )}`}
                          >
                            {member.status}
                          </span>
                        </td>
                        {/* Actions */}
                        {/* Actions */}
                        <td className="px-5 py-4">
                          <div className="flex justify-end gap-2">
                            {member.status === "active" ? (
                              <>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => openEdit(member)}
                                  className="gap-1.5"
                                >
                                  <Edit className="h-3.5 w-3.5" />
                                  Edit
                                </Button>

                                {/* ADMIN DEMOTION — add this */}
                                {member.role === "admin" && (
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setDemotionTarget(member)}
                                    className="gap-1.5 border-amber-200 text-amber-700 hover:bg-amber-50"
                                  >
                                    <Shield className="h-3.5 w-3.5" />
                                    Demote
                                  </Button>
                                )}

                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setConfirmRemove(member)}
                                  className="gap-1.5 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                  Remove
                                </Button>
                              </>
                            ) : (
                              <span className="text-xs text-slate-400">
                                Record preserved
                              </span>
                            )}
                          </div>
                        </td>
                      </motion.tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-5 flex items-center justify-between">
            <p className="text-xs text-slate-500">
              Page {safeCurrentPage} of {totalPages}
            </p>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={safeCurrentPage === 1}
                onClick={() => setCurrentPage((page) => Math.max(page - 1, 1))}
                className="gap-1"
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>

              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={safeCurrentPage === totalPages}
                onClick={() =>
                  setCurrentPage((page) => Math.min(page + 1, totalPages))
                }
                className="gap-1"
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </motion.main>

      {/* ============================================================
          EDIT MEMBER MODAL
      ============================================================ */}

      <AnimatePresence>
        {editingMember && editForm && (
          <div className="fixed inset-0 z-50 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-slate-950/50 backdrop-blur-sm"
              onClick={closeEdit}
            />

            <div className="relative flex min-h-full items-start justify-center p-4 sm:p-6">
              <motion.div
                initial={{
                  opacity: 0,
                  y: 20,
                  scale: 0.98,
                }}
                animate={{
                  opacity: 1,
                  y: 0,
                  scale: 1,
                }}
                exit={{
                  opacity: 0,
                  y: 20,
                  scale: 0.98,
                }}
                transition={{
                  duration: 0.2,
                }}
                onClick={(event) => event.stopPropagation()}
                className="relative w-full max-w-3xl overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl"
              >
                {/* Modal header */}
                <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4 sm:px-6">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">
                      Edit member
                    </h2>

                    <p className="mt-0.5 text-xs text-slate-500">
                      Update the member's current information. Permanent
                      identity fields remain protected.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={closeEdit}
                    disabled={saving}
                    className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
                    aria-label="Close"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <form
                  onSubmit={handleSave}
                  className="max-h-[calc(100vh-8rem)] overflow-y-auto"
                >
                  <div className="space-y-6 p-5 sm:p-6">
                    {/* Identity */}
                    <section>
                      <div className="mb-4 flex items-center gap-3">
                        <div className="rounded-xl bg-slate-100 p-2 text-slate-600">
                          <Shield className="h-4 w-4" />
                        </div>

                        <div>
                          <h3 className="text-sm font-semibold text-slate-800">
                            Membership identity
                          </h3>

                          <p className="text-xs text-slate-500">
                            These values identify the member and are not
                            editable here.
                          </p>
                        </div>
                      </div>

                      <div className="grid gap-4 md:grid-cols-2">
                        <div>
                          <label className="mb-1.5 block text-xs font-semibold text-slate-600">
                            Membership number
                          </label>

                          <Input
                            value={editForm.membershipNo}
                            readOnly
                            className="bg-slate-50 font-mono text-slate-500"
                          />

                          <p className="mt-1 text-[11px] text-slate-400">
                            Permanently assigned.
                          </p>
                        </div>

                        <div>
                          <label className="mb-1.5 block text-xs font-semibold text-slate-600">
                            Email
                          </label>

                          <Input
                            value={editForm.email}
                            readOnly
                            className="bg-slate-50 text-slate-500"
                          />

                          <p className="mt-1 text-[11px] text-slate-400">
                            Managed by the sign-in identity.
                          </p>
                        </div>
                      </div>
                    </section>

                    <div className="border-t border-slate-100" />

                    {/* Personal information */}
                    <section>
                      <div className="mb-4">
                        <h3 className="text-sm font-semibold text-slate-800">
                          Personal information
                        </h3>
                      </div>

                      <div className="grid gap-4 md:grid-cols-2">
                        <div>
                          <label className="mb-1.5 block text-xs font-semibold text-slate-600">
                            Full name
                          </label>

                          <Input
                            value={editForm.name}
                            onChange={(event) =>
                              updateEditField("name", event.target.value)
                            }
                            className={editErrors.name ? "border-red-400" : ""}
                          />

                          {editErrors.name && (
                            <p className="mt-1 text-xs text-red-600">
                              {editErrors.name}
                            </p>
                          )}
                        </div>

                        <div>
                          <label className="mb-1.5 block text-xs font-semibold text-slate-600">
                            Current phone
                          </label>

                          <Input
                            type="tel"
                            value={editForm.phone}
                            onChange={(event) =>
                              updateEditField("phone", event.target.value)
                            }
                            className={editErrors.phone ? "border-red-400" : ""}
                          />

                          {editErrors.phone && (
                            <p className="mt-1 text-xs text-red-600">
                              {editErrors.phone}
                            </p>
                          )}
                        </div>

                        <div className="md:col-span-2">
                          <label className="mb-1.5 block text-xs font-semibold text-slate-600">
                            Designation
                          </label>

                          <Input
                            value={editForm.designation}
                            onChange={(event) =>
                              updateEditField("designation", event.target.value)
                            }
                            className={
                              editErrors.designation ? "border-red-400" : ""
                            }
                          />

                          {editErrors.designation && (
                            <p className="mt-1 text-xs text-red-600">
                              {editErrors.designation}
                            </p>
                          )}
                        </div>
                      </div>
                    </section>

                    <div className="border-t border-slate-100" />

                    {/* Address */}
                    <section>
                      <div className="mb-4">
                        <h3 className="text-sm font-semibold text-slate-800">
                          Address information
                        </h3>
                      </div>

                      <div className="grid gap-4 md:grid-cols-2">
                        <div>
                          <label className="mb-1.5 block text-xs font-semibold text-slate-600">
                            Permanent address
                          </label>

                          <textarea
                            rows={3}
                            value={editForm.permanentAddress}
                            onChange={(event) =>
                              updateEditField(
                                "permanentAddress",
                                event.target.value,
                              )
                            }
                            className={`w-full resize-y rounded-md border bg-white px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10 ${
                              editErrors.permanentAddress
                                ? "border-red-400"
                                : "border-slate-200"
                            }`}
                          />

                          {editErrors.permanentAddress && (
                            <p className="mt-1 text-xs text-red-600">
                              {editErrors.permanentAddress}
                            </p>
                          )}
                        </div>

                        <div>
                          <label className="mb-1.5 block text-xs font-semibold text-slate-600">
                            Present address
                          </label>

                          <textarea
                            rows={3}
                            value={editForm.presentAddress}
                            onChange={(event) =>
                              updateEditField(
                                "presentAddress",
                                event.target.value,
                              )
                            }
                            className={`w-full resize-y rounded-md border bg-white px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10 ${
                              editErrors.presentAddress
                                ? "border-red-400"
                                : "border-slate-200"
                            }`}
                          />

                          {editErrors.presentAddress && (
                            <p className="mt-1 text-xs text-red-600">
                              {editErrors.presentAddress}
                            </p>
                          )}
                        </div>
                      </div>
                    </section>

                    <div className="border-t border-slate-100" />

                    {/* Plots */}
                    <section>
                      <div className="mb-4 flex items-start justify-between gap-3">
                        <div>
                          <h3 className="text-sm font-semibold text-slate-800">
                            Plot information
                          </h3>

                          <p className="mt-1 text-xs text-slate-500">
                            Plot number remains free-form; plot size is selected
                            from the approved sizes.
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={addEditPlot}
                          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100"
                        >
                          <Plus className="h-3.5 w-3.5" />
                          Add plot
                        </button>
                      </div>

                      {editErrors.plots && (
                        <p className="mb-3 text-xs font-medium text-red-600">
                          {editErrors.plots}
                        </p>
                      )}

                      <div className="space-y-3">
                        {editForm.plots.map((plot, index) => (
                          <div
                            key={index}
                            className="rounded-xl border border-slate-200 bg-slate-50 p-3"
                          >
                            <div className="mb-3 flex items-center justify-between">
                              <span className="text-xs font-semibold text-slate-700">
                                Plot {index + 1}
                              </span>

                              {editForm.plots.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => removeEditPlot(index)}
                                  className="text-xs font-medium text-red-600 hover:text-red-700"
                                >
                                  Remove
                                </button>
                              )}
                            </div>

                            <div className="grid gap-4 md:grid-cols-2">
                              <div>
                                <label className="mb-1.5 block text-xs font-semibold text-slate-600">
                                  Plot number
                                </label>

                                <Input
                                  value={plot.plotNo}
                                  placeholder="e.g. AD-10"
                                  onChange={(event) =>
                                    updateEditPlot(
                                      index,
                                      "plotNo",
                                      event.target.value,
                                    )
                                  }
                                  className={
                                    editErrors[`plot.${index}.plotNo`]
                                      ? "border-red-400"
                                      : ""
                                  }
                                />

                                {editErrors[`plot.${index}.plotNo`] && (
                                  <p className="mt-1 text-xs text-red-600">
                                    {editErrors[`plot.${index}.plotNo`]}
                                  </p>
                                )}
                              </div>

                              <div>
                                <label className="mb-1.5 block text-xs font-semibold text-slate-600">
                                  Plot size
                                </label>

                                <select
                                  value={plot.plotSize}
                                  onChange={(event) =>
                                    updateEditPlot(
                                      index,
                                      "plotSize",
                                      event.target.value,
                                    )
                                  }
                                  className={`h-10 w-full rounded-md border bg-white px-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10 ${
                                    editErrors[`plot.${index}.plotSize`]
                                      ? "border-red-400"
                                      : "border-slate-200"
                                  }`}
                                >
                                  <option value="">Select plot size</option>

                                  {PLOT_SIZES.map((size) => (
                                    <option key={size} value={size}>
                                      {size}
                                    </option>
                                  ))}
                                </select>

                                {editErrors[`plot.${index}.plotSize`] && (
                                  <p className="mt-1 text-xs text-red-600">
                                    {editErrors[`plot.${index}.plotSize`]}
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </section>

                    <div className="border-t border-slate-100" />

                    {/* Nominee */}
                    <section>
                      <div className="mb-4">
                        <h3 className="text-sm font-semibold text-slate-800">
                          Nominee information
                        </h3>
                      </div>

                      <div className="grid gap-4 md:grid-cols-2">
                        <div>
                          <label className="mb-1.5 block text-xs font-semibold text-slate-600">
                            Nominee name
                          </label>

                          <Input
                            value={editForm.nominee.name}
                            onChange={(event) =>
                              updateNomineeField("name", event.target.value)
                            }
                            className={
                              editErrors["nominee.name"] ? "border-red-400" : ""
                            }
                          />

                          {editErrors["nominee.name"] && (
                            <p className="mt-1 text-xs text-red-600">
                              {editErrors["nominee.name"]}
                            </p>
                          )}
                        </div>

                        <div>
                          <label className="mb-1.5 block text-xs font-semibold text-slate-600">
                            Nominee phone
                          </label>

                          <Input
                            type="tel"
                            value={editForm.nominee.phone}
                            onChange={(event) =>
                              updateNomineeField("phone", event.target.value)
                            }
                            className={
                              editErrors["nominee.phone"]
                                ? "border-red-400"
                                : ""
                            }
                          />

                          {editErrors["nominee.phone"] && (
                            <p className="mt-1 text-xs text-red-600">
                              {editErrors["nominee.phone"]}
                            </p>
                          )}
                        </div>

                        <div className="md:col-span-2">
                          <label className="mb-1.5 block text-xs font-semibold text-slate-600">
                            Nominee email
                          </label>

                          <Input
                            type="email"
                            value={editForm.nominee.email}
                            onChange={(event) =>
                              updateNomineeField("email", event.target.value)
                            }
                            className={
                              editErrors["nominee.email"]
                                ? "border-red-400"
                                : ""
                            }
                          />

                          {editErrors["nominee.email"] && (
                            <p className="mt-1 text-xs text-red-600">
                              {editErrors["nominee.email"]}
                            </p>
                          )}
                        </div>
                      </div>
                    </section>

                    <div className="border-t border-slate-100" />
                  </div>

                  {/* Modal footer */}
                  <div className="sticky bottom-0 flex flex-col-reverse gap-2 border-t border-slate-200 bg-white px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={closeEdit}
                      disabled={saving}
                    >
                      Cancel
                    </Button>

                    <Button
                      type="submit"
                      disabled={saving}
                      className="gap-2 bg-emerald-600 hover:bg-emerald-700"
                    >
                      {saving && <Loader2 className="h-4 w-4 animate-spin" />}

                      {saving ? "Saving..." : "Save changes"}
                    </Button>
                  </div>
                </form>
              </motion.div>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* ============================================================
          REMOVE CONFIRMATION
      ============================================================ */}

      <AnimatePresence>
        {confirmRemove && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
              onClick={() => !removing && setConfirmRemove(null)}
            />

            <motion.div
              initial={{
                opacity: 0,
                y: 15,
                scale: 0.98,
              }}
              animate={{
                opacity: 1,
                y: 0,
                scale: 1,
              }}
              exit={{
                opacity: 0,
                y: 15,
                scale: 0.98,
              }}
              className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl"
            >
              <div className="flex items-start gap-3">
                <div className="rounded-xl bg-red-50 p-2.5 text-red-600">
                  <AlertTriangle className="h-5 w-5" />
                </div>

                <div>
                  <h2 className="font-semibold text-slate-900">
                    Remove member?
                  </h2>

                  <p className="mt-1 text-sm text-slate-500">
                    You are removing{" "}
                    <strong className="text-slate-700">
                      {confirmRemove.name}
                    </strong>
                    .
                  </p>
                </div>
              </div>

              <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4">
                <p className="text-sm leading-6 text-amber-800">
                  This does not erase the member's financial history. Their
                  profile and payment records will be preserved, and the
                  membership number will be retired so it cannot be used for
                  future registration.
                </p>
              </div>

              <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button
                  type="button"
                  variant="outline"
                  disabled={removing}
                  onClick={() => setConfirmRemove(null)}
                >
                  Cancel
                </Button>

                <Button
                  type="button"
                  disabled={removing}
                  onClick={handleRemove}
                  className="gap-2 bg-red-600 text-white hover:bg-red-700"
                >
                  {removing && <Loader2 className="h-4 w-4 animate-spin" />}

                  {removing ? "Removing..." : "Remove member"}
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>







      {/* ============================================================
    ADMIN DEMOTION CONFIRMATION
============================================================ */}

<AnimatePresence>
  {demotionTarget && (
    <div className="fixed inset-0 z-[65] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
        onClick={() => !demoting && setDemotionTarget(null)}
      />

      <motion.div
        initial={{
          opacity: 0,
          y: 15,
          scale: 0.98,
        }}
        animate={{
          opacity: 1,
          y: 0,
          scale: 1,
        }}
        exit={{
          opacity: 0,
          y: 15,
          scale: 0.98,
        }}
        className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl"
      >
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-amber-50 p-2.5 text-amber-600">
            <Shield className="h-5 w-5" />
          </div>

          <div>
            <h2 className="font-semibold text-slate-900">
              Demote administrator?
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              You are removing administrator access from{" "}
              <strong className="text-slate-700">
                {demotionTarget.name}
              </strong>
              .
            </p>
          </div>
        </div>

        <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm leading-6 text-amber-800">
            This will change the member's role from{" "}
            <strong>admin</strong> to <strong>member</strong>.
            Their profile and financial records will not be deleted.
          </p>
        </div>

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            disabled={demoting}
            onClick={() => setDemotionTarget(null)}
          >
            Cancel
          </Button>

          <Button
            type="button"
            disabled={demoting}
            onClick={handleDemoteMember}
            className="gap-2 bg-amber-600 text-white hover:bg-amber-700"
          >
            {demoting && (
              <Loader2 className="h-4 w-4 animate-spin" />
            )}

            {demoting
              ? "Demoting..."
              : "Demote administrator"}
          </Button>
        </div>
      </motion.div>
    </div>
  )}
</AnimatePresence>




      {/* ============================================================
          ADMIN REQUEST REJECTION
      ============================================================ */}

      <AnimatePresence>
        {rejectingMemberId && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
              onClick={() => {
                if (!rejecting) {
                  setRejectingMemberId(null);
                  setRejectReason("");
                }
              }}
            />

            <motion.div
              initial={{
                opacity: 0,
                y: 15,
                scale: 0.98,
              }}
              animate={{
                opacity: 1,
                y: 0,
                scale: 1,
              }}
              exit={{
                opacity: 0,
                y: 15,
                scale: 0.98,
              }}
              className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl"
            >
              <h2 className="font-semibold text-slate-900">
                Reject admin request
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Optionally provide a reason for the rejection.
              </p>

              <textarea
                value={rejectReason}
                onChange={(event) => setRejectReason(event.target.value)}
                rows={3}
                placeholder="Reason (optional)"
                className="mt-4 w-full resize-y rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10"
              />

              <div className="mt-5 flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={rejecting}
                  onClick={() => {
                    setRejectingMemberId(null);
                    setRejectReason("");
                  }}
                >
                  Cancel
                </Button>

                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => {
                    const member = members.find(
                      (item) => item._id === rejectingMemberId,
                    );

                    if (member) {
                      handleRejectAdmin(member);
                    }
                  }}
                  disabled={rejecting}
                  className="gap-2"
                >
                  {rejecting && <Loader2 className="h-4 w-4 animate-spin" />}

                  {rejecting ? "Rejecting..." : "Reject request"}
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};

export default ManageMembers;
