// server/services/pdfService.js
//
// Programmatic PDF generation using pdfkit.
// Every function returns a Buffer (not a stream) so the controller can
// set Content-Length before piping — important for download progress bars.
//
// Design:
//   drawReceipt()    — single-payment formal receipt
//   drawMemberReport() — member transaction history report
//   drawAdminReport() — society-wide collection report
//
// Shared helpers at the bottom handle repeating elements:
//   drawHeader(), drawFooter(), drawTable(), drawSectionTitle()
//
// Font: Helvetica (built-in, no external font file needed)
// Page size: A4 (595.28 × 841.89 pts)

import PDFDocument from "pdfkit";

const SOCIETY = "Government Officer's Housing Society";
const A4       = [595.28, 841.89];
const MARGIN   = 50;
const COL_WIDTH = A4[0] - MARGIN * 2;

// Brand colours as RGB arrays (pdfkit uses [r, g, b] 0-255)
const DARK_GREEN  = [6,  79, 62];
const MID_GREEN   = [16, 185, 129];
const LIGHT_GREEN = [209, 250, 229];
const DARK_GRAY   = [31,  41, 55];
const MID_GRAY    = [107, 114, 128];
const LIGHT_GRAY  = [243, 244, 246];
const WHITE       = [255, 255, 255];
const RED         = [220, 38,  38];

const fmt = (n) => `৳${Number(n).toLocaleString()}`;
const fmtDate = (d) =>
  new Date(d).toLocaleDateString("en-GB", {
    day: "numeric", month: "long", year: "numeric",
  });

// ─── pdfToBuffer ──────────────────────────────────────────────────────────────
// Collects pdfkit stream events into a Buffer.
// All public functions call this internally.

const pdfToBuffer = (doc) =>
  new Promise((resolve, reject) => {
    const chunks = [];
    doc.on("data",  chunk => chunks.push(chunk));
    doc.on("end",   ()    => resolve(Buffer.concat(chunks)));
    doc.on("error", err   => reject(err));
  });

// ─── Shared drawing helpers ───────────────────────────────────────────────────

const drawHeader = (doc, title, subtitle) => {
  // Green band
  doc.rect(0, 0, A4[0], 100).fill(DARK_GREEN);

  // Society name
  doc.fontSize(9)
     .fillColor(MID_GREEN)
     .font("Helvetica-Bold")
     .text(SOCIETY.toUpperCase(), MARGIN, 22, { width: COL_WIDTH, align: "center" });

  // Document title
  doc.fontSize(20)
     .fillColor(WHITE)
     .text(title, MARGIN, 38, { width: COL_WIDTH, align: "center" });

  if (subtitle) {
    doc.fontSize(9)
       .fillColor([200, 240, 230])
       .font("Helvetica")
       .text(subtitle, MARGIN, 66, { width: COL_WIDTH, align: "center" });
  }

  doc.y = 120;
};

const drawFooter = (doc) => {
  const y     = A4[1] - 40;
  const range = doc.bufferedPageRange();
  const total = range.count;

  for (let i = 0; i < total; i++) {
    doc.switchToPage(range.start + i);

    doc.rect(0, A4[1] - 36, A4[0], 36).fill(LIGHT_GRAY);

    doc.fontSize(8)
       .fillColor(MID_GRAY)
       .font("Helvetica")
       .text(
         `© ${new Date().getFullYear()} ${SOCIETY}  |  ` +
         `Generated: ${new Date().toLocaleString("en-GB")}  |  ` +
         `Page ${i + 1} of ${total}`,
         MARGIN,
         A4[1] - 24,
         { width: COL_WIDTH, align: "center" }
       );
  }
};

const drawSectionTitle = (doc, title) => {
  doc.moveDown(0.5);
  const y = doc.y;
  doc.rect(MARGIN, y, COL_WIDTH, 22).fill(LIGHT_GREEN);
  doc.fontSize(10)
     .font("Helvetica-Bold")
     .fillColor(DARK_GREEN)
     .text(title.toUpperCase(), MARGIN + 8, y + 6, { width: COL_WIDTH - 16 });
  doc.y = y + 30;
};

const drawInfoRow = (doc, label, value, y) => {
  doc.fontSize(9)
     .font("Helvetica-Bold")
     .fillColor(MID_GRAY)
     .text(label, MARGIN, y);
  doc.fontSize(10)
     .font("Helvetica")
     .fillColor(DARK_GRAY)
     .text(String(value ?? "—"), MARGIN + 120, y);
  doc.y = y + 16;
};

/**
 * drawTable
 * Draws a lined table with alternating row shading.
 *
 * @param {PDFDocument} doc
 * @param {Array}       columns — [{ label, width, align }]
 * @param {Array}       rows    — [{ cells: [string], bold: bool, shade: bool }]
 */
const drawTable = (doc, columns, rows) => {
  const tableX      = MARGIN;
  const rowHeight   = 22;
  const headerHeight = 26;

  // Compute column x positions
  let colX = tableX;
  const colPositions = columns.map(col => {
    const x = colX;
    colX += col.width;
    return x;
  });

  const tableWidth = colX - tableX;

  // Header
  doc.rect(tableX, doc.y, tableWidth, headerHeight).fill(DARK_GREEN);
  const headerY = doc.y + 8;
  columns.forEach((col, i) => {
    doc.fontSize(8)
       .font("Helvetica-Bold")
       .fillColor(WHITE)
       .text(
         col.label.toUpperCase(),
         colPositions[i] + 4,
         headerY,
         { width: col.width - 8, align: col.align || "left" }
       );
  });
  doc.y = doc.y + headerHeight;

  // Rows
  rows.forEach((row, rowIndex) => {
    // Page break check — leave room for footer
    if (doc.y + rowHeight > A4[1] - 60) {
      doc.addPage();
      doc.y = MARGIN;
    }

    const rowY = doc.y;
    const bg   = row.shade
      ? LIGHT_GREEN
      : rowIndex % 2 === 0 ? WHITE : [249, 250, 251];

    doc.rect(tableX, rowY, tableWidth, rowHeight).fill(bg);

    // Cell borders
    doc.rect(tableX, rowY, tableWidth, rowHeight)
       .stroke([220, 220, 220]);

    row.cells.forEach((cell, i) => {
      doc.fontSize(9)
         .font(row.bold ? "Helvetica-Bold" : "Helvetica")
         .fillColor(row.shade ? DARK_GREEN : DARK_GRAY)
         .text(
           String(cell ?? "—"),
           colPositions[i] + 4,
           rowY + 6,
           { width: columns[i].width - 8, align: columns[i].align || "left" }
         );
    });

    doc.y = rowY + rowHeight;
  });
};

// ─── drawReceipt ──────────────────────────────────────────────────────────────
// Single-payment formal receipt.
// Called when member downloads receipt for one transaction.

export const drawReceipt = async ({ payment, member, lineItems }) => {
  const doc = new PDFDocument({
    size:           A4,
    margins:        { top: 0, bottom: 40, left: MARGIN, right: MARGIN },
    bufferPages:    true,  // needed for footer page numbering
    autoFirstPage:  true,
  });

  const bufferPromise = pdfToBuffer(doc);

  // Header
  drawHeader(doc, "Official Receipt", `Receipt No: ${payment.receiptNumber}`);

  // ── Member & payment info ─────────────────────────────────────────────────
  drawSectionTitle(doc, "Member Information");

  const infoY = doc.y;
  drawInfoRow(doc, "Name:",          member.name,         infoY);
  drawInfoRow(doc, "Membership No:", member.membershipNo, infoY + 16);
  drawInfoRow(doc, "Plot No:",       member.plotNo,       infoY + 32);
  drawInfoRow(doc, "Email:",         member.email,        infoY + 48);
  doc.y = infoY + 70;

  drawSectionTitle(doc, "Payment Details");

  const payY = doc.y;
  drawInfoRow(doc, "Receipt Number:",   payment.receiptNumber,        payY);
  drawInfoRow(doc, "Transaction ID:",   payment.transactionId,        payY + 16);
  drawInfoRow(doc, "Payment Date:",     fmtDate(payment.paidAt),      payY + 32);
  drawInfoRow(doc, "Payment Method:",   payment.gateway || "Online",  payY + 48);
  doc.y = payY + 70;

  // ── Line items ────────────────────────────────────────────────────────────
  drawSectionTitle(doc, "Payment Breakdown");

  const columns = [
    { label: "Description",    width: 340, align: "left"  },
    { label: "Amount (BDT)",   width: 155, align: "right" },
  ];

  const rows = lineItems.map(item => ({
    cells: [
      item.type === "monthly"
        ? item.description
        : `${item.description}${item.purpose ? ` — ${item.purpose}` : ""}`,
      fmt(item.amount),
    ],
  }));

  // Total row
  rows.push({
    cells: ["Total Paid", fmt(payment.amount)],
    bold:  true,
    shade: true,
  });

  drawTable(doc, columns, rows);

  // ── Amount in words box ───────────────────────────────────────────────────
  doc.moveDown(1.5);
  doc.rect(MARGIN, doc.y, COL_WIDTH, 36).fill(LIGHT_GREEN);
  doc.fontSize(9)
     .font("Helvetica-Bold")
     .fillColor(DARK_GREEN)
     .text(
       `Amount: ${fmt(payment.amount)} — paid in full`,
       MARGIN + 10,
       doc.y + 12,
       { width: COL_WIDTH - 20 }
     );
  doc.y += 50;

  // ── Signature block ───────────────────────────────────────────────────────
  doc.moveDown(2);
  const sigY = doc.y;

  doc.moveTo(MARGIN, sigY + 30).lineTo(MARGIN + 160, sigY + 30).stroke(MID_GRAY);
  doc.fontSize(9).fillColor(MID_GRAY).font("Helvetica")
     .text("Authorised Signature", MARGIN, sigY + 34);

  doc.moveTo(A4[0] - MARGIN - 160, sigY + 30)
     .lineTo(A4[0] - MARGIN, sigY + 30)
     .stroke(MID_GRAY);
  doc.text("Member Signature", A4[0] - MARGIN - 160, sigY + 34);

  // ── Stamp / validation note ───────────────────────────────────────────────
  doc.moveDown(3);
  doc.fontSize(8)
     .fillColor(MID_GRAY)
     .text(
       "This is a computer-generated receipt and is valid without a physical signature.",
       MARGIN,
       doc.y,
       { width: COL_WIDTH, align: "center" }
     );

  drawFooter(doc);
  doc.end();

  return bufferPromise;
};

// ─── drawMemberReport ─────────────────────────────────────────────────────────
// Member transaction history report for a date range.

export const drawMemberReport = async ({
  member,
  payments,
  summary,
  currentDueBreakdown,
}) => {
  const doc = new PDFDocument({
    size:          A4,
    margins:       { top: 0, bottom: 40, left: MARGIN, right: MARGIN },
    bufferPages:   true,
    autoFirstPage: true,
  });

  const bufferPromise = pdfToBuffer(doc);

  const periodLabel =
    `${fmtDate(summary.periodStart)} — ${fmtDate(summary.periodEnd)}`;

  drawHeader(doc, "Payment History Report", periodLabel);

  // ── Member info ───────────────────────────────────────────────────────────
  drawSectionTitle(doc, "Member Information");
  const infoY = doc.y;
  drawInfoRow(doc, "Name:",          member.name,         infoY);
  drawInfoRow(doc, "Membership No:", member.membershipNo, infoY + 16);
  drawInfoRow(doc, "Plot No:",       member.plotNo,       infoY + 32);
  drawInfoRow(doc, "Email:",         member.email,        infoY + 48);
  doc.y = infoY + 70;

  // ── Period summary boxes ──────────────────────────────────────────────────
  drawSectionTitle(doc, "Period Summary");

  const boxes = [
    { label: "Total Paid",     value: fmt(summary.totalPaid),    color: DARK_GREEN },
    { label: "Monthly Dues",   value: fmt(summary.totalMonthly), color: [7, 89, 133] },
    { label: "Extra Charges",  value: fmt(summary.totalExtra),   color: [92, 61, 0]  },
    { label: "Transactions",   value: summary.paymentCount,      color: MID_GRAY      },
  ];

  const boxW = (COL_WIDTH - 15) / 4;
  const boxY = doc.y;

  boxes.forEach((box, i) => {
    const bx = MARGIN + i * (boxW + 5);
    doc.rect(bx, boxY, boxW, 50).fill(box.color);
    doc.fontSize(8)
       .font("Helvetica")
       .fillColor([200, 230, 220])
       .text(box.label, bx + 6, boxY + 8, { width: boxW - 12 });
    doc.fontSize(14)
       .font("Helvetica-Bold")
       .fillColor(WHITE)
       .text(String(box.value), bx + 6, boxY + 22, { width: boxW - 12 });
  });

  doc.y = boxY + 66;

  // ── Current outstanding ───────────────────────────────────────────────────
  if (currentDueBreakdown.totalDue > 0) {
    doc.moveDown(0.5);
    doc.rect(MARGIN, doc.y, COL_WIDTH, 28).fill([254, 226, 226]);
    doc.fontSize(10)
       .font("Helvetica-Bold")
       .fillColor(RED)
       .text(
         `Current Outstanding (at export date): ${fmt(currentDueBreakdown.totalDue)}`,
         MARGIN + 10, doc.y + 8,
         { width: COL_WIDTH - 20 }
       );
    doc.y += 42;
  } else {
    doc.moveDown(0.5);
    doc.rect(MARGIN, doc.y, COL_WIDTH, 28).fill(LIGHT_GREEN);
    doc.fontSize(10)
       .font("Helvetica-Bold")
       .fillColor(DARK_GREEN)
       .text(
         "Account fully paid — no outstanding dues",
         MARGIN + 10, doc.y + 8,
         { width: COL_WIDTH - 20 }
       );
    doc.y += 42;
  }

  // ── Transactions table ────────────────────────────────────────────────────
  drawSectionTitle(doc, "Transaction Detail");

  if (payments.length === 0) {
    doc.fontSize(11)
       .fillColor(MID_GRAY)
       .font("Helvetica")
       .text("No completed payments in this period.", MARGIN, doc.y, {
         width: COL_WIDTH, align: "center",
       });
    doc.y += 30;
  } else {
    const columns = [
      { label: "Date",           width: 90,  align: "left"  },
      { label: "Receipt No",     width: 110, align: "left"  },
      { label: "Description",    width: 195, align: "left"  },
      { label: "Amount (BDT)",   width: 100, align: "right" },
    ];

    const rows = [];
    for (const payment of payments) {
      if (payment.breakdown.length === 0) {
        rows.push({
          cells: [
            fmtDate(payment.paidAt).slice(0, 11),
            payment.receiptNumber || "—",
            "Payment",
            fmt(payment.amount),
          ],
        });
      } else {
        payment.breakdown.forEach((item, idx) => {
          rows.push({
            cells: [
              idx === 0 ? fmtDate(payment.paidAt).slice(0, 11) : "",
              idx === 0 ? (payment.receiptNumber || "—") : "",
              item.description,
              fmt(item.amount),
            ],
          });
        });
        // Sub-total row if multiple line items
        if (payment.breakdown.length > 1) {
          rows.push({
            cells: ["", "", "Payment Total", fmt(payment.amount)],
            bold:  true,
            shade: true,
          });
        }
      }
    }

    // Grand total
    rows.push({
      cells:  ["", "", `Period Total (${payments.length} payments)`, fmt(summary.totalPaid)],
      bold:   true,
      shade:  true,
    });

    drawTable(doc, columns, rows);
  }

  drawFooter(doc);
  doc.end();

  return bufferPromise;
};

// ─── drawAdminReport ──────────────────────────────────────────────────────────
// Society-wide collection report.

export const drawAdminReport = async ({
  memberRows,
  summary,
}) => {
  const doc = new PDFDocument({
    size:          A4,
    margins:       { top: 0, bottom: 40, left: MARGIN, right: MARGIN },
    bufferPages:   true,
    autoFirstPage: true,
  });

  const bufferPromise = pdfToBuffer(doc);

  const periodLabel =
    `${fmtDate(summary.periodStart)} — ${fmtDate(summary.periodEnd)}`;

  drawHeader(doc, "Collection Report", periodLabel);

  // ── Summary boxes ─────────────────────────────────────────────────────────
  drawSectionTitle(doc, "Period Summary");

  const boxes = [
    { label: "Total Collection",  value: fmt(summary.totalCollection), color: DARK_GREEN },
    { label: "Total Payments",    value: summary.totalPayments,         color: [7, 89, 133] },
    { label: "Members Collected", value: summary.membersWhoPayd,        color: [92, 61, 0]  },
  ];

  const boxW = (COL_WIDTH - 10) / 3;
  const boxY = doc.y;

  boxes.forEach((box, i) => {
    const bx = MARGIN + i * (boxW + 5);
    doc.rect(bx, boxY, boxW, 56).fill(box.color);
    doc.fontSize(8).font("Helvetica").fillColor([200, 230, 220])
       .text(box.label, bx + 8, boxY + 10, { width: boxW - 16 });
    doc.fontSize(16).font("Helvetica-Bold").fillColor(WHITE)
       .text(String(box.value), bx + 8, boxY + 26, { width: boxW - 16 });
  });

  doc.y = boxY + 72;

  // ── Per-member summary table ──────────────────────────────────────────────
  drawSectionTitle(doc, "Collection by Member");

  const columns = [
    { label: "#",              width: 28,  align: "center" },
    { label: "Member Name",    width: 160, align: "left"   },
    { label: "Membership No",  width: 90,  align: "left"   },
    { label: "Payments",       width: 60,  align: "center" },
    { label: "Amount (BDT)",   width: 157, align: "right"  },
  ];

  const rows = memberRows.map((row, idx) => ({
    cells: [
      String(idx + 1),
      row.member?.name        || "—",
      row.member?.membershipNo || "—",
      String(row.paymentCount),
      fmt(row.totalPaid),
    ],
  }));

  // Grand total
  rows.push({
    cells: [
      "",
      `Total (${memberRows.length} members)`,
      "",
      String(summary.totalPayments),
      fmt(summary.totalCollection),
    ],
    bold:  true,
    shade: true,
  });

  drawTable(doc, columns, rows);

  drawFooter(doc);
  doc.end();

  return bufferPromise;
};