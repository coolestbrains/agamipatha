const fs = require("fs");
const path = require("path");
const PDFDocument = require("pdfkit");
const { registerBookFonts } = require("./fonts");
const { AUTHOR, compiled, copyright } = require("./credit");
const { createTocState, estimateTocPages, reserveTocPages, fillTocPages, discardStream } = require("./toc");

const WIDTH = 432;
const HEIGHT = 648;
const INK = "#160e3d";
const TEAL = "#4f2bff";
const PINK = "#ff2d92";
const MUTED = "#5a5480";

const root = path.resolve(__dirname, "..", "..");
const catalogPath = path.join(root, "api", "Seed", "catalog.json");
const coverPath = path.join(root, "api", "Store", "all-career-paths-cover.png");
const artDir = path.join(root, "api", "Store", "art");
const outPath = path.join(root, "api", "Store", "all-career-paths.pdf");

const FIELD_ORDER = [
  "Technology",
  "Engineering",
  "Science",
  "Earth science",
  "Energy",
  "Mining",
  "Agriculture",
  "Environment",
  "Healthcare",
  "Aviation",
  "Maritime",
  "Defence",
  "Public service",
  "Law",
  "Finance",
  "Business",
  "Economics",
  "Education",
  "Social sector",
  "Media",
  "Communications",
  "Design",
  "Fashion",
  "Hospitality",
  "Sports",
  "Performing arts",
];

const FIELD_ART = {
  Technology: "ebook-pcm.png",
  Engineering: "ebook-pcm.png",
  Science: "ebook-pcb.png",
  Healthcare: "ebook-pcb.png",
  Finance: "ebook-commerce.png",
  Business: "ebook-commerce.png",
  Economics: "ebook-commerce.png",
  Law: "ebook-arts.png",
  "Public service": "ebook-arts.png",
  Education: "ebook-arts.png",
  Media: "ebook-arts.png",
  Communications: "ebook-arts.png",
  Design: "ebook-internship.png",
  Fashion: "ebook-internship.png",
  "Performing arts": "ebook-arts.png",
  Defence: "ebook-exams.png",
  Aviation: "ebook-planner.png",
  Sports: "ebook-internship.png",
};

const FIELD_BLURB = {
  Technology: "Code, data, and the product rooms that hire from every good campus.",
  Engineering: "Sites, plants, chips, and machines — the licensed core of building India.",
  Science: "Labs that ask unanswered questions and then publish the attempt.",
  "Earth science": "Rock, water, maps, and the ground under every other profession.",
  Energy: "Reservoirs and fields that still fund a large slice of the economy.",
  Mining: "Ore, safety, and the underground that cities pretend not to need.",
  Agriculture: "Crops, soil, and the officer who stands between a farm and a policy.",
  Environment: "Impact, regulation, and the science of not spoiling the next decade.",
  Healthcare: "Licensed clinical work — the long corridor after PCB.",
  Aviation: "Medicals first, then debt, simulators, and a roster.",
  Maritime: "Ships, tickets, and months away from the city you trained in.",
  Defence: "Service, fitness, and a life that moves when the posting says so.",
  "Public service": "Rules, money, and the public you will meet on their worst week.",
  Law: "Language, stamina, and rooms where waiting is part of the craft.",
  Finance: "Numbers other people will spend. Accuracy is the product.",
  Business: "Customers, teams, and a P&L you cannot outsource forever.",
  Economics: "Trade-offs as a profession, not a Class 12 chapter.",
  Education: "Other people's attention, planned in advance.",
  "Social sector": "Policy at the door of a family that did not choose the week.",
  Media: "Deadlines, clips, and an audience that will not wait.",
  Communications: "Rooms, stages, and the voice that holds them.",
  Design: "Form, user, and a portfolio that must argue without you in the room.",
  Fashion: "Cloth, cost, and the sample room behind the photograph.",
  Hospitality: "Shifts, guests, and operations that do not pause for your exam rank.",
  Sports: "Training plans, injuries, and the job after the playing years.",
  "Performing arts": "Rehearsal, rejection, and a craft you can show in two minutes.",
};

let currentPart = "How to read this book";

function loadCatalog() {
  const catalog = JSON.parse(fs.readFileSync(catalogPath, "utf8"));
  const nodes = catalog.nodes || [];
  const edges = catalog.edges || [];
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const professions = nodes.filter((n) => n.kind === "profession");
  if (!professions.length) {
    throw new Error("No profession nodes in catalog.json");
  }

  const incoming = new Map();
  for (const edge of edges) {
    if (!incoming.has(edge.to)) {
      incoming.set(edge.to, []);
    }
    incoming.get(edge.to).push(edge);
  }

  const fields = [];
  const seen = new Set();
  for (const name of FIELD_ORDER) {
    const list = professions.filter((p) => p.field === name).sort((a, b) => a.title.localeCompare(b.title));
    if (list.length) {
      fields.push({ name, list });
      seen.add(name);
    }
  }
  const leftovers = [...new Set(professions.map((p) => p.field).filter((f) => !seen.has(f)))].sort();
  for (const name of leftovers) {
    fields.push({
      name,
      list: professions.filter((p) => p.field === name).sort((a, b) => a.title.localeCompare(b.title)),
    });
  }

  return { byId, incoming, fields, total: professions.length };
}

function routesFor(career, incoming, byId) {
  const edges = incoming.get(career.id) || [];
  const lines = [];
  const seen = new Set();
  for (const edge of edges) {
    const from = byId.get(edge.from);
    const title = from ? from.title : edge.from;
    const via = (edge.via || "").trim();
    const key = `${title}|${via}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    lines.push(via ? `${title} — ${via}` : title);
    if (lines.length >= 5) {
      break;
    }
  }
  return lines;
}

function createDoc() {
  const doc = new PDFDocument({
    size: [WIDTH, HEIGHT],
    bufferPages: true,
    autoFirstPage: false,
    info: {
      Title: "All Career Paths",
      Author: AUTHOR,
      Subject: "Complete directory of every profession in the AgamiPatha catalogue",
    },
  });
  registerBookFonts(doc);
  return doc;
}

function addInteriorPage(doc) {
  doc.addPage({ size: [WIDTH, HEIGHT], margins: { top: 58, bottom: 62, left: 52, right: 52 } });
}

function drawRunningHeader(doc, part) {
  doc.save();
  doc.fillColor(TEAL).font("Book-Bold").fontSize(8);
  doc.text("ALL CAREER PATHS", 52, 28, { width: WIDTH - 104, align: "left" });
  doc.fillColor(PINK).font("Book-Italic").fontSize(8);
  doc.text(part, 52, 28, { width: WIDTH - 104, align: "right" });
  doc.moveTo(52, 42).lineTo(WIDTH - 52, 42).strokeColor("#ddd4ff").lineWidth(0.8).stroke();
  doc.restore();
}

function bodyFont(doc) {
  doc.font("Book").fontSize(10.5).fillColor(INK).lineGap(2.4);
}

function needSpace(doc, h) {
  if (doc.y + h > HEIGHT - 62) {
    addInteriorPage(doc);
    drawRunningHeader(doc, currentPart);
    doc.y = 58;
  }
}

function heading(doc, text) {
  needSpace(doc, 48);
  doc.moveDown(0.25);
  doc.font("Display-Bold").fontSize(15).fillColor(TEAL).text(text);
  doc.moveDown(0.2);
  bodyFont(doc);
}

function para(doc, text) {
  bodyFont(doc);
  for (const chunk of text.split("\n\n")) {
    needSpace(doc, 32);
    doc.text(chunk.trim(), { align: "justify", paragraphGap: 7 });
    doc.moveDown(0.25);
  }
}

function bullets(doc, items) {
  const markX = 58;
  const textX = 70;
  const width = WIDTH - 52 - textX;
  for (const item of items) {
    needSpace(doc, 24);
    const top = doc.y;
    doc.circle(markX, top + 5.5, 1.55).fill(TEAL);
    bodyFont(doc);
    doc.text(item, textX, top, { width, align: "left" });
    doc.moveDown(0.1);
  }
  doc.x = 52;
}

function labeledLine(doc, label, items) {
  const clean = (items || []).map((s) => String(s).trim()).filter(Boolean);
  if (!clean.length) {
    return;
  }
  needSpace(doc, 22);
  const top = doc.y;
  doc.font("Book-Bold").fontSize(10).fillColor(TEAL).text(`${label}:`, 52, top, { width: 78, continued: false });
  bodyFont(doc);
  doc.text(clean.join("  ·  "), 132, top, { width: WIDTH - 184, align: "left" });
  doc.x = 52;
  doc.moveDown(0.08);
}

function figure(doc, file, caption) {
  const img = path.join(artDir, file);
  if (!fs.existsSync(img)) {
    return;
  }
  const w = WIDTH - 104;
  const h = Math.round((w * 9) / 16);
  needSpace(doc, h + 40);
  const x = 52;
  const y = doc.y + 4;
  doc.save();
  doc.roundedRect(x - 3, y - 3, w + 6, h + 6, 10).fill(TEAL);
  doc.restore();
  doc.image(img, x, y, { width: w, height: h });
  doc.y = y + h + 8;
  if (caption) {
    doc.font("Book-Italic").fontSize(8.5).fillColor(MUTED).text(caption, x, doc.y, { width: w, align: "center" });
    doc.moveDown(0.4);
  }
  bodyFont(doc);
}

function coverPage(doc, total, fieldCount) {
  doc.addPage({ size: [WIDTH, HEIGHT], margins: { top: 0, bottom: 0, left: 0, right: 0 } });
  if (fs.existsSync(coverPath)) {
    doc.image(coverPath, 0, 0, { width: WIDTH, height: HEIGHT });
  } else {
    doc.rect(0, 0, WIDTH, HEIGHT).fill("#2a1466");
  }
  doc.save();
  doc.rect(0, HEIGHT - 176, WIDTH, 176).fill("#160e3d");
  doc.fillColor("#ff2d92").font("Book-Bold").fontSize(9);
  doc.text("AGAMIPATHA  ·  DIGITAL EDITION", 36, HEIGHT - 156, { width: WIDTH - 72 });
  doc.fillColor("#f8f6ff").font("Display-Bold").fontSize(26);
  doc.text("All Career Paths", 36, HEIGHT - 134, { width: WIDTH - 72 });
  doc.fillColor("#14d4e8").font("Book-Italic").fontSize(11);
  doc.text(compiled, 36, HEIGHT - 72, { width: WIDTH - 72 });
  doc.fillColor("#c4b6fb").font("Book").fontSize(9);
  doc.text(`${total} careers  ·  ${fieldCount} fields  ·  Routes, exams, pay`, 36, HEIGHT - 50, { width: WIDTH - 72 });
  doc.restore();
}

function frontMatter(doc, fields, total, toc) {
  addInteriorPage(doc);
  currentPart = "How to read this book";
  if (toc) {
    toc.mark("How to read this book");
  }
  doc.y = 72;
  doc.font("Book-Bold").fontSize(10).fillColor(PINK).text("AGAMIPATHA", { align: "center" });
  doc.moveDown(0.7);
  doc.font("Display-Bold").fontSize(22).fillColor(TEAL).text("All Career Paths", { align: "center" });
  doc.moveDown(0.3);
  doc.font("Book-Bold").fontSize(11).fillColor(TEAL).text(compiled, { align: "center" });
  doc.moveDown(0.15);
  doc.font("Book").fontSize(9).fillColor(MUTED).text(copyright, { align: "center" });
  doc.moveDown(0.35);
  figure(doc, "ebook-directory.png", "Many doors from one school gate — this book names all of them.");
  para(
    doc,
    `This is the complete profession list from the AgamiPatha catalogue: ${total} careers in ${fields.length} fields. It is a directory, not a ranking. The Career Path Planner ebook is the workbook (streams, exams, weekly practice). This book is the shelf — every title the app can route you toward.\n\nEach entry is pulled from the same data the website uses: summary, study, exams, skills, outlook, pay bands, workplaces, sample institutes, and the incoming routes (the degrees and hops that actually reach the job). Pay and fees are Indian street estimates, not offers.`,
  );

  addInteriorPage(doc);
  drawRunningHeader(doc, currentPart);
  if (toc) {
    toc.mark("How to use a directory", 1);
  }
  heading(doc, "How to use a directory");
  para(
    doc,
    "Pick a field you can inhabit, not a title your relatives clap for. Read the incoming routes: if you are in Class 10, those routes tell you which Class 12 stream and which first degree still keep the door open. If you are already in a degree, they tell you whether you are on a real hop or a dead end.\n\nConfirm every exam, licence, and fee from the official bulletin. A sample institute is a landmark, not an admission. Salary bands hide city, campus, and luck. Treat them as a ceiling-and-floor sketch.\n\nIf two careers share a first degree, you do not have to decide the job in Class 12. You have to keep the degree that still feeds both.",
  );
  if (toc) {
    toc.mark("Fields in this edition", 1);
  }
  heading(doc, "Fields in this edition");
  bullets(
    doc,
    fields.map((f) => `${f.name} — ${f.list.length} career${f.list.length === 1 ? "" : "s"}`),
  );
}

function careerBlock(doc, index, career, incoming, byId, toc) {
  needSpace(doc, 96);
  if (toc) {
    toc.mark(`${index}.  ${career.title}`, 1);
  }
  doc.moveDown(0.08);
  doc.font("Display-Bold").fontSize(12.5).fillColor(TEAL).text(`${index}.  ${career.title}`);
  const meta = [career.typicalAge, career.duration].filter(Boolean).join("   ·   ");
  if (meta) {
    doc.font("Book-Italic").fontSize(8.5).fillColor(PINK).text(meta);
  }
  doc.moveDown(0.1);
  if (career.summary) {
    bodyFont(doc);
    needSpace(doc, 28);
    doc.text(career.summary.trim(), { align: "justify", paragraphGap: 4 });
    doc.moveDown(0.12);
  }

  labeledLine(doc, "Routes", routesFor(career, incoming, byId));
  labeledLine(doc, "Study", career.whatYouStudy);
  labeledLine(doc, "Exams", career.exams);
  labeledLine(doc, "Skills", career.skills);
  if (career.outlook) {
    labeledLine(doc, "Next", [career.outlook]);
  }
  if (career.salaryHint) {
    labeledLine(doc, "Pay", [career.salaryHint]);
  }
  labeledLine(doc, "Work", career.workplaces);
  labeledLine(doc, "Campuses", (career.institutes || []).slice(0, 5));
  labeledLine(doc, "Papers", (career.certifications || []).slice(0, 3));
  doc.moveDown(0.22);
  bodyFont(doc);
}

function writeFields(doc, data, toc) {
  let n = 1;
  for (const field of data.fields) {
    currentPart = field.name;
    addInteriorPage(doc);
    if (toc) {
      toc.mark(field.name);
    }
    doc.y = 54;
    figure(doc, FIELD_ART[field.name] || "ebook-professions.png", FIELD_BLURB[field.name] || field.name);
    doc.font("Book-Bold").fontSize(10).fillColor(PINK).text("FIELD", { align: "center" });
    doc.moveDown(0.35);
    doc.font("Display-Bold").fontSize(22).fillColor(TEAL).text(field.name, { align: "center" });
    doc.moveDown(0.45);
    doc.font("Book-Italic").fontSize(11).fillColor(MUTED).text(FIELD_BLURB[field.name] || "", { align: "center" });
    doc.moveDown(0.55);
    doc.font("Book").fontSize(10.5).fillColor(INK).text(field.list.map((c) => c.title).join("  ·  "), {
      align: "center",
    });

    addInteriorPage(doc);
    drawRunningHeader(doc, currentPart);
    doc.y = 58;
    for (const career of field.list) {
      careerBlock(doc, n, career, data.incoming, data.byId, toc);
      n += 1;
    }
  }
  return n - 1;
}

function closer(doc, fields, total, toc) {
  currentPart = "After the last title";
  addInteriorPage(doc);
  if (toc) {
    toc.mark("After the last title");
  }
  drawRunningHeader(doc, currentPart);
  heading(doc, "A short index");
  for (const field of fields) {
    needSpace(doc, 36);
    doc.font("Book-Bold").fontSize(11).fillColor(TEAL).text(field.name);
    doc.moveDown(0.08);
    para(doc, field.list.map((c) => c.title).join(", "));
  }
  heading(doc, "What to do next");
  para(
    doc,
    `You now have ${total} names. Circle three. For each, write the Class 12 stream or current degree that still feeds it, one exam or portfolio gate, and one living person who does the job. If you cannot name the person, the career is still a poster.\n\nThe AgamiPatha site will route you from where you are standing. This file is yours to keep and print after a Store checkout. ${copyright} Confirm dates from the official bulletin. The catalogue will grow; this edition is a snapshot of the app as it shipped.`,
  );
}

function numberPages(doc) {
  const range = doc.bufferedPageRange();
  for (let i = 1; i < range.count; i += 1) {
    doc.switchToPage(i);
    doc.font("Book").fontSize(8).fillColor(MUTED);
    doc.text(String(i), 52, HEIGHT - 36, { width: WIDTH - 104, align: "center" });
  }
}

function buildBook(data, tocSlots, dest) {
  const doc = createDoc();
  const toc = createTocState(doc);
  doc._tocSlots = tocSlots;
  const stream = dest ? fs.createWriteStream(dest) : discardStream();
  doc.pipe(stream);
  coverPage(doc, data.total, data.fields.length);
  const tocIndex = reserveTocPages(doc, addInteriorPage, drawRunningHeader);
  frontMatter(doc, data.fields, data.total, toc);
  const counted = writeFields(doc, data, toc);
  closer(doc, data.fields, data.total, toc);
  const tocFits = fillTocPages(doc, toc.entries, tocIndex, tocSlots, drawRunningHeader, { INK, TEAL, MUTED, WIDTH });
  numberPages(doc);
  const pages = doc.bufferedPageRange().count;
  const entries = toc.entries.slice();
  doc.end();
  return new Promise((resolve, reject) => {
    stream.on("finish", () => resolve({ counted, entries, pages, tocFits }));
    stream.on("error", reject);
  });
}

async function main() {
  if (!fs.existsSync(coverPath)) {
    throw new Error(`Cover missing: ${coverPath}`);
  }
  const data = loadCatalog();
  const probe = await buildBook(data, 0, null);
  let slots = estimateTocPages(probe.entries);
  let result = await buildBook(data, slots, outPath);
  if (!result.tocFits) {
    slots += 1;
    result = await buildBook(data, slots, outPath);
  }
  console.log(`Wrote ${outPath}`);
  console.log(`careers=${result.counted} fields=${data.fields.length} toc=${slots} pages=${result.pages} bytes=${fs.statSync(outPath).size} tocFits=${result.tocFits}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
