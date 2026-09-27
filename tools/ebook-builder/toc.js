const { PassThrough } = require("stream");

function printedPage(doc) {
  return Math.max(1, doc.bufferedPageRange().count - 1);
}

function estimateTocPages(entries) {
  const usable = 648 - 58 - 62 - 78;
  let used = 0;
  let pages = 1;
  for (const entry of entries) {
    const h = entry.level ? 16 : 21;
    if (used + h > usable) {
      pages += 1;
      used = 0;
    }
    used += h;
  }
  if (used > usable * 0.8) {
    pages += 1;
  }
  return Math.max(1, pages);
}

function reserveTocPages(doc, addInteriorPage, drawHeader) {
  const firstIndex = doc.bufferedPageRange().count;
  const slots = doc._tocSlots || 0;
  for (let i = 0; i < slots; i += 1) {
    addInteriorPage(doc);
    if (drawHeader) {
      drawHeader(doc, "Contents");
    }
  }
  return firstIndex;
}

function writeTocLine(doc, entry, colors) {
  const { INK, TEAL, MUTED, WIDTH } = colors;
  const inset = entry.level ? 16 : 0;
  const pageW = 26;
  const left = 52 + inset;
  const titleW = WIDTH - 104 - pageW - 10 - inset;
  const y = doc.y;
  if (entry.level) {
    doc.font("Book").fontSize(9.5).fillColor(INK);
  } else {
    doc.font("Book-Bold").fontSize(11).fillColor(TEAL);
  }
  doc.text(entry.title, left, y, { width: titleW, height: 13, ellipsis: true, lineBreak: false });
  doc.font("Book").fontSize(9.5).fillColor(MUTED);
  doc.text(String(entry.page), WIDTH - 52 - pageW, y, { width: pageW, align: "right" });
  doc.y = y + (entry.level ? 16 : 21);
  doc.x = 52;
}

function fillTocPages(doc, entries, firstIndex, slots, drawHeader, colors) {
  if (!slots) {
    return entries.length === 0;
  }
  let slot = 0;
  let written = 0;
  const openSlot = () => {
    doc.switchToPage(firstIndex + slot);
    if (drawHeader) {
      drawHeader(doc, "Contents");
    }
    doc.y = 58;
    if (slot === 0) {
      doc.font("Display-Bold").fontSize(18).fillColor(colors.TEAL).text("Contents");
      doc.moveDown(0.55);
    }
  };
  openSlot();
  for (const entry of entries) {
    const need = entry.level ? 16 : 21;
    if (doc.y + need > 648 - 62) {
      slot += 1;
      if (slot >= slots) {
        break;
      }
      openSlot();
    }
    writeTocLine(doc, entry, colors);
    written += 1;
  }
  return written === entries.length;
}

function createTocState(doc) {
  const entries = [];
  return {
    entries,
    mark(title, level = 0) {
      const page = printedPage(doc);
      entries.push({ title, level, page });
      try {
        doc.outline.addItem(title);
      } catch {
        // outline is unavailable on some pages
      }
    },
  };
}

function discardStream() {
  const stream = new PassThrough();
  stream.on("data", () => {});
  return stream;
}

module.exports = {
  printedPage,
  estimateTocPages,
  reserveTocPages,
  fillTocPages,
  createTocState,
  discardStream,
};
