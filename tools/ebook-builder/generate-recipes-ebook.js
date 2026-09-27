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
const coverPath = path.join(root, "api", "Store", "99-recipes-for-bachelors-cover.png");
const artDir = path.join(root, "api", "Store", "art");
const outPath = path.join(root, "api", "Store", "99-recipes-for-bachelors.pdf");

const DISH_IMAGES = require("./recipe-images.json");
const { BREAKFAST, LUNCH, SNACKS, DINNER } = require("./recipes-data");

function attachDishImages() {
  const all = [...BREAKFAST, ...LUNCH, ...SNACKS, ...DINNER];
  if (all.length !== DISH_IMAGES.length) {
    throw new Error(`Recipe/image count mismatch: ${all.length} vs ${DISH_IMAGES.length}`);
  }
  all.forEach((recipe, i) => {
    recipe.image = `recipes/${DISH_IMAGES[i][0]}.png`;
  });
}

const SECTIONS = [
  { key: "breakfast", title: "Breakfast", kicker: "PART I", blurb: "Fifteen minutes, one pan, and you still make the 9 a.m. class.", image: "recipe-breakfast.png", extras: ["recipe-eggs.png"], recipes: BREAKFAST },
  { key: "lunch", title: "Lunch", kicker: "PART II", blurb: "Dal, rice, roti, and the art of cooking once for two plates.", image: "recipe-lunch.png", extras: ["recipe-dal.png"], recipes: LUNCH },
  { key: "snacks", title: "Snacks", kicker: "PART III", blurb: "Cheaper than the canteen, faster than a delivery app.", image: "recipe-snacks.png", extras: ["recipe-toast.png"], recipes: SNACKS },
  { key: "dinner", title: "Dinner", kicker: "PART IV", blurb: "Food you can finish after a long day without ordering out.", image: "recipe-dinner.png", extras: ["recipe-dal.png", "recipe-eggs.png"], recipes: DINNER },
];

let currentPart = "Kitchen notes";

function createDoc() {
  const doc = new PDFDocument({
    size: [WIDTH, HEIGHT],
    bufferPages: true,
    autoFirstPage: false,
    info: {
      Title: "99 Cost-Effective Recipes for Bachelors",
      Author: AUTHOR,
      Subject: "99 cheap Indian recipes for breakfast, lunch, snacks and dinner",
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
  doc.text("99 RECIPES FOR BACHELORS", 52, 28, { width: WIDTH - 104, align: "left" });
  doc.fillColor(PINK).font("Book-Italic").fontSize(8);
  doc.text(part, 52, 28, { width: WIDTH - 104, align: "right" });
  doc.moveTo(52, 42).lineTo(WIDTH - 52, 42).strokeColor("#ddd4ff").lineWidth(0.8).stroke();
  doc.restore();
}

function bodyFont(doc) {
  doc.font("Book").fontSize(10.5).fillColor(INK).lineGap(2.5);
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
    needSpace(doc, 26);
    const top = doc.y;
    doc.circle(markX, top + 5.5, 1.55).fill(TEAL);
    bodyFont(doc);
    doc.text(item, textX, top, { width, align: "left" });
    doc.moveDown(0.12);
  }
  doc.x = 52;
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

function coverPage(doc) {
  doc.addPage({ size: [WIDTH, HEIGHT], margins: { top: 0, bottom: 0, left: 0, right: 0 } });
  if (fs.existsSync(coverPath)) {
    doc.image(coverPath, 0, 0, { width: WIDTH, height: HEIGHT });
  } else {
    doc.rect(0, 0, WIDTH, HEIGHT).fill("#4a1408");
  }
  doc.save();
  doc.rect(0, HEIGHT - 176, WIDTH, 176).fill("#160e3d");
  doc.fillColor("#ff2d92").font("Book-Bold").fontSize(9);
  doc.text("AGAMIPATHA KITCHEN  ·  DIGITAL EDITION", 36, HEIGHT - 156, { width: WIDTH - 72 });
  doc.fillColor("#f8f6ff").font("Display-Bold").fontSize(22);
  doc.text("99 Cost-Effective Recipes for Bachelors", 36, HEIGHT - 134, { width: WIDTH - 72 });
  doc.fillColor("#14d4e8").font("Book-Italic").fontSize(11);
  doc.text(compiled, 36, HEIGHT - 62, { width: WIDTH - 72 });
  doc.fillColor("#c4b6fb").font("Book").fontSize(9);
  doc.text("Breakfast  ·  Lunch  ·  Snacks  ·  Dinner", 36, HEIGHT - 42, { width: WIDTH - 72 });
  doc.restore();
}

function frontMatter(doc, toc) {
  addInteriorPage(doc);
  currentPart = "How to cook small";
  if (toc) {
    toc.mark("How to cook small");
  }
  doc.y = 80;
  doc.font("Book-Bold").fontSize(10).fillColor(PINK).text("AGAMIPATHA", { align: "center" });
  doc.moveDown(0.8);
  doc.font("Display-Bold").fontSize(22).fillColor(TEAL).text("99 Cost-Effective Recipes for Bachelors", { align: "center" });
  doc.moveDown(0.35);
  doc.font("Book-Bold").fontSize(11).fillColor(TEAL).text(compiled, { align: "center" });
  doc.moveDown(0.15);
  doc.font("Book").fontSize(9).fillColor(MUTED).text(copyright, { align: "center" });
  doc.moveDown(0.45);
  figure(doc, "recipe-breakfast.png", "Morning food that does not need a parent in the kitchen.");
  para(
    doc,
    "This book is for the first rented room: one burner, a cooker, a tawa, a cheap fridge, and a budget that delivery apps will eat if you let them. Every recipe is a single serving or a tight two-plate batch. Costs are Indian street-market estimates for 2026 — your city will differ. The point is the habit, not the rupee on the page.\n\nShop once a week: onions, tomatoes, eggs, one dal, rice, atta, curd, chilli, turmeric, cumin, oil, salt. That basket already cooks half the book.",
  );

  addInteriorPage(doc);
  drawRunningHeader(doc, currentPart);
  if (toc) {
    toc.mark("Kitchen rules that save money", 1);
  }
  heading(doc, "Kitchen rules that save money");
  para(
    doc,
    "Cook rice and boil eggs on Sunday. Soak dals before you leave the house. Salt at the end for bhindi and mushrooms. Taste before you add a second masala tin. Wash the kadhai while the food rests — future-you is also a bachelor.\n\nThese are not restaurant plates. They are plates you will actually make. If a step needs an oven, a pasta machine, or imported cheese, it is not in this book.",
  );
  if (toc) {
    toc.mark("What you need", 1);
  }
  heading(doc, "What you need");
  para(doc, "Pressure cooker, tawa, one kadhai, one knife, one board, one steel box for leftovers, and a spoon you will not lose in the sink. A mixie is useful; a fork and a masher will do.");
}

function recipeFigure(doc, file, caption) {
  const img = path.join(artDir, file);
  if (!fs.existsSync(img) || fs.statSync(img).size < 4000) {
    return;
  }
  const w = WIDTH - 104;
  const h = Math.round((w * 9) / 16);
  needSpace(doc, h + 28);
  const x = 52;
  const y = doc.y + 2;
  doc.save();
  doc.roundedRect(x - 2, y - 2, w + 4, h + 4, 8).fill(TEAL);
  doc.restore();
  doc.image(img, x, y, { width: w, height: h });
  doc.y = y + h + 6;
  if (caption) {
    doc.font("Book-Italic").fontSize(8).fillColor(MUTED).text(caption, x, doc.y, { width: w, align: "center" });
    doc.moveDown(0.25);
  }
  bodyFont(doc);
}

function recipeBlock(doc, index, recipe, toc) {
  needSpace(doc, 160);
  if (toc) {
    toc.mark(`${index}.  ${recipe.name}`, 1);
  }
  doc.moveDown(0.15);
  doc.font("Display-Bold").fontSize(13).fillColor(TEAL).text(`${index}.  ${recipe.name}`);
  doc.font("Book-Italic").fontSize(9).fillColor(PINK);
  doc.text(`${recipe.mins} min   ·   ${recipe.cost}   ·   serves ${recipe.serves}`);
  doc.moveDown(0.15);
  if (recipe.image) {
    recipeFigure(doc, recipe.image);
  }
  doc.font("Book-Bold").fontSize(10).fillColor(INK).text("Ingredients");
  doc.moveDown(0.08);
  bullets(doc, recipe.ingredients);
  doc.moveDown(0.12);
  doc.font("Book-Bold").fontSize(10).fillColor(INK).text("Method");
  doc.moveDown(0.08);
  recipe.steps.forEach((step, i) => {
    needSpace(doc, 48);
    const top = doc.y;
    doc.font("Book-Bold").fontSize(10).fillColor(TEAL).text(`${i + 1}.`, 52, top, { width: 16, continued: false });
    bodyFont(doc);
    doc.text(step, 70, top, { width: WIDTH - 122, align: "left" });
    doc.moveDown(0.1);
  });
  doc.x = 52;
  doc.moveDown(0.08);
  doc.font("Book-Italic").fontSize(10).fillColor(MUTED).text(`Tip: ${recipe.tip}`, 52, doc.y, { width: WIDTH - 104 });
  doc.moveDown(0.4);
  bodyFont(doc);
}

function writeSections(doc, toc) {
  let n = 1;
  for (const section of SECTIONS) {
    currentPart = section.title;
    addInteriorPage(doc);
    if (toc) {
      toc.mark(`${section.kicker}  ·  ${section.title}`);
    }
    doc.y = 54;
    figure(doc, section.image, section.blurb);
    doc.font("Book-Bold").fontSize(10).fillColor(PINK).text(section.kicker, { align: "center" });
    doc.moveDown(0.4);
    doc.font("Display-Bold").fontSize(24).fillColor(TEAL).text(section.title, { align: "center" });
    doc.moveDown(0.55);
    doc.font("Book-Italic").fontSize(12).fillColor(MUTED).text(section.blurb, { align: "center" });

    addInteriorPage(doc);
    drawRunningHeader(doc, currentPart);
    doc.y = 58;
    section.recipes.forEach((recipe) => {
      recipeBlock(doc, n, recipe, toc);
      n += 1;
    });
  }
  return n - 1;
}

function closer(doc, toc) {
  currentPart = "After the last plate";
  addInteriorPage(doc);
  if (toc) {
    toc.mark("After the last plate");
  }
  drawRunningHeader(doc, currentPart);
  heading(doc, "A week that works");
  para(
    doc,
    `Sunday: soak, boil eggs, cook a cooker of rice and a pot of dal. Monday–Wednesday: remix those into tadka, fried rice, toast, and roti. Thursday: eggs or soya. Friday: the one chicken or fish plate if the purse allows. Saturday: leftovers and a fruit chaat.\n\nIf you used this book after a Razorpay checkout on AgamiPatha Store, the file is yours to keep and print. ${copyright} Cook for yourself first. Feeding a roommate is optional, and they should wash up.`,
  );
  heading(doc, "Index of moods");
  para(
    doc,
    "No time: bread omelette, leftover roti roll, Maggi upgrade, egg toast fingers, tomato egg drop.\n\nNo money: lemon rice, onion-tomato curry, murmura bhel, jeera aloo, curd rice.\n\nNeed protein: egg bhurji, soya curry, chana, sprouts, boiled-egg chaat, chicken pepper dry.\n\nNeed comfort: khichdi, dal tadka, ghee khichdi dinner, banana lassi.",
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

function buildBook(tocSlots, dest) {
  const doc = createDoc();
  const toc = createTocState(doc);
  doc._tocSlots = tocSlots;
  const stream = dest ? fs.createWriteStream(dest) : discardStream();
  doc.pipe(stream);
  coverPage(doc);
  const tocIndex = reserveTocPages(doc, addInteriorPage, drawRunningHeader);
  frontMatter(doc, toc);
  const counted = writeSections(doc, toc);
  closer(doc, toc);
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
  const total =
    BREAKFAST.length + LUNCH.length + SNACKS.length + DINNER.length;
  if (total !== 99) {
    throw new Error(`Expected 99 recipes, got ${total}`);
  }
  attachDishImages();
  if (!fs.existsSync(coverPath)) {
    throw new Error(`Cover missing: ${coverPath}`);
  }

  const probe = await buildBook(0, null);
  let slots = estimateTocPages(probe.entries);
  let result = await buildBook(slots, outPath);
  if (!result.tocFits) {
    slots += 1;
    result = await buildBook(slots, outPath);
  }
  console.log(`Wrote ${outPath}`);
  console.log(`recipes=${result.counted} toc=${slots} pages=${result.pages} bytes=${fs.statSync(outPath).size} tocFits=${result.tocFits}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
