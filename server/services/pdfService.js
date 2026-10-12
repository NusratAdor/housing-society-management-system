// server/services/pdfService.js
//
// Official documents: receipt, member statement, collection report.
//
// CHANGE (this pass): plain black-and-white, no colored bands or boxes.
//   - Plots come from member.plotsLabel (Member has no plotNo).
//   - Money lines always add up: Received = Monthly + Extra + Advance credit.
//   - Credit applied is shown separately and is not counted as cash.
//   - Dates are shown in Dhaka time, not the server timezone.
//   - Footer drawn with a zero bottom margin so PDFKit does not add blank pages.
//   - Exports and signatures are unchanged.
//
// "BDT" is used instead of the taka sign: built-in Helvetica has no glyph for it.

import PDFDocument from "pdfkit";

const SOCIETY = "Government Officer's Housing Society";
const A4 = [595.28, 841.89];
const MARGIN = 50;
const COL_WIDTH = A4[0] - MARGIN * 2;
const PAGE_BOTTOM = A4[1] - 60;

const BLACK = "#000000";
const GRAY_TEXT = "#555555";
const GRAY_LINE = "#BBBBBB";
const GRAY_BG = "#F2F2F2";

const MONTH_NAMES = [
  "",
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

// ── Formatters ────────────────────────────────────────────────────────────────

const fmt = (n) => `BDT ${Number(n || 0).toLocaleString("en-US")}`;
const num = (n) => Number(n || 0).toLocaleString("en-US");
const dash = (n) => (Number(n || 0) === 0 ? "-" : num(n));

const SHORT_MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

// Fixed 3-letter months: newer ICU prints "Sept", which wraps in narrow columns.
const fmtDate = (d) => {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      day: "2-digit",
      month: "numeric",
      year: "numeric",
      timeZone: "Asia/Dhaka",
    })
      .formatToParts(new Date(d))
      .filter((x) => x.type !== "literal")
      .map((x) => [x.type, x.value]),
  );
  return `${p.day} ${SHORT_MONTHS[Number(p.month) - 1]} ${p.year}`;
};

const fmtDateLong = (d) =>
  new Date(d).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Dhaka",
  });

const fmtDateTime = (d) =>
  new Date(d).toLocaleString("en-GB", { timeZone: "Asia/Dhaka" });

const methodLabel = (gateway) =>
  gateway === "manual" ? "Manual" : "Online (SSLCommerz)";

// ── Document plumbing ─────────────────────────────────────────────────────────

const pdfToBuffer = (doc) =>
  new Promise((resolve, reject) => {
    const chunks = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", (err) => reject(err));
  });

const createDoc = () =>
  new PDFDocument({
    size: A4,
    margins: { top: MARGIN, bottom: 50, left: MARGIN, right: MARGIN },
    bufferPages: true,
  });

const rule = (doc, y, color = GRAY_LINE, width = 0.5) => {
  doc
    .moveTo(MARGIN, y)
    .lineTo(MARGIN + COL_WIDTH, y)
    .lineWidth(width)
    .strokeColor(color)
    .stroke();
};

const ensureSpace = (doc, needed) => {
  if (doc.y + needed > PAGE_BOTTOM) {
    doc.addPage();
    doc.y = MARGIN;
    return true;
  }
  return false;
};

// ── Building blocks ───────────────────────────────────────────────────────────

const drawHeader = (doc, title, subtitle) => {
  doc
    .font("Helvetica-Bold")
    .fontSize(10)
    .fillColor(BLACK)
    .text(SOCIETY.toUpperCase(), MARGIN, MARGIN, {
      width: COL_WIDTH,
      align: "center",
      characterSpacing: 0.5,
      lineBreak: false,
    });

  doc
    .font("Helvetica-Bold")
    .fontSize(18)
    .text(title, MARGIN, MARGIN + 20, {
      width: COL_WIDTH,
      align: "center",
      lineBreak: false,
    });

  if (subtitle) {
    doc
      .font("Helvetica")
      .fontSize(9)
      .fillColor(GRAY_TEXT)
      .text(subtitle, MARGIN, MARGIN + 46, {
        width: COL_WIDTH,
        align: "center",
        lineBreak: false,
      });
  }

  rule(doc, MARGIN + 64, BLACK, 1);
  doc.y = MARGIN + 78;
};

const drawFooter = (doc) => {
  const range = doc.bufferedPageRange();

  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(range.start + i);
    // Writing below the bottom margin makes PDFKit add a blank page.
    doc.page.margins.bottom = 0;

    const y = A4[1] - 36;
    rule(doc, y - 8, GRAY_LINE, 0.5);
    doc
      .font("Helvetica")
      .fontSize(8)
      .fillColor(GRAY_TEXT)
      .text(
        `${SOCIETY}  |  Generated ${fmtDateTime(new Date())}  |  Page ${i + 1} of ${range.count}`,
        MARGIN,
        y,
        { width: COL_WIDTH, align: "center", lineBreak: false },
      );
  }
};

const drawSection = (doc, title) => {
  ensureSpace(doc, 50);
  const y = doc.y + 14;

  doc
    .font("Helvetica-Bold")
    .fontSize(9)
    .fillColor(BLACK)
    .text(title.toUpperCase(), MARGIN, y, {
      width: COL_WIDTH,
      characterSpacing: 0.6,
      lineBreak: false,
    });

  rule(doc, y + 14, BLACK, 0.8);
  doc.y = y + 22;
};

const drawKeyValues = (doc, rows) => {
  for (const [label, value] of rows) {
    ensureSpace(doc, 16);
    const y = doc.y;

    doc
      .font("Helvetica")
      .fontSize(9)
      .fillColor(GRAY_TEXT)
      .text(label, MARGIN, y, { width: 130, lineBreak: false });

    doc
      .fillColor(BLACK)
      .text(String(value ?? "-"), MARGIN + 140, y, { width: COL_WIDTH - 140 });

    doc.y = Math.max(doc.y, y + 15);
  }
};

// Label on the left, amount on the right, hairline between rows.
const drawAmountList = (doc, rows) => {
  for (const row of rows) {
    ensureSpace(doc, 20);
    const y = doc.y;

    doc
      .font(row.bold ? "Helvetica-Bold" : "Helvetica")
      .fontSize(9)
      .fillColor(BLACK)
      .text(row.label, MARGIN, y + 5, {
        width: COL_WIDTH - 150,
        lineBreak: false,
      })
      .text(String(row.value), MARGIN + COL_WIDTH - 150, y + 5, {
        width: 150,
        align: "right",
        lineBreak: false,
      });

    rule(doc, y + 19);
    doc.y = y + 20;
  }
};

const drawNote = (doc, text) => {
  ensureSpace(doc, 30);
  doc
    .font("Helvetica")
    .fontSize(8)
    .fillColor(GRAY_TEXT)
    .text(text, MARGIN, doc.y + 6, { width: COL_WIDTH });
  doc.y += 6;
};

const drawTableHeader = (doc, columns, positions, tableWidth) => {
  const y = doc.y;
  const h = 22;

  doc.rect(MARGIN, y, tableWidth, h).fill(GRAY_BG);

  columns.forEach((col, i) => {
    doc
      .font("Helvetica-Bold")
      .fontSize(8)
      .fillColor(BLACK)
      .text(col.label, positions[i] + 4, y + 7, {
        width: col.width - 8,
        align: col.align || "left",
        lineBreak: false,
      });
  });

  doc
    .moveTo(MARGIN, y + h)
    .lineTo(MARGIN + tableWidth, y + h)
    .lineWidth(0.8)
    .strokeColor(BLACK)
    .stroke();

  doc.y = y + h;
};

// rows: [{ cells: [...], bold?, shade?, note? }]
const drawTable = (doc, columns, rows) => {
  let x = MARGIN;
  const positions = columns.map((col) => {
    const pos = x;
    x += col.width;
    return pos;
  });
  const tableWidth = x - MARGIN;

  ensureSpace(doc, 60);
  drawTableHeader(doc, columns, positions, tableWidth);

  for (const row of rows) {
    doc.font(row.bold ? "Helvetica-Bold" : "Helvetica").fontSize(9);

    const cellHeights = row.cells.map((cell, i) =>
      doc.heightOfString(String(cell ?? ""), { width: columns[i].width - 8 }),
    );
    const mainHeight = Math.max(...cellHeights, 10);

    let noteHeight = 0;
    if (row.note) {
      doc.font("Helvetica").fontSize(8);
      noteHeight = doc.heightOfString(row.note, { width: tableWidth - 8 }) + 2;
    }

    const rowHeight = mainHeight + 12 + noteHeight;

    if (doc.y + rowHeight > PAGE_BOTTOM) {
      doc.addPage();
      doc.y = MARGIN;
      drawTableHeader(doc, columns, positions, tableWidth);
    }

    const y = doc.y;

    if (row.shade) doc.rect(MARGIN, y, tableWidth, rowHeight).fill(GRAY_BG);

    row.cells.forEach((cell, i) => {
      doc
        .font(row.bold ? "Helvetica-Bold" : "Helvetica")
        .fontSize(9)
        .fillColor(BLACK)
        .text(String(cell ?? ""), positions[i] + 4, y + 6, {
          width: columns[i].width - 8,
          align: columns[i].align || "left",
        });
    });

    if (row.note) {
      doc
        .font("Helvetica")
        .fontSize(8)
        .fillColor(GRAY_TEXT)
        .text(row.note, MARGIN + 4, y + 6 + mainHeight + 2, {
          width: tableWidth - 8,
        });
    }

    rule(doc, y + rowHeight);
    doc.y = y + rowHeight;
  }
};

const describeItem = (item) =>
  item.type === "extra" && item.purpose
    ? `${item.description} — ${item.purpose}`
    : item.description;

// ─── drawReceipt ──────────────────────────────────────────────────────────────

export const drawReceipt = async ({ payment, member, lineItems }) => {
  const doc = createDoc();
  const bufferPromise = pdfToBuffer(doc);

  drawHeader(doc, "Official Receipt", `Receipt No: ${payment.receiptNumber}`);

  drawSection(doc, "Member");
  drawKeyValues(doc, [
    ["Name", member.name],
    ["Membership No", member.membershipNo],
    ["Plot(s)", member.plotsLabel || "-"],
  ]);

  drawSection(doc, "Payment");
  drawKeyValues(doc, [
    ["Receipt No", payment.receiptNumber],
    ["Transaction ID", payment.transactionId],
    ["Payment Date", fmtDateLong(payment.paidAt)],
    ["Method", methodLabel(payment.gateway)],
  ]);

  drawSection(doc, "Payment Breakdown");

  const rows = lineItems.map((item) => ({
    cells: [describeItem(item), fmt(item.amount)],
  }));
  rows.push({
    cells: ["Total Paid", fmt(payment.amount)],
    bold: true,
    shade: true,
  });

  drawTable(
    doc,
    [
      { label: "DESCRIPTION", width: 345 },
      { label: "AMOUNT", width: 150, align: "right" },
    ],
    rows,
  );

  // Signature block
  ensureSpace(doc, 100);
  const sigY = doc.y + 56;

  doc.lineWidth(0.5).strokeColor(BLACK);
  doc
    .moveTo(MARGIN, sigY)
    .lineTo(MARGIN + 150, sigY)
    .stroke();
  doc
    .moveTo(A4[0] - MARGIN - 150, sigY)
    .lineTo(A4[0] - MARGIN, sigY)
    .stroke();

  doc
    .font("Helvetica")
    .fontSize(8)
    .fillColor(GRAY_TEXT)
    .text("Authorised Signature", MARGIN, sigY + 5, { lineBreak: false })
    .text("Member Signature", A4[0] - MARGIN - 150, sigY + 5, {
      lineBreak: false,
    });

  doc
    .fontSize(8)
    .text(
      "This is a computer-generated receipt and is valid without a physical signature.",
      MARGIN,
      sigY + 34,
      { width: COL_WIDTH, align: "center" },
    );

  drawFooter(doc);
  doc.end();
  return bufferPromise;
};

// ─── drawMemberReport ─────────────────────────────────────────────────────────

export const drawMemberReport = async ({
  member,
  payments,
  summary,
  currentDueBreakdown,
}) => {
  const doc = createDoc();
  const bufferPromise = pdfToBuffer(doc);

  drawHeader(
    doc,
    "Payment History Statement",
    `${fmtDateLong(summary.periodStart)} to ${fmtDateLong(summary.periodEnd)}`,
  );

  drawSection(doc, "Member");
  drawKeyValues(doc, [
    ["Name", member.name],
    ["Membership No", member.membershipNo],
    ["Plot(s)", member.plotsLabel || "-"],
  ]);

  drawSection(doc, "Summary for the period");
  drawAmountList(doc, [
    { label: "Payments received", value: fmt(summary.totalPaid), bold: true },
    { label: "   Applied to monthly dues", value: fmt(summary.totalMonthly) },
    { label: "   Applied to extra charges", value: fmt(summary.totalExtra) },
    { label: "   Added to advance credit", value: fmt(summary.totalAdvance) },
    { label: "Number of payments", value: String(summary.paymentCount) },
  ]);

  const due = currentDueBreakdown || {};
  drawSection(doc, "Account position at export date");
  drawAmountList(doc, [
    { label: "Monthly dues outstanding", value: fmt(due.totalMonthlyDue) },
    { label: "Extra charges outstanding", value: fmt(due.totalExtraDue) },
    { label: "Total outstanding", value: fmt(due.totalDue), bold: true },
    { label: "Advance credit balance", value: fmt(summary.creditBalance) },
  ]);

  drawSection(doc, "Payments");

  if (payments.length === 0) {
    doc
      .font("Helvetica")
      .fontSize(9)
      .fillColor(GRAY_TEXT)
      .text("No completed payments in this period.", MARGIN, doc.y + 4, {
        width: COL_WIDTH,
      });
    doc.y += 24;
  } else {
    const columns = [
      { label: "DATE", width: 65 },
      { label: "RECEIPT NO", width: 100 },
      { label: "RECEIVED", width: 80, align: "right" },
      { label: "MONTHLY", width: 80, align: "right" },
      { label: "EXTRA", width: 80, align: "right" },
      { label: "TO CREDIT", width: 90, align: "right" },
    ];

    const rows = payments.map((p) => ({
      cells: [
        fmtDate(p.paidAt),
        p.receiptNumber || "-",
        fmt(p.amount),
        fmt(p.monthlyApplied),
        fmt(p.extraApplied),
        fmt(p.advanceAmount),
      ],
      note: p.covers ? `Covers: ${p.covers}` : undefined,
    }));

    rows.push({
      cells: [
        "",
        "Total",
        fmt(summary.totalPaid),
        fmt(summary.totalMonthly),
        fmt(summary.totalExtra),
        fmt(summary.totalAdvance),
      ],
      bold: true,
      shade: true,
    });

    drawTable(doc, columns, rows);
  }

  const creditItems = summary.creditAppliedItems || [];
  if (creditItems.length > 0) {
    drawSection(doc, "Monthly dues paid from existing credit");

    const rows = creditItems.map((item) => ({
      cells: [
        fmtDate(item.date),
        item.month ? `${MONTH_NAMES[item.month]} ${item.year}` : "-",
        fmt(item.amount),
      ],
    }));
    rows.push({
      cells: ["", "Total credit applied", fmt(summary.creditAppliedTotal)],
      bold: true,
      shade: true,
    });

    drawTable(
      doc,
      [
        { label: "DATE", width: 90 },
        { label: "MONTH", width: 245 },
        { label: "CREDIT APPLIED", width: 160, align: "right" },
      ],
      rows,
    );
  }

  drawNote(
    doc,
    "Payments received = monthly dues + extra charges + advance credit. " +
      "Credit applied to a month uses money received earlier; it is not new cash.",
  );

  drawFooter(doc);
  doc.end();
  return bufferPromise;
};

// ─── drawAdminReport ──────────────────────────────────────────────────────────

// ─── Collection & Payments ────────────────────────────────────────────────────

export const drawAdminReport = async ({ payments, summary }) => {
  const doc = createDoc();
  const bufferPromise = pdfToBuffer(doc);

  drawHeader(
    doc,
    "Collection & Payments",
    `${fmtDateLong(summary.periodStart)} to ${fmtDateLong(summary.periodEnd)}`,
  );

  drawSection(doc, "Summary for the period");
  drawAmountList(doc, [
    {
      label: "Total collected (cash received)",
      value: fmt(summary.totalCollection),
      bold: true,
    },
    { label: "   Monthly dues", value: fmt(summary.totalMonthly) },
    { label: "   Extra charges", value: fmt(summary.totalExtra) },
    { label: "   Added to advance credit", value: fmt(summary.totalAdvance) },
    { label: "Number of payments", value: String(summary.totalPayments) },
    { label: "Members who paid", value: String(summary.membersWhoPaid) },
  ]);

  drawSection(doc, "Payments");

  if (payments.length === 0) {
    doc
      .font("Helvetica")
      .fontSize(9)
      .fillColor(GRAY_TEXT)
      .text("No completed payments in this period.", MARGIN, doc.y + 4, {
        width: COL_WIDTH,
      });
    doc.y += 24;
  } else {
    const rows = payments.map((p) => ({
      cells: [
        fmtDate(p.paidAt),
        p.receiptNumber || "-",
        `${p.member?.name || "-"} (${p.member?.membershipNo || "-"})`,
        num(p.amount),
        dash(p.monthlyApplied),
        dash(p.extraApplied),
        dash(p.advanceAmount),
      ],
    }));
    rows.push({
      cells: [
        "",
        "",
        `Total (${payments.length} payments)`,
        num(summary.totalCollection),
        dash(summary.totalMonthly),
        dash(summary.totalExtra),
        dash(summary.totalAdvance),
      ],
      bold: true,
      shade: true,
    });

    drawTable(
      doc,
      [
        { label: "DATE", width: 62 },
        { label: "RECEIPT NO", width: 90 },
        { label: "MEMBER", width: 131 },
        { label: "RECEIVED", width: 56, align: "right" },
        { label: "MONTHLY", width: 56, align: "right" },
        { label: "EXTRA", width: 50, align: "right" },
        { label: "CREDIT", width: 50, align: "right" },
      ],
      rows,
    );
  }

  drawNote(
    doc,
    "Amounts in BDT. RECEIVED is cash received on the payment date, split into monthly dues, extra charges " +
      "and CREDIT (advance added to the member's credit balance). Credit applied later to a monthly charge " +
      "is not collected again. Transaction IDs are in the CSV export.",
  );

  drawFooter(doc);
  doc.end();
  return bufferPromise;
};

// ─── Member Directory ─────────────────────────────────────────────────────────

const STATUS_LABEL = {
  active: "Active members",
  removed: "Removed members",
  all: "All members",
};

const plotLinesText = (plots = []) =>
  Array.isArray(plots) && plots.length > 0
    ? plots.map((p) => `${p.plotNo} - ${p.plotSize} `).join("\n")
    : "-";

export const drawMemberDirectory = async ({ rows, summary }) => {
  const doc = createDoc();
  const bufferPromise = pdfToBuffer(doc);

  drawHeader(
    doc,
    "Member Directory",
    `As of ${fmtDateLong(new Date())}  |  ${STATUS_LABEL[summary.status] || STATUS_LABEL.active}`,
  );

  drawSection(doc, "Summary");
  drawAmountList(doc, [
    { label: "Members", value: String(summary.totalMembers), bold: true },
    { label: "Plots", value: String(summary.totalPlots) },
    { label: "Total plot area", value: `${summary.totalArea} ` },
  ]);

  drawSection(doc, "Members");

  if (rows.length === 0) {
    doc
      .font("Helvetica")
      .fontSize(9)
      .fillColor(GRAY_TEXT)
      .text("No members found.", MARGIN, doc.y + 4, { width: COL_WIDTH });
    doc.y += 24;
  } else {
    const tableRows = rows.map((r) => ({
      cells: [
        r.membershipNo,
        r.status === "removed" ? `${r.name} (removed)` : r.name,
        r.phone || "-",
        r.designation || "-",
        plotLinesText(r.plots),
        String(r.totalArea),
      ],
    }));
    tableRows.push({
      cells: [
        "",
        `Total (${rows.length} members)`,
        "",
        "",
        `${summary.totalPlots} plots`,
        String(summary.totalArea),
      ],
      bold: true,
      shade: true,
    });

    drawTable(
      doc,
      [
        { label: "MEM. NO", width: 44 },
        { label: "NAME", width: 100 },
        { label: "PHONE", width: 88 },
        { label: "DESIGNATION", width: 66 },
        { label: "PLOT(S)", width: 137 },
        { label: "AREA", width: 60, align: "right" },
      ],
      tableRows,
    );
  }

  
  drawFooter(doc);
  doc.end();
  return bufferPromise;
};
// ─── Outstanding Dues ─────────────────────────────────────────────────────────

const monthShort = (m) =>
  [
    "",
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ][m];

export const drawOutstandingReport = async ({ rows, summary }) => {
  const doc = createDoc();
  const bufferPromise = pdfToBuffer(doc);

  drawHeader(
    doc,
    "Outstanding Dues",
    `As of ${fmtDateLong(new Date())}  |  Active members`,
  );

  drawSection(doc, "Summary");
  drawAmountList(doc, [
    {
      label: "Members with outstanding dues",
      value: String(summary.membersWithDues),
      bold: true,
    },
    { label: "   Monthly dues", value: fmt(summary.totalMonthly) },
    { label: "   Extra charges", value: fmt(summary.totalExtra) },
    {
      label: "Total outstanding",
      value: fmt(summary.totalOutstanding),
      bold: true,
    },
  ]);

  drawSection(doc, "Members");

  if (rows.length === 0) {
    doc
      .font("Helvetica")
      .fontSize(9)
      .fillColor(GRAY_TEXT)
      .text("No member has outstanding dues.", MARGIN, doc.y + 4, {
        width: COL_WIDTH,
      });
    doc.y += 24;
  } else {
    const tableRows = rows.map((r, i) => ({
      cells: [
        String(i + 1),
        r.membershipNo,
        r.name,
        num(r.monthlyDue),
        dash(r.extraDue),
        num(r.totalDue),
        r.oldestUnpaid
          ? `${monthShort(r.oldestUnpaid.month)} ${r.oldestUnpaid.year}`
          : "-",
        dash(r.creditBalance),
      ],
    }));
    tableRows.push({
      cells: [
        "",
        "",
        `Total (${rows.length} members)`,
        num(summary.totalMonthly),
        num(summary.totalExtra),
        num(summary.totalOutstanding),
        "",
        "",
      ],
      bold: true,
      shade: true,
    });

    drawTable(
      doc,
      [
        { label: "#", width: 24, align: "center" },
        { label: "MEM. NO", width: 54 },
        { label: "MEMBER", width: 118 },
        { label: "MONTHLY", width: 60, align: "right" },
        { label: "EXTRA", width: 56, align: "right" },
        { label: "TOTAL", width: 62, align: "right" },
        { label: "OLDEST DUE", width: 71, align: "right" },
        { label: "CREDIT", width: 50, align: "right" },
      ],
      tableRows,
    );
  }

  drawNote(
    doc,
    "Amounts in BDT. CREDIT is the member's available advance credit. It is shown separately and is " +
      "not subtracted from the dues.",
  );

  drawFooter(doc);
  doc.end();
  return bufferPromise;
};

// ─── Member Account Statement ─────────────────────────────────────────────────

export const drawStatement = async ({ member, rows, summary }) => {
  const doc = createDoc();
  const bufferPromise = pdfToBuffer(doc);

  drawHeader(
    doc,
    "Member Account Statement",
    `${fmtDateLong(summary.periodStart)} to ${fmtDateLong(summary.periodEnd)}`,
  );

  drawSection(doc, "Member");
  drawKeyValues(doc, [
    ["Name", member.name],
    ["Membership No", member.membershipNo],
    ["Phone", member.phone || "-"],
    ["Plot(s)", member.plotsLabel || "-"],
  ]);

  drawSection(doc, "Account summary");
  drawAmountList(doc, [
    { label: "Opening due", value: fmt(summary.openingDue) },
    { label: "   + Charges", value: fmt(summary.charges) },
    { label: "   - Paid from cash", value: fmt(summary.cashApplied) },
    { label: "   - Paid from credit", value: fmt(summary.creditUsed) },
    { label: "Closing due", value: fmt(summary.closingDue), bold: true },
    { label: "Cash received in the period", value: fmt(summary.cash) },
    { label: "   of which added to credit", value: fmt(summary.cashToCredit) },
    {
      label: "Credit balance at period end",
      value: fmt(summary.closingCredit),
      bold: true,
    },
  ]);

  drawSection(doc, "Statement");

  const tableRows = [
    {
      cells: [
        fmtDate(summary.periodStart),
        "Opening balance",
        "",
        "",
        "",
        num(summary.openingDue),
        num(summary.openingCredit),
      ],
      bold: true,
    },
    ...rows.map((r) => ({
      cells: [
        fmtDate(r.date),
        r.description,
        dash(r.charge),
        dash(r.cash),
        dash(r.creditUsed),
        num(r.due),
        num(r.creditBalance),
      ],
      note: r.note,
    })),
    {
      cells: [
        "",
        "Period totals / closing balance",
        num(summary.charges),
        num(summary.cash),
        num(summary.creditUsed),
        num(summary.closingDue),
        num(summary.closingCredit),
      ],
      bold: true,
      shade: true,
    },
  ];

  drawTable(
    doc,
    [
      { label: "DATE", width: 66 },
      { label: "DESCRIPTION", width: 169 },
      { label: "CHARGE", width: 52, align: "right" },
      { label: "CASH", width: 52, align: "right" },
      { label: "CR. USED", width: 52, align: "right" },
      { label: "DUE", width: 52, align: "right" },
      { label: "CR. BAL", width: 52, align: "right" },
    ],
    tableRows,
  );

  const rec = summary.reconciliation;
  const reconNote = !rec?.checked
    ? ""
    : rec.ok
      ? " Closing balances agree with the live account at the time of generation."
      : ` WARNING: closing balances differ from the live account (due ${rec.dueDifference}, credit ${rec.creditDifference}). Do not issue this statement; contact the system administrator.`;

  drawNote(
    doc,
    "Amounts in BDT. CASH is money received. CR. USED is a month paid from the member's credit balance " +
      "(not new money). DUE and CR. BAL are the amount owed and the credit balance after each line. " +
      "Cancelled charges are not shown." +
      reconNote +
      (rows.length === 0 ? " No activity in this period." : ""),
  );

  drawFooter(doc);
  doc.end();
  return bufferPromise;
};
