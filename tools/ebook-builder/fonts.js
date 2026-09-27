const fs = require("fs");
const path = require("path");

const WIN = "C:\\Windows\\Fonts";

function firstExisting(names) {
  for (const name of names) {
    const file = path.join(WIN, name);
    if (fs.existsSync(file)) {
      return file;
    }
  }
  return null;
}

function registerBookFonts(doc) {
  const body = firstExisting(["georgia.ttf"]);
  const bold = firstExisting(["georgiab.ttf"]);
  const italic = firstExisting(["georgiai.ttf"]);
  const display = firstExisting(["pala.ttf", "GARA.TTF", "constan.ttf"]);
  const displayBold = firstExisting(["palab.ttf", "GARABD.TTF", "constanb.ttf"]);

  if (!body || !bold || !italic || !display || !displayBold) {
    throw new Error("Book fonts were not found in C:\\Windows\\Fonts (need Georgia and Palatino or Garamond).");
  }

  doc.registerFont("Book", body);
  doc.registerFont("Book-Bold", bold);
  doc.registerFont("Book-Italic", italic);
  doc.registerFont("Display", display);
  doc.registerFont("Display-Bold", displayBold);
}

module.exports = { registerBookFonts };
