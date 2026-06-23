// server/services/pdfService.js
//
// FIXES:
//   1. fmt() now uses "BDT " prefix instead of "৳" — Helvetica (built-in
//      PDFKit font) does not support Bengali Unicode. "৳" rendered as
//      garbage bytes. "BDT" is the ISO 4217 code and is correct for
//      English-language formal financial documents.
//   2. Color palette unified — single navy/slate primary with neutral
//      supporting tones. No more mismatched blue/brown/olive/gray boxes.
//   3. Summary boxes now use a consistent tonal scale instead of
//      unrelated hues per box.
//   4. Header simplified — white title on dark navy, subtitle legible.
//   5. Section titles cleaner — thin left accent bar instead of filled band.
//   6. All functional logic, data shapes, and exports unchanged.

import PDFDocument from "pdfkit";

const SOCIETY  = "Government Officer's Housing Society";
const A4       = [595.28, 841.89];
const MARGIN   = 50;
const COL_WIDTH = A4[0] - MARGIN * 2;

// ── Unified color palette ─────────────────────────────────────────────────────
// One primary hue (deep navy) with functional accent colors.
// All values are [R, G, B] 0-255.

const NAVY        = [15,  23,  42];   // primary — header, table headers
const NAVY_MED    = [30,  41,  59];   // slightly lighter navy
const SLATE       = [71,  85, 105];   // secondary text, borders
const SLATE_LIGHT = [148, 163, 184];  // muted labels
const BLUE_SOFT   = [219, 234, 254];  // summary box bg tint
const BLUE_MED    = [59,  130, 246];  // accent line, highlights
const GREEN_SOFT  = [220, 252, 231];  // positive status bg
const GREEN_DARK  = [22,  101,  52];  // positive status text
const RED_SOFT    = [254, 226, 226];  // warning bg
const RED_DARK    = [185,  28,  28];  // warning text
const GRAY_BG     = [248, 250, 252];  // alternating row bg
const GRAY_LINE   = [226, 232, 240];  // table borders, dividers
const WHITE       = [255, 255, 255];
const DARK_TEXT   = [15,  23,  42];   // body text

// ── Formatters ────────────────────────────────────────────────────────────────
// BDT prefix — Helvetica has no Bengali glyph for ৳.
// "BDT 1,300" is the ISO 4217 standard format used in formal documents.

const fmt = (n) => `BDT ${Number(n).toLocaleString("en-US")}`;

const fmtDate = (d) =>
  new Date(d).toLocaleDateString("en-GB", {
    day: "numeric", month: "long", year: "numeric",
  });

// ─── pdfToBuffer ──────────────────────────────────────────────────────────────

const pdfToBuffer = (doc) =>
  new Promise((resolve, reject) => {
    const chunks = [];
    doc.on("data",  chunk => chunks.push(chunk));
    doc.on("end",   ()    => resolve(Buffer.concat(chunks)));
    doc.on("error", err   => reject(err));
  });

// ─── drawHeader ───────────────────────────────────────────────────────────────

const drawHeader = (doc, title, subtitle) => {
  // Deep navy band
  doc.rect(0, 0, A4[0], 96).fill(NAVY);

  // Thin accent line at bottom of header
  doc.rect(0, 93, A4[0], 3).fill(BLUE_MED);

  // Society name — slate-light, small caps feel
  doc.fontSize(8)
     .fillColor(SLATE_LIGHT)
     .font("Helvetica")
     .text(SOCIETY.toUpperCase(), MARGIN, 20, {
       width: COL_WIDTH, align: "center", characterSpacing: 1.2,
     });

  // Document title — white, prominent
  doc.fontSize(22)
     .fillColor(WHITE)
     .font("Helvetica-Bold")
     .text(title, MARGIN, 34, { width: COL_WIDTH, align: "center" });

  if (subtitle) {
    doc.fontSize(9)
       .fillColor(SLATE_LIGHT)
       .font("Helvetica")
       .text(subtitle, MARGIN, 64, { width: COL_WIDTH, align: "center" });
  }

  doc.y = 116;
};

// ─── drawFooter ───────────────────────────────────────────────────────────────

const drawFooter = (doc) => {
  const range = doc.bufferedPageRange();
  const total = range.count;

  for (let i = 0; i < total; i++) {
    doc.switchToPage(range.start + i);

    // Footer bar
    doc.rect(0, A4[1] - 34, A4[0], 34).fill(GRAY_BG);

    // Top border line
    doc.rect(0, A4[1] - 35, A4[0], 1).fill(GRAY_LINE);

    doc.fontSize(8)
       .fillColor(SLATE_LIGHT)
       .font("Helvetica")
       .text(
         `${SOCIETY}  ·  Generated: ${new Date().toLocaleString("en-GB")}  ·  Page ${i + 1} of ${total}`,
         MARGIN,
         A4[1] - 22,
         { width: COL_WIDTH, align: "center" }
       );
  }
};

// ─── drawSectionTitle ─────────────────────────────────────────────────────────
// Left accent bar + bold label — clean, no filled band.

const drawSectionTitle = (doc, title) => {
  doc.moveDown(0.8);
  const y = doc.y;

  // Left accent bar
  doc.rect(MARGIN, y, 3, 14).fill(BLUE_MED);

  // Title text
  doc.fontSize(9)
     .font("Helvetica-Bold")
     .fillColor(NAVY)
     .text(title.toUpperCase(), MARGIN + 10, y + 2, {
       width: COL_WIDTH - 10, characterSpacing: 0.8,
     });

  // Underline
  doc.rect(MARGIN, y + 16, COL_WIDTH, 0.5).fill(GRAY_LINE);

  doc.y = y + 24;
};

// ─── drawInfoRow ──────────────────────────────────────────────────────────────

const drawInfoRow = (doc, label, value, y) => {
  doc.fontSize(8)
     .font("Helvetica-Bold")
     .fillColor(SLATE_LIGHT)
     .text(label, MARGIN, y, { width: 110 });

  doc.fontSize(9)
     .font("Helvetica")
     .fillColor(DARK_TEXT)
     .text(String(value ?? "—"), MARGIN + 115, y, { width: COL_WIDTH - 115 });

  doc.y = y + 16;
};

// ─── drawTable ────────────────────────────────────────────────────────────────

const drawTable = (doc, columns, rows) => {
  const tableX       = MARGIN;
  const rowHeight    = 22;
  const headerHeight = 26;

  let colX = tableX;
  const colPositions = columns.map(col => {
    const x = colX;
    colX += col.width;
    return x;
  });
  const tableWidth = colX - tableX;

  // Header
  doc.rect(tableX, doc.y, tableWidth, headerHeight).fill(NAVY_MED);

  const headerY = doc.y + 8;
  columns.forEach((col, i) => {
    doc.fontSize(8)
       .font("Helvetica-Bold")
       .fillColor(SLATE_LIGHT)
       .text(
         col.label.toUpperCase(),
         colPositions[i] + 6,
         headerY,
         { width: col.width - 12, align: col.align || "left", characterSpacing: 0.5 }
       );
  });
  doc.y = doc.y + headerHeight;

  // Rows
  rows.forEach((row, rowIndex) => {
    if (doc.y + rowHeight > A4[1] - 60) {
      doc.addPage();
      doc.y = MARGIN;
    }

    const rowY = doc.y;

    // Background
    const bg = row.shade
      ? BLUE_SOFT
      : rowIndex % 2 === 0 ? WHITE : GRAY_BG;

    doc.rect(tableX, rowY, tableWidth, rowHeight).fill(bg);

    // Bottom border only — cleaner than full rect border
    doc.rect(tableX, rowY + rowHeight - 0.5, tableWidth, 0.5)
       .fill(GRAY_LINE);

    row.cells.forEach((cell, i) => {
      doc.fontSize(9)
         .font(row.bold ? "Helvetica-Bold" : "Helvetica")
         .fillColor(row.shade ? NAVY : DARK_TEXT)
         .text(
           String(cell ?? "—"),
           colPositions[i] + 6,
           rowY + 6,
           { width: columns[i].width - 12, align: columns[i].align || "left" }
         );
    });

    doc.y = rowY + rowHeight;
  });
};

// ─── drawSummaryBoxes ─────────────────────────────────────────────────────────
// Unified tonal boxes — all same hue family, varied by lightness.

const drawSummaryBoxes = (doc, boxes) => {
  const count = boxes.length;
  const gap   = 6;
  const boxW  = (COL_WIDTH - gap * (count - 1)) / count;
  const boxY  = doc.y;
  const boxH  = 54;

  boxes.forEach((box, i) => {
    const bx = MARGIN + i * (boxW + gap);

    // Box background
    doc.rect(bx, boxY, boxW, boxH).fill(NAVY_MED);

    // Top accent line per box — color varies by semantic meaning
    doc.rect(bx, boxY, boxW, 3).fill(box.accent || BLUE_MED);

    // Label
    doc.fontSize(7.5)
       .font("Helvetica")
       .fillColor(SLATE_LIGHT)
       .text(box.label.toUpperCase(), bx + 8, boxY + 10, {
         width: boxW - 16, characterSpacing: 0.4,
       });

    // Value
    doc.fontSize(15)
       .font("Helvetica-Bold")
       .fillColor(WHITE)
       .text(String(box.value), bx + 8, boxY + 24, { width: boxW - 16 });
  });

  doc.y = boxY + boxH + 14;
};

// ─── drawReceipt ──────────────────────────────────────────────────────────────

export const drawReceipt = async ({ payment, member, lineItems }) => {
  const doc = new PDFDocument({
    size:          A4,
    margins:       { top: 0, bottom: 40, left: MARGIN, right: MARGIN },
    bufferPages:   true,
    autoFirstPage: true,
  });

  const bufferPromise = pdfToBuffer(doc);

  drawHeader(doc, "Official Receipt", `Receipt No: ${payment.receiptNumber}`);

  // Member info
  drawSectionTitle(doc, "Member Information");
  const infoY = doc.y;
  drawInfoRow(doc, "Name:",          member.name,         infoY);
  drawInfoRow(doc, "Membership No:", member.membershipNo, infoY + 16);
  drawInfoRow(doc, "Plot No:",       member.plotNo,       infoY + 32);
  drawInfoRow(doc, "Email:",         member.email,        infoY + 48);
  doc.y = infoY + 68;

  // Payment details
  drawSectionTitle(doc, "Payment Details");
  const payY = doc.y;
  drawInfoRow(doc, "Receipt Number:",  payment.receiptNumber,       payY);
  drawInfoRow(doc, "Transaction ID:",  payment.transactionId,       payY + 16);
  drawInfoRow(doc, "Payment Date:",    fmtDate(payment.paidAt),     payY + 32);
  drawInfoRow(doc, "Payment Method:",  payment.gateway || "Online", payY + 48);
  doc.y = payY + 68;

  // Line items
  drawSectionTitle(doc, "Payment Breakdown");

  const columns = [
    { label: "Description",  width: 340, align: "left"  },
    { label: "Amount (BDT)", width: 155, align: "right" },
  ];

  const rows = lineItems.map(item => ({
    cells: [
      item.type === "monthly"
        ? item.description
        : `${item.description}${item.purpose ? ` — ${item.purpose}` : ""}`,
      fmt(item.amount),
    ],
  }));

  rows.push({
    cells: ["Total Paid", fmt(payment.amount)],
    bold:  true,
    shade: true,
  });

  drawTable(doc, columns, rows);

  // Amount confirmation box
  doc.moveDown(1.2);
  doc.rect(MARGIN, doc.y, COL_WIDTH, 34).fill(BLUE_SOFT);
  doc.rect(MARGIN, doc.y, 3, 34).fill(BLUE_MED);
  doc.fontSize(9)
     .font("Helvetica-Bold")
     .fillColor(NAVY)
     .text(
       `Amount Paid: ${fmt(payment.amount)} — Payment confirmed`,
       MARGIN + 12, doc.y + 12,
       { width: COL_WIDTH - 20 }
     );
  doc.y += 48;

  // Signature block
  doc.moveDown(2);
  const sigY = doc.y;

  doc.moveTo(MARGIN, sigY + 28).lineTo(MARGIN + 150, sigY + 28).stroke(GRAY_LINE);
  doc.fontSize(8).fillColor(SLATE_LIGHT).font("Helvetica")
     .text("Authorised Signature", MARGIN, sigY + 33);

  doc.moveTo(A4[0] - MARGIN - 150, sigY + 28)
     .lineTo(A4[0] - MARGIN, sigY + 28)
     .stroke(GRAY_LINE);
  doc.text("Member Signature", A4[0] - MARGIN - 150, sigY + 33);

  // Validation note
  doc.moveDown(3);
  doc.fontSize(8)
     .fillColor(SLATE_LIGHT)
     .text(
       "This is a computer-generated receipt and is valid without a physical signature.",
       MARGIN, doc.y, { width: COL_WIDTH, align: "center" }
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
  const doc = new PDFDocument({
    size:          A4,
    margins:       { top: 0, bottom: 40, left: MARGIN, right: MARGIN },
    bufferPages:   true,
    autoFirstPage: true,
  });

  const bufferPromise = pdfToBuffer(doc);

  const periodLabel = `${fmtDate(summary.periodStart)} — ${fmtDate(summary.periodEnd)}`;
  drawHeader(doc, "Payment History Report", periodLabel);

  // Member info
  drawSectionTitle(doc, "Member Information");
  const infoY = doc.y;
  drawInfoRow(doc, "Name:",          member.name,         infoY);
  drawInfoRow(doc, "Membership No:", member.membershipNo, infoY + 16);
  drawInfoRow(doc, "Plot No:",       member.plotNo,       infoY + 32);
  drawInfoRow(doc, "Email:",         member.email,        infoY + 48);
  doc.y = infoY + 68;

  // Period summary
  drawSectionTitle(doc, "Period Summary");
  drawSummaryBoxes(doc, [
    { label: "Total Paid",    value: fmt(summary.totalPaid),    accent: [34, 197, 94]  },
    { label: "Monthly Dues",  value: fmt(summary.totalMonthly), accent: BLUE_MED       },
    { label: "Extra Charges", value: fmt(summary.totalExtra),   accent: [249, 115, 22] },
    { label: "Transactions",  value: summary.paymentCount,      accent: SLATE          },
  ]);

  // Outstanding status banner
  doc.moveDown(0.3);
  if (currentDueBreakdown.totalDue > 0) {
    doc.rect(MARGIN, doc.y, COL_WIDTH, 30).fill(RED_SOFT);
    doc.rect(MARGIN, doc.y, 3, 30).fill(RED_DARK);
    doc.fontSize(9)
       .font("Helvetica-Bold")
       .fillColor(RED_DARK)
       .text(
         `Outstanding at export date: ${fmt(currentDueBreakdown.totalDue)}`,
         MARGIN + 12, doc.y + 10,
         { width: COL_WIDTH - 20 }
       );
    doc.y += 44;
  } else {
    doc.rect(MARGIN, doc.y, COL_WIDTH, 30).fill(GREEN_SOFT);
    doc.rect(MARGIN, doc.y, 3, 30).fill(GREEN_DARK);
    doc.fontSize(9)
       .font("Helvetica-Bold")
       .fillColor(GREEN_DARK)
       .text(
         "Account fully paid — no outstanding dues",
         MARGIN + 12, doc.y + 10,
         { width: COL_WIDTH - 20 }
       );
    doc.y += 44;
  }

  // Transaction table
  drawSectionTitle(doc, "Transaction Detail");

  if (payments.length === 0) {
    doc.fontSize(10)
       .fillColor(SLATE_LIGHT)
       .font("Helvetica")
       .text("No completed payments in this period.", MARGIN, doc.y, {
         width: COL_WIDTH, align: "center",
       });
    doc.y += 30;
  } else {
    const columns = [
      { label: "Date",         width: 90,  align: "left"  },
      { label: "Receipt No",   width: 110, align: "left"  },
      { label: "Description",  width: 195, align: "left"  },
      { label: "Amount (BDT)", width: 100, align: "right" },
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
        if (payment.breakdown.length > 1) {
          rows.push({
            cells: ["", "", "Payment Total", fmt(payment.amount)],
            bold:  true,
            shade: true,
          });
        }
      }
    }

    rows.push({
      cells: ["", "", `Period Total (${payments.length} payments)`, fmt(summary.totalPaid)],
      bold:  true,
      shade: true,
    });

    drawTable(doc, columns, rows);
  }

  drawFooter(doc);
  doc.end();

  return bufferPromise;
};

// ─── drawAdminReport ──────────────────────────────────────────────────────────

export const drawAdminReport = async ({ memberRows, summary }) => {
  const doc = new PDFDocument({
    size:          A4,
    margins:       { top: 0, bottom: 40, left: MARGIN, right: MARGIN },
    bufferPages:   true,
    autoFirstPage: true,
  });

  const bufferPromise = pdfToBuffer(doc);

  const periodLabel = `${fmtDate(summary.periodStart)} — ${fmtDate(summary.periodEnd)}`;
  drawHeader(doc, "Collection Report", periodLabel);

  drawSectionTitle(doc, "Period Summary");
  drawSummaryBoxes(doc, [
    { label: "Total Collection",  value: fmt(summary.totalCollection), accent: [34, 197, 94]  },
    { label: "Total Payments",    value: summary.totalPayments,         accent: BLUE_MED       },
    { label: "Members Collected", value: summary.membersWhoPayd,        accent: [249, 115, 22] },
  ]);

  drawSectionTitle(doc, "Collection by Member");

  const columns = [
    { label: "#",             width: 28,  align: "center" },
    { label: "Member Name",   width: 160, align: "left"   },
    { label: "Membership No", width: 90,  align: "left"   },
    { label: "Payments",      width: 60,  align: "center" },
    { label: "Amount (BDT)",  width: 157, align: "right"  },
  ];

  const rows = memberRows.map((row, idx) => ({
    cells: [
      String(idx + 1),
      row.member?.name         || "—",
      row.member?.membershipNo || "—",
      String(row.paymentCount),
      fmt(row.totalPaid),
    ],
  }));

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