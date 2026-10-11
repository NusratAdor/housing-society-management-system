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
  "", "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// ── Formatters ────────────────────────────────────────────────────────────────

const fmt = (n) => `BDT ${Number(n || 0).toLocaleString("en-US")}`;

const fmtDate = (d) =>
  new Date(d).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Dhaka",
  });

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
  doc.moveTo(MARGIN, sigY).lineTo(MARGIN + 150, sigY).stroke();
  doc.moveTo(A4[0] - MARGIN - 150, sigY).lineTo(A4[0] - MARGIN, sigY).stroke();

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

export const drawAdminReport = async ({ memberRows, summary }) => {
  const doc = createDoc();
  const bufferPromise = pdfToBuffer(doc);

  drawHeader(
    doc,
    "Collection Report",
    `${fmtDateLong(summary.periodStart)} to ${fmtDateLong(summary.periodEnd)}`,
  );

  drawSection(doc, "Summary for the period");
  drawAmountList(doc, [
    { label: "Total collected (cash received)", value: fmt(summary.totalCollection), bold: true },
    { label: "   Applied to dues", value: fmt(summary.totalDuesApplied) },
    { label: "   Added to advance credit", value: fmt(summary.totalAdvance) },
    { label: "Number of payments", value: String(summary.totalPayments) },
    { label: "Members who paid", value: String(summary.membersWhoPayd) },
  ]);

  drawSection(doc, "Collection by member");

  const columns = [
    { label: "#", width: 26, align: "center" },
    { label: "MEMBER", width: 150 },
    { label: "MEM NO", width: 75 },
    { label: "PAYMENTS", width: 54, align: "center" },
    { label: "RECEIVED", width: 70, align: "right" },
    { label: "DUES", width: 60, align: "right" },
    { label: "CREDIT", width: 60, align: "right" },
  ];

  const rows = memberRows.map((row, idx) => ({
    cells: [
      String(idx + 1),
      row.member?.name || "-",
      row.member?.membershipNo || "-",
      String(row.paymentCount),
      fmt(row.totalPaid),
      fmt(row.duesApplied),
      fmt(row.advanceTotal),
    ],
  }));

  rows.push({
    cells: [
      "",
      `Total (${memberRows.length} members)`,
      "",
      String(summary.totalPayments),
      fmt(summary.totalCollection),
      fmt(summary.totalDuesApplied),
      fmt(summary.totalAdvance),
    ],
    bold: true,
    shade: true,
  });

  drawTable(doc, columns, rows);

  drawNote(
    doc,
    "Collection counts cash received on the payment date. Advance credit that is " +
      "later applied to a monthly charge is not collected again.",
  );

  drawFooter(doc);
  doc.end();
  return bufferPromise;
};