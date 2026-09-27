const fs = require("fs");
const path = require("path");
const PDFDocument = require("pdfkit");
const { registerBookFonts } = require("./fonts");
const { AUTHOR, compiled, copyright } = require("./credit");
const { createTocState, estimateTocPages, reserveTocPages, fillTocPages, discardStream } = require("./toc");

const WIDTH = 432;
const HEIGHT = 648;
const TARGET_PAGES = 64;
const INK = "#160e3d";
const TEAL = "#4f2bff";
const PINK = "#ff2d92";
const MUTED = "#5a5480";

const root = path.resolve(__dirname, "..", "..");
const coverPath = path.join(root, "api", "Store", "class-10-stream-chooser-cover.png");
const artDir = path.join(root, "api", "Store", "art");
const outPath = path.join(root, "api", "Store", "class-10-stream-chooser.pdf");

const STREAMS = [
  {
    title: "PCM — Physics, Chemistry, Mathematics",
    image: "ebook-pcm.png",
    caption: "PCM is a two-year workshop: models, numbers, and things you can explain.",
    body: "PCM is crowded because it keeps many doors ajar: engineering, architecture, defence academies, pure science, data work, and a surprising number of design-adjacent courses that still want maths. Crowded is not the same as correct. It is the right stream when you can sit with a problem set after a long school day and still want the next numerical.\n\nA strong PCM student is not the one who recites formulae. It is the one who can say why a beam bends, why an acid reacts, and how a limit becomes a slope. Entrance papers reward that habit. Board papers still reward it too — many state counselling processes still use Class 12 marks.\n\nThe hidden cost of PCM is time. Coaching plus school can eat evenings you will not get back. If you need those evenings for sport, a family shop, or sleep, write that down before you sign the form.",
    opens: [
      "JEE Main / Advanced, state CETs, BITSAT",
      "NATA and architecture (with drawing practice)",
      "NDA and several defence technical entries",
      "B.Sc Physics, Maths, Statistics, and later data roles",
      "Most private B.Tech campuses if fees are honest",
    ],
    closes: [
      "NEET UG and licensed clinical seats that need biology",
      "CA Foundation is possible later, but you skipped the commerce craft",
      "Five-year law is still open via CLAT — PCM does not block it",
    ],
    fits: "You recover after a hard maths paper. You would rather build or model than memorise living systems.",
    misfit: "You picked PCM because a relative said 'keep options open' and you already dread every algebra class.",
    week: [
      "Daily: one timed maths block and one physics numerical set",
      "Weekly: one full mock and a written error log, not a screenshot of the rank",
      "Chemistry NCERT line-by-line — still the cheapest mark bank",
      "If maths is a wall by October of Class 11, add help or change the target, do not wait for Class 12 panic",
    ],
  },
  {
    title: "PCB — Physics, Chemistry, Biology",
    image: "ebook-pcb.png",
    caption: "PCB is a living syllabus: bodies, plants, and the clinic at the end of some roads — not all of them.",
    body: "PCB is the clinical corridor: MBBS, BDS, AYUSH degrees, nursing, physiotherapy, pharmacy, biotechnology, and a growing set of allied-health licences. NEET UG is the gate for medical college seats. It is a rank exam. Your standing against everyone else matters more than a raw score you can screenshot.\n\nBiology in NEET is still rooted in NCERT. Students who treat the textbook as optional lose easy marks and then buy another guide. Physics and chemistry decide the rank once biology is saturated.\n\nIf you want the white coat but cannot face six years plus internship plus residency, write that down now. Nursing, physiotherapy, and optometry are licensed professions with their own dignity and demand. They are not consolation prizes unless you treat them that way at the dinner table.",
    opens: [
      "NEET UG — MBBS, BDS, and several AYUSH seats",
      "B.Sc Nursing, BPT, B.Pharm, optometry, allied health",
      "Biotechnology and life-science degrees (campus rules vary)",
      "Teaching biology later, if that is actually the texture you want",
    ],
    closes: [
      "Most B.Tech doors that insist on Class 12 maths",
      "Architecture routes that need NATA plus maths",
      "A later jump to engineering usually means bridging maths — expensive in time",
    ],
    fits: "You can draw and label. You are curious about living systems more than machines. A hospital visit did not make you want to leave.",
    misfit: "You want MBBS as identity and have never sat with a biology diagram for an hour without checking a phone.",
    week: [
      "Read NCERT biology twice before any fat reference book",
      "Keep a diagram notebook — examiners still love labelled figures",
      "Visit one clinic or hospital before you lock MBBS as a personality",
      "Plan a drop year only with a written budget and a mock-score gate",
    ],
  },
  {
    title: "PCMB — keeping biology and maths",
    image: "ebook-streams.png",
    caption: "Four subjects is not twice the intelligence. It is twice the homework.",
    body: "Some boards and schools let you take Physics, Chemistry, Maths, and Biology together. Families love this because it looks like every door stays open. The doors stay open only if you can inhabit four syllabi without collapsing.\n\nPCMB is a serious option when you are genuinely torn between medicine and a maths-heavy science or engineering route, and your Class 10 marks plus this year's energy log say you can carry the load. It is a poor option when it is a delay tactic: 'we will decide in Class 12.' Class 12 will still need a decision, and you will be more tired.\n\nIf your school offers PCMB as a status combo, ask the previous batch how many actually sat both NEET and JEE with honest mocks. Borrow their timetable, not their Instagram.",
    opens: [
      "Both NEET and JEE-shaped doors, if you protect both syllabi",
      "A cleaner later switch if one side clearly wins in Class 11",
    ],
    closes: [
      "Free evenings, sport, and a lot of sleep — unless the school is unusually sane",
      "Depth: you may finish chapters and still be thin on problem-solving",
    ],
    fits: "You already finish schoolwork early. Two entrance shapes interest you for real reasons, not for relatives.",
    misfit: "You want to postpone the fight at home. PCMB will not postpone the fight. It will add biology practicals to it.",
    week: [
      "Write a non-negotiable sleep time before you add the fourth subject",
      "Pick a primary exam by December of Class 11 even if you keep the fourth subject",
      "Drop the extra subject in writing if mocks on both sides stall for a full term",
    ],
  },
  {
    title: "Commerce — Accounts, Business, Economics",
    image: "ebook-commerce.png",
    caption: "Commerce starts in a real shop and ends in a ledger someone else will trust.",
    body: "Commerce is the language of firms, tax, and markets. It leads to CA, CS, CMA, B.Com, BBA, economics honours, banking, and a large private-sector hiring pool. The mistake is to treat it as the easy stream. Accounts is a craft. Economics is a way of seeing trade-offs. Business studies is only useful if you can connect it to a kirana shop or a listed company.\n\nCA Foundation can be attempted after Class 12. Many students begin coaching in Class 11. That is optional. Comfort with journals, ledgers, and GST at a basic level is not optional if CA is on the table.\n\nCUET has become a major door to central universities for B.Com and BBA. State universities still run merit lists. Keep both calendars. If you dislike sitting with numbers but like people and stories, commerce can still work through marketing, HR, and operations — internships will have to prove it.",
    opens: [
      "CA, CS, CMA spines after Class 12",
      "B.Com, BBA, BMS, and economics honours via CUET or state lists",
      "Banking, insurance, and campus business roles",
      "A later MBA is common; it is not automatic",
    ],
    closes: [
      "NEET and most engineering CETs that need PCM",
      "You can still sit CLAT and many humanities degrees — check eligibility",
    ],
    fits: "You notice prices. You can keep a notebook tidy. A family business or a market stall feels like a classroom, not a punishment.",
    misfit: "You chose commerce to avoid maths, then met accounts. Accounts is maths wearing a journal.",
    week: [
      "Maintain a mock ledger for a fictional shop — opening stock to GST",
      "Read one company annual-report summary each month",
      "Learn spreadsheets early; they are the workshop of this stream",
      "Decide CA / CS / CMA / campus degree by the winter of Class 12",
    ],
  },
  {
    title: "Arts / Humanities — History, Political Science, Languages, Psychology",
    image: "ebook-arts.png",
    caption: "Arts is a reading life: arguments, stories, and public rooms — not a leftover bench.",
    body: "Arts is the most misunderstood stream in Indian families. It is the native route to law, civil services, journalism, design theory, teaching, psychology, social work, and a wide range of public-policy roles. It is not a leftover stream. It is a reading stream.\n\nCLAT and other law tests sit on comprehension, legal reasoning, and current affairs. UPSC is years away, but the reading habit starts now. Psychology and economics combinations are increasingly useful if your board offers them.\n\nThe risk in Arts is vagueness. 'I will do something in humanities' is not a plan. Name a profession, a degree, and an exam or portfolio. Then the stream becomes a tool instead of a fog. Languages, if you are strong in one, can become translation, content, teaching, or later language papers. Do not abandon a language you actually love because a neighbour called it a hobby.",
    opens: [
      "Five-year law (CLAT and other tests)",
      "BA degrees that feed UPSC, teaching, research, and media",
      "Journalism, psychology, social work, design theory — each with its own gate",
      "A serious reading life that other streams often starve",
    ],
    closes: [
      "Direct engineering and NEET clinical seats from this Class 12 combination",
      "Some families' respect, until you put a funded plan on paper",
    ],
    fits: "You finish books. You can summarise an argument. You would rather be in a public conversation than a lab.",
    misfit: "You chose Arts to avoid work. Arts punishes that faster than PCM, because there is no numerical to hide inside.",
    week: [
      "Read one quality newspaper editorial every day, on paper if you can",
      "Write 200 words of summary, not highlight-and-forget",
      "Pair the stream with a concrete degree: BA LLB, BA Economics, B.Des, B.El.Ed",
      "Build a portfolio of essays or work by Class 12 winter",
    ],
  },
  {
    title: "Not Class 12 — ITI, polytechnic, and vocational",
    image: "ebook-internship.png",
    caption: "A skilled trade is a career path. It is not a punishment for missing a percentile.",
    body: "Some students should not sit two more years of the same school shape. A good ITI, a polytechnic diploma, or a well-taught vocational course can put you in paid work sooner, with a ladder back to a degree later if you want one (lateral entry into B.Tech is a real door from many diplomas).\n\nThis is the right fork when you already like making, repairing, cooking, coding on a machine, or running a shop, and another two years of theory will mostly produce attendance. It is the wrong fork when the family is hiding a fight: 'let them do ITI' as exile. Exile is not a plan.\n\nAsk to visit the actual workshop, not the brochure. Ask last year's students whether they got the apprenticeship they were promised. Write the fee, the stipend, and the nearest degree ladder on the vocational worksheet.",
    opens: [
      "Faster earnings and a trade you can point at",
      "Lateral entry to many engineering degrees after a diploma",
      "Apprenticeships that teach more than a weak private campus",
    ],
    closes: [
      "Some campus degrees that want a conventional Class 12 stream this year",
      "You can often return — write the return door before you leave school",
    ],
    fits: "Your hands already know a craft. Sitting still for two more theory years makes you worse, not wiser.",
    misfit: "Someone is using vocational as a threat. Threats do not produce tradespeople.",
    week: [
      "Visit one ITI or polytechnic workshop before the form is signed",
      "Write the degree ladder (diploma → lateral B.Tech or equivalent) in one sentence",
      "Keep Class 10 certificates in a folder you could find at midnight",
    ],
  },
];

const LIKES = [
  {
    title: "If you like drawing and making forms",
    body: "Do not assume engineering. Architecture (NATA), design (NID, UCEED, NIFT), and some product roles want a portfolio more than a JEE rank. PCM helps architecture and some design-adjacent degrees. Arts plus a portfolio can feed fashion and communication design. Spend four weeks drawing from life, not tracing logos. If you cannot draw without a YouTube tutorial playing, the liking may be watching, not making.",
    try: "NATA syllabus sketch, one still-life a day, one campus design studio visit if you can steal an afternoon.",
  },
  {
    title: "If you like talking and arguing",
    body: "Law, sales, teaching, journalism, and civil-service interview rooms all use speech — but they use different speech. Law wants reading plus precision. Sales wants rejection plus product. Teaching wants designed attention. Journalism wants facts you can stand behind. Arts is the native stream; commerce works for sales and campus business; PCM does not block CLAT. The experiment is a debate, a written argument, and one conversation with a working lawyer or teacher — not a movie.",
    try: "One editorial summarised, one opposite-view paragraph, one local court or newsroom visit.",
  },
  {
    title: "If you like living things more than machines",
    body: "PCB is the default, not the only door. Agriculture, environment, veterinary routes, and some biotech degrees have their own maps. MBBS is one licensed corridor. If a dissection class or a clinic smell made you want to leave, listen. Liking documentaries about animals is not the same as liking the weekly texture of a ward.",
    try: "One clinic or farm afternoon, NCERT biology chapter drawn by hand, a talk with a nurse as well as a doctor.",
  },
  {
    title: "If you like shops, prices, and how money moves",
    body: "Commerce is the workshop. A family business is data, not a fallback to be ashamed of. CA is a long craft; B.Com is a broader campus; economics honours is a reading-and-models life. PCM students can still enter finance later, but they skipped two years of ledgers. If you like 'business' as a word and hate recording transactions, you like the poster.",
    try: "A mock ledger for a real stall you can see, one annual-report summary, one conversation with a CA or shop owner.",
  },
  {
    title: "If you like computers but not school maths",
    body: "This is the most common Class 10 confusion in the last decade. Software work at the hiring end still leans on logic and often on a degree that wanted PCM. Bootcamps exist. So do BCA and vocational coding courses. None of them make Class 11 maths vanish if you want the crowded engineering door. Be honest about which computer you like: games, design, or building tools. Those three like three different next steps.",
    try: "A tiny project you can demo in two minutes, one look at a BCA versus B.Tech syllabus, a talk with someone who got hired without a fantasy rank.",
  },
  {
    title: "If you like helping people but not NEET",
    body: "Helping is a large country. Nursing, physiotherapy, teaching, social work, psychology, and public health are professions with training, not vibes. PCB helps several of them. Arts helps others. Do not let a relative collapse 'helping' into MBBS. Write the weekly texture: night duty, classroom, case file, or home visit.",
    try: "Shadow a nurse or teacher for a day if you can, write what surprised you, name the licence or degree that matches that day.",
  },
  {
    title: "If you like uniforms, fitness, and a clear hierarchy",
    body: "NDA, other defence entries, and some police routes have age and fitness gates that do not wait for you to 'find yourself' at twenty-two. PCM is a common school door for NDA; Arts students also sit some papers. The experiment is a run, a medical checklist, and the current UPSC or recruiting bulletin — not a war film.",
    try: "A honest 1.6 km time, the official notification, one conversation with someone who failed SSB or medical and what they did next.",
  },
  {
    title: "If you like stories, languages, and the news",
    body: "Arts is home. Mass communication campuses vary wildly in quality; a portfolio of published or well-edited work beats a weak private degree. Languages you already love are an asset. PCM and commerce students can still write — they often have less time to practise.",
    try: "One reported 400-word piece about your locality, one language you will not drop, one editor or teacher who will mark it harshly.",
  },
];

const MYTHS = [
  ["PCM means you are intelligent.", "PCM means you chose a maths-heavy workshop. Intelligence shows up in every stream as stamina, honesty, and the ability to finish. Plenty of poor PCM students are quick in a room and slow on a problem set."],
  ["Arts is for students who failed.", "Arts is for students who will read. Failure is an attendance and effort story, not a stream label. A vague Arts plan fails. A named Arts plan (law, teaching, psychology, languages) is as concrete as JEE."],
  ["Commerce is easy.", "Accounts is a craft other people will spend. If you chose it to hide from maths, you will meet maths wearing a journal and GST."],
  ["Keep all options open.", "You have two years, not ten. PCMB can keep two science doors ajar at a real cost. 'All options' usually means no practice on any door."],
  ["A famous coaching brand is a stream.", "Coaching is a vendor. The stream is the syllabus you will inhabit at 6 a.m. in November. Buy the vendor after you can name the syllabus."],
  ["You can always change later.", "Sometimes you can. Biology after dropping it is hard. Maths after dropping it is hard. Changing is a plan with a bridge, not a slogan."],
  ["Marks in Class 10 decide the person.", "Class 10 is a fitness test for finishing a syllabus. It is not a personality. A collapsed subject has four common causes: teaching, attendance, language, dislike. Those four want four different next moves."],
];

const WORKSHEETS = [
  [
    "Four tests before a stream name",
    "Write one paragraph each: (1) What you can sit with for two years. (2) What you like enough to practise when nobody is watching. (3) What the household can fund without a secret loan. (4) What you refuse to give up (sport, city, sleep, a family duty). A stream that fails two tests is a poster.",
  ],
  [
    "Subject autopsy",
    "For each Class 10 subject, write: last marks, whether you attended, whether you understood the language of the textbook, whether you liked it after honest effort. Circle the cause of any collapse: teaching, attendance, language, or dislike. Only dislike is stream data. The other three are repair jobs.",
  ],
  [
    "Energy log — seven days",
    "Each day: two hours you felt quick, two hours you felt dull, bedtime, and whether a phone ate the evening. Careers are energy systems. Do not pick a night-shift fantasy if your log dies at 9 p.m.",
  ],
  [
    "Stream comparison grid",
    "Six short columns in your own notebook if this page is tight: PCM, PCB, PCMB, Commerce, Arts, Vocational. For each: one profession, one exam or licence, one fear, one annual cost band, one person who does the work. The stream with a fear you can live with beats the stream with a glamour you cannot fund.",
  ],
  [
    "What this stream closes",
    "Write the stream you are about to pick. List three doors it quietly shuts for the next two years. If you cannot name them, you have not chosen — you have postponed. Then write one sentence on whether you accept those closures.",
  ],
  [
    "If you like X",
    "Copy the 'If you like…' chapter that sounded like you. Write what you will try in the next four weeks, who will see the work, and what result would make you drop the idea. Liking without a test is a mood.",
  ],
  [
    "Parent conversation notes",
    "Before the talk: their safety sentence (what they are afraid of), your plan in four lines (stream, exam or portfolio, cost band, backup). After the talk: what you agreed, what is still a fight, the date you will review. Paper beats volume.",
  ],
  [
    "Money ceiling",
    "Ask a parent or guardian three numbers: annual fee without loans, with loans, and not at all. Write who would sign the loan. A private campus brochure that needs a fourth number is a fantasy. Vocational and government seats belong on this page too.",
  ],
  [
    "Four-week experiment",
    "Week 1: one official page or bulletin. Week 2: one problem set, ledger, essay, or drawing every weekday. Week 3: one living person who does the work. Week 4: a mock or a portfolio piece and a decide/don't-decide sentence. Date the sentence.",
  ],
  [
    "School form checklist",
    "Subject combination the school actually offers, last date, documents, whether PCMB is real or a rumour, lab fees, and the name of the teacher who will tell you the truth about workload. Write the alternative school if this one forces a combo you do not want.",
  ],
  [
    "Backup path",
    "If the first stream choice is wrong by winter of Class 11, what is path B that still uses this year's work? Changing course is cheaper when the backup is written while you are calm.",
  ],
  [
    "Decision log",
    "Date, stream chosen, reasons, who was in the room, what you will review in six months, and one thing you are still afraid of. Future-you deserves a paper trail. Leave three blank dated lines for reviews.",
  ],
];

function ensureDir(file) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
}

function createDoc() {
  const doc = new PDFDocument({
    size: [WIDTH, HEIGHT],
    bufferPages: true,
    autoFirstPage: false,
    info: {
      Title: "Class 10 Stream Chooser",
      Author: AUTHOR,
      Subject: "A write-in workbook for the Indian Class 10 stream decision",
      Keywords: "Class 10, PCM, PCB, Commerce, Arts, stream, India, AgamiPatha",
    },
  });
  registerBookFonts(doc);
  return doc;
}

function resetMargins(doc) {
  doc.page.margins = { top: 58, bottom: 62, left: 52, right: 52 };
}

function addInteriorPage(doc) {
  doc.addPage({ size: [WIDTH, HEIGHT], margins: { top: 58, bottom: 62, left: 52, right: 52 } });
  resetMargins(doc);
}

function drawRunningHeader(doc, part) {
  doc.save();
  doc.fillColor(TEAL).font("Book-Bold").fontSize(8);
  doc.text("AGAMIPATHA  ·  STREAM CHOOSER", 52, 28, { width: WIDTH - 104, align: "left" });
  doc.fillColor(PINK).font("Book-Italic").fontSize(8);
  doc.text(part, 52, 28, { width: WIDTH - 104, align: "right" });
  doc.moveTo(52, 42).lineTo(WIDTH - 52, 42).strokeColor("#ddd4ff").lineWidth(0.8).stroke();
  doc.restore();
}

function bodyFont(doc) {
  doc.font("Book").fontSize(11).fillColor(INK).lineGap(3);
}

function heading(doc, text) {
  needSpace(doc, 64);
  doc.moveDown(0.4);
  doc.font("Display-Bold").fontSize(16).fillColor(TEAL).text(text, { align: "left" });
  doc.moveDown(0.25);
  bodyFont(doc);
}

function subhead(doc, text) {
  needSpace(doc, 40);
  doc.moveDown(0.2);
  doc.font("Book-Bold").fontSize(12.5).fillColor(INK).text(text);
  doc.moveDown(0.15);
  bodyFont(doc);
}

function para(doc, text) {
  bodyFont(doc);
  const chunks = text.split("\n\n");
  for (const chunk of chunks) {
    needSpace(doc, 36);
    doc.text(chunk.trim(), { align: "justify", paragraphGap: 8 });
    doc.moveDown(0.35);
  }
}

function bullets(doc, items) {
  const markX = 58;
  const textX = 70;
  const width = WIDTH - 52 - textX;
  for (const item of items) {
    needSpace(doc, 30);
    const top = doc.y;
    doc.circle(markX, top + 6, 1.7).fill(TEAL);
    bodyFont(doc);
    doc.text(item, textX, top, { width, align: "left" });
    doc.moveDown(0.22);
  }
  doc.x = 52;
  doc.moveDown(0.15);
}

function callout(doc, text) {
  needSpace(doc, 70);
  const startY = doc.y;
  doc.save();
  doc.roundedRect(52, startY, WIDTH - 104, 8, 0).fill(PINK);
  doc.restore();
  doc.fillColor(MUTED).font("Book-Italic").fontSize(10.5);
  doc.text(text, 60, startY + 14, { width: WIDTH - 120, align: "left" });
  doc.moveDown(1.1);
  bodyFont(doc);
}

function needSpace(doc, h) {
  if (doc.y + h > HEIGHT - 62) {
    addInteriorPage(doc);
    drawRunningHeader(doc, currentPart);
    doc.y = 58;
  }
}

function figure(doc, file, caption) {
  if (!file) {
    return;
  }
  const img = path.join(artDir, file);
  if (!fs.existsSync(img)) {
    return;
  }
  const w = WIDTH - 104;
  const h = Math.round((w * 9) / 16);
  needSpace(doc, h + 42);
  const x = 52;
  const y = doc.y + 4;
  doc.save();
  doc.roundedRect(x - 3, y - 3, w + 6, h + 6, 10).fill(TEAL);
  doc.restore();
  doc.image(img, x, y, { width: w, height: h });
  doc.y = y + h + 10;
  if (caption) {
    doc.font("Book-Italic").fontSize(8.5).fillColor(MUTED).text(caption, x, doc.y, { width: w, align: "center" });
    doc.moveDown(0.45);
  }
  bodyFont(doc);
}

function partOpener(doc, kicker, title, blurb, imageFile, caption) {
  addInteriorPage(doc);
  doc.y = 52;
  if (imageFile) {
    figure(doc, imageFile, caption);
    doc.moveDown(0.35);
  } else {
    doc.y = 160;
  }
  doc.font("Book-Bold").fontSize(10).fillColor(PINK).text(kicker, { align: "center" });
  doc.moveDown(0.55);
  doc.font("Display-Bold").fontSize(24).fillColor(TEAL).text(title, { align: "center" });
  doc.moveDown(0.7);
  doc.font("Book-Italic").fontSize(12).fillColor(MUTED).text(blurb, { align: "center" });
}

function linedBlock(doc, lines) {
  doc.moveDown(0.25);
  for (let line = 0; line < lines; line += 1) {
    needSpace(doc, 22);
    doc.moveTo(52, doc.y).lineTo(WIDTH - 52, doc.y).strokeColor("#c4b6fb").lineWidth(0.6).stroke();
    doc.y += 20;
  }
  doc.x = 52;
}

let currentPart = "Front matter";
let toc = null;

function mark(title, level = 0) {
  if (toc) {
    toc.mark(title, level);
  }
}

function coverPage(doc) {
  doc.addPage({ size: [WIDTH, HEIGHT], margins: { top: 0, bottom: 0, left: 0, right: 0 } });
  if (fs.existsSync(coverPath)) {
    doc.image(coverPath, 0, 0, { width: WIDTH, height: HEIGHT });
  } else {
    doc.rect(0, 0, WIDTH, HEIGHT).fill("#2a1466");
  }
  doc.save();
  doc.rect(0, HEIGHT - 168, WIDTH, 168).fill("#160e3d");
  doc.fillColor("#ff2d92").font("Book-Bold").fontSize(9);
  doc.text("AGAMIPATHA DIGITAL EDITION", 36, HEIGHT - 148, { width: WIDTH - 72, align: "left" });
  doc.fillColor("#f8f6ff").font("Display-Bold").fontSize(22);
  doc.text("Class 10 Stream Chooser", 36, HEIGHT - 128, { width: WIDTH - 72 });
  doc.fillColor("#14d4e8").font("Book-Italic").fontSize(12);
  doc.text(compiled, 36, HEIGHT - 70, { width: WIDTH - 72 });
  doc.fillColor("#c4b6fb").font("Book").fontSize(9);
  doc.text("A write-in workbook  ·  64 pages  ·  Pick a syllabus you can inhabit", 36, HEIGHT - 48, { width: WIDTH - 72 });
  doc.restore();
}

function titlePage(doc) {
  addInteriorPage(doc);
  mark("Title");
  doc.y = 110;
  doc.font("Book-Bold").fontSize(10).fillColor(PINK).text("AGAMIPATHA", { align: "center" });
  doc.moveDown(1.4);
  doc.font("Display-Bold").fontSize(26).fillColor(TEAL).text("Class 10 Stream Chooser", { align: "center" });
  doc.moveDown(0.6);
  doc.font("Book-Italic").fontSize(13).fillColor(MUTED).text("How to pick PCM, PCB, Commerce, Arts,\nor a skilled trade — and live with the doors you close.", { align: "center" });
  doc.moveDown(0.7);
  doc.font("Book-Bold").fontSize(12).fillColor(TEAL).text(compiled, { align: "center" });
  doc.moveDown(0.25);
  doc.font("Book").fontSize(9.5).fillColor(MUTED).text(copyright, { align: "center" });
  doc.moveDown(0.8);
  figure(doc, "ebook-streams.png", "Four colours are not four personalities. They are two-year workshops.");
  doc.moveDown(0.4);
  doc.font("Book").fontSize(11).fillColor(INK).text("Digital edition  ·  64 pages  ·  For Class 10 families", { align: "center" });
  doc.moveDown(1);
  callout(doc, "This book will not pick a stream for you. It will make you write the reasons, the money, and the backup. Confirm every exam rule from the official bulletin.");
}

function copyrightPage(doc) {
  addInteriorPage(doc);
  mark("How to use this workbook");
  heading(doc, "How to use this workbook");
  para(
    doc,
    `Class 10 Stream Chooser is a AgamiPatha digital edition, ${compiled.toLowerCase()}. ${copyright} You may print it for personal study. You may not sell the file, upload it as a course, or present it as official counselling.\n\nThe Career Path Planner in the AgamiPatha store is the longer map: exams, thirty professions, a year grid. This file is the fork before that map. Use this one in the winter of Class 10. Use the planner once a stream is named.\n\nWork in pencil. A clean workbook is a brochure. The value is that the decision-log page still has your handwriting on it in July of Class 11.`,
  );
  subhead(doc, "A four-week rhythm");
  bullets(doc, [
    "Week 1: read Part I and fill the four tests and the subject autopsy",
    "Week 2: read only the two streams you are actually considering — both opens and closes",
    "Week 3: run one 'If you like X' experiment and one parent conversation on paper",
    "Week 4: lock a first choice and a backup, then put the school form dates on the checklist",
  ]);
  subhead(doc, "What this book will not do");
  para(
    doc,
    "It will not promise an IIT, an MBBS seat, or a CA rank. It will not replace a licensed counsellor if you are in distress. If studies have become a health problem, talk to a trusted adult and a professional. A stream can wait a week. You cannot.",
  );
}

function writeDecision(doc) {
  currentPart = "Part I  ·  The fork";
  partOpener(
    doc,
    "PART I",
    "The decision, not the stream",
    "Name the tests first. The four-letter combination comes second.",
    "ebook-planner.png",
    "Class 10 winter is for paper, not for a relative's speech.",
  );
  mark("Part I  ·  The decision, not the stream");
  addInteriorPage(doc);
  drawRunningHeader(doc, currentPart);
  heading(doc, "Class 10 is a sorting year, not a verdict");
  mark("Class 10 is a sorting year, not a verdict", 1);
  para(
    doc,
    "Boards matter because they are a common language. They do not measure curiosity, stamina, or kindness — the traits that keep a profession alive at thirty. Treat Class 10 as a fitness test: can you finish a syllabus, sit an exam, and recover?\n\nIf a subject collapsed this year, ask whether the cause was teaching, attendance, language, or dislike. Those four causes want four different next moves. A tutor fixes the first. A timetable fixes the second. A medium-of-instruction change is rarer and serious. Dislike, if it survives honest effort, is data for the stream choice.\n\nStart the conversation in Class 10 winter. Summer is for forms, not for discovering that you never liked maths.",
  );
  heading(doc, "Four tests before any stream name");
  mark("Four tests before any stream name", 1);
  para(
    doc,
    "Indian families often start with a brand: IIT, MBBS, CA, 'something in computers'. Brands are destinations. A stream is a two-year workshop. You need four tests on paper before you say PCM out loud.",
  );
  bullets(doc, [
    "Stamina — which syllabus can you inhabit at 6 a.m. in November, not on a motivated Saturday",
    "Liking — what you will practise when nobody is posting it",
    "Money — the real annual fee the household can pay, with and without loans",
    "Non-negotiables — sport, a family shop, a city, sleep, a language you will not drop",
  ]);
  callout(doc, "A stream that fails two of the four tests is a poster. Posters make loud Class 11 and quiet Class 12.");
  heading(doc, "A simple timeline");
  mark("A simple timeline", 1);
  bullets(doc, [
    "December–January of Class 10: four tests, subject autopsy, first shortlist of two streams",
    "February–March: one experiment per shortlisted stream; one funded conversation at home",
    "After boards: school form, subject combination, coaching only if the syllabus is named",
    "July of Class 11: review the decision log. Changing now is cheaper than changing after a wasted year",
  ]);
  heading(doc, "Myths that waste a winter");
  mark("Myths that waste a winter", 1);
  for (const [myth, reply] of MYTHS) {
    subhead(doc, myth);
    para(doc, reply);
  }
}

function writeStreams(doc) {
  currentPart = "Part II  ·  Streams";
  partOpener(
    doc,
    "PART II",
    "Workshops and the doors they close",
    "Every stream is a set of next exams and a set of goodbyes. Write both.",
    "ebook-streams.png",
    "Pick a syllabus you can inhabit for two years, not a colour you can wear for a day.",
  );
  mark("Part II  ·  Workshops and the doors they close");
  addInteriorPage(doc);
  drawRunningHeader(doc, currentPart);
  heading(doc, "How to read each stream");
  mark("How to read each stream", 1);
  para(
    doc,
    "For each option this book names what typically opens, what typically closes, who it fits, and who it misfits. Typical is not a law. Doctors have entered from unusual routes; engineers have become civil servants. Use the page as a default spine, then check AgamiPatha or an official site for the exact hop.\n\nWhen a page mentions cost, treat the number as order-of-magnitude. Private medical seats and private campuses can be an order higher than government ones. Always ask for this year's prospectus.",
  );
  for (const stream of STREAMS) {
    heading(doc, stream.title);
    mark(stream.title, 1);
    figure(doc, stream.image, stream.caption);
    para(doc, stream.body);
    subhead(doc, "Usually opens");
    bullets(doc, stream.opens);
    subhead(doc, "Usually closes or delays");
    bullets(doc, stream.closes);
    subhead(doc, "Fits you if");
    para(doc, stream.fits);
    subhead(doc, "Misfit warning");
    para(doc, stream.misfit);
    subhead(doc, "A sane week");
    bullets(doc, stream.week);
  }
}

function writeLikes(doc) {
  currentPart = "Part III  ·  If you like X";
  partOpener(
    doc,
    "PART III",
    "If you like X, try Y",
    "Interest is a clue. A four-week test is evidence.",
    "ebook-professions.png",
    "Liking a film about a job is not the same as liking the Tuesday of that job.",
  );
  mark("Part III  ·  If you like X, try Y");
  addInteriorPage(doc);
  drawRunningHeader(doc, currentPart);
  heading(doc, "Interest is not a stream");
  mark("Interest is not a stream", 1);
  para(
    doc,
    "Students often jump from a liking to a four-letter combination: I like computers, therefore PCM; I like helping, therefore PCB. Sometimes that jump is right. Often it skips the weekly texture. This part maps common likings to experiments. Do the experiment before you fight anyone at home.\n\nIf two likings both feel true, run both tests in the same month. The one you finish is data. The one you postpone is a mood.",
  );
  for (const item of LIKES) {
    heading(doc, item.title);
    mark(item.title, 1);
    para(doc, item.body);
    subhead(doc, "Try this month");
    para(doc, item.try);
  }
}

function writeParents(doc) {
  currentPart = "Part IV  ·  Home";
  partOpener(
    doc,
    "PART IV",
    "Parents, relatives, and paper",
    "Most Indian career fights are love wearing the wrong costume. Bring a page, not a volume.",
    "ebook-exams.png",
    "Safety is a real fear. Vague passion is not an answer to it.",
  );
  mark("Part IV  ·  Parents, relatives, and paper");
  addInteriorPage(doc);
  drawRunningHeader(doc, currentPart);
  heading(doc, "Hear the safety, then show a funded alternative");
  mark("Hear the safety, then show a funded alternative", 1);
  para(
    doc,
    "A parent who pushes engineering may be pushing a pension they never had. A parent who pushes medicine may be pushing respect they were denied. Hear the safety. Then show a funded, examined alternative. A vague 'I want to do something creative' loses to a concrete 'NIFT + this fee + this backup B.Com'. Paper beats volume at the dinner table.\n\nRelatives who have not held the job should get a time limit in the conversation, not a veto. Neighbour uncles are not a counselling board.",
  );
  heading(doc, "A script you can actually say");
  mark("A script you can actually say", 1);
  para(
    doc,
    "You do not need a speech. You need four lines in this order: the stream, the next exam or portfolio, the cost band you already asked about, and the backup if the first door fails. Practise it once out loud before the meeting. If you cannot say the four lines, you are not ready to fight — you are ready to fill another worksheet.",
  );
  bullets(doc, [
    "I want [stream] because I can sit with [subject or craft] for two years.",
    "The next gate is [exam / licence / portfolio], not a college brand.",
    "The fee we can actually pay is [the money-ceiling number]. I am not asking for a fourth number.",
    "If this is wrong by winter of Class 11, path B is [backup] and it still uses this year's work.",
  ]);
  callout(doc, "If the room only wants a brand (IIT, MBBS, 'government job'), ask what problem the brand is solving. Safety, status, and money are three different problems. One stream rarely solves all three.");
  heading(doc, "When the household cannot fund the dream");
  mark("When the household cannot fund the dream", 1);
  para(
    doc,
    "A career that bankrupts the household is a household event. Government seats, scholarships, and vocational ladders are not lesser lives. They are the honest map. Write the money ceiling before you fall in love with a private campus brochure. Education loans are tools. They are also EMIs during your first salary years.\n\nIf the honest number rules out a private MBBS or a famous private B.Tech, say so early. Grief in Class 10 is cheaper than debt in Class 12 counselling week.",
  );
}

function writeWorksheets(doc) {
  currentPart = "Part V  ·  Worksheets";
  partOpener(
    doc,
    "PART V",
    "Write in the book",
    "A chooser you do not mark is a brochure.",
    "ebook-planner.png",
    "Pencil beats a highlight reel.",
  );
  mark("Part V  ·  Write in the book");
  let index = 1;
  for (const [title, prompt] of WORKSHEETS) {
    addInteriorPage(doc);
    drawRunningHeader(doc, currentPart);
    doc.y = 58;
    heading(doc, `Worksheet ${index}  ·  ${title}`);
    mark(`Worksheet ${index}  ·  ${title}`, 1);
    para(doc, prompt);
    linedBlock(doc, 14);
    index += 1;
  }
}

function writeAppendix(doc) {
  currentPart = "Appendix";
  partOpener(doc, "APPENDIX", "Keep these open", "Copy them into your own notebook and update them when bulletins and school forms change.");
  mark("Appendix  ·  Keep these open");
  addInteriorPage(doc);
  drawRunningHeader(doc, currentPart);
  heading(doc, "Usual next gates by stream (confirm every year)");
  mark("Usual next gates by stream", 1);
  bullets(doc, [
    "PCM — JEE Main (often two sessions), JEE Advanced, state CETs, NATA, NDA",
    "PCB — NEET UG, then counselling as a second exam; nursing and allied-health forms have their own calendars",
    "Commerce — CA Foundation windows, CUET, state university lists, CS/CMA notices",
    "Arts — CLAT (often late year for the next cycle), CUET, design tests (NID / UCEED / NIFT), campus merit lists",
    "Vocational — ITI / polytechnic admission circulars; ask the return door to a degree in writing",
  ]);
  heading(doc, "Documents to keep in one folder");
  mark("Documents to keep in one folder", 1);
  bullets(doc, [
    "Class 10 admit card, then marksheet and passing certificate",
    "Photo ID that matches the application name exactly",
    "Passport photographs in the size the form asks",
    "Category / EWS / PwD certificates if they apply, still valid",
    "Income certificate dated as required if you will hunt scholarships",
    "A scanned PDF set before form season — schools still lose paper",
  ]);
  heading(doc, "A short letter to the student who is tired of being asked");
  mark("A short letter to the student who is tired of being asked", 1);
  para(
    doc,
    "If every relative has a stream for you, that is not guidance. That is weather. You are allowed to want a life that is not a brochure. You are allowed to want money. You are allowed to want service. You are not required to want them in the ratio your neighbourhood prefers.\n\nPick a workshop you can inhabit. Close some doors on purpose. Write the backup. Then go to sleep.\n\nWhen you are ready, open AgamiPatha, put your Class 10 (or the stream you just chose) as a starting point, and walk the steps. The site expands the path. This book was only meant to help you name the first fork.",
  );
  heading(doc, "Colophon");
  para(
    doc,
    `Set as a 6 × 9 inch digital edition. ${copyright} Cover illustration commissioned for AgamiPatha. Printed pages welcome; the file you downloaded after Razorpay checkout is yours to keep for personal study.\n\nIf any pages remain after this colophon, they are extra lined sheets so the edition is a full 64 pages you can actually write in.`,
  );
}

function addFillerSheets(doc, needed) {
  currentPart = "Planner sheets";
  if (needed > 0) {
    mark("Open planner sheets");
  }
  for (let i = 1; i <= needed; i += 1) {
    addInteriorPage(doc);
    drawRunningHeader(doc, currentPart);
    heading(doc, `Open notes sheet ${i}`);
    para(doc, "Use this page for overflow, a second parent conversation, or a school combo the form did not expect. Date the top line.");
    linedBlock(doc, 18);
  }
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
  toc = createTocState(doc);
  doc._tocSlots = tocSlots;
  const stream = dest ? fs.createWriteStream(dest) : discardStream();
  doc.pipe(stream);

  coverPage(doc);
  const tocIndex = reserveTocPages(doc, addInteriorPage, drawRunningHeader);
  titlePage(doc);
  copyrightPage(doc);
  writeDecision(doc);
  writeStreams(doc);
  writeLikes(doc);
  writeParents(doc);
  writeWorksheets(doc);
  writeAppendix(doc);

  let count = doc.bufferedPageRange().count;
  if (count < TARGET_PAGES) {
    addFillerSheets(doc, TARGET_PAGES - count);
  }
  count = doc.bufferedPageRange().count;

  const tocFits = fillTocPages(doc, toc.entries, tocIndex, tocSlots, drawRunningHeader, { INK, TEAL, MUTED, WIDTH });
  numberPages(doc);
  const entries = toc.entries.slice();
  doc.end();
  return new Promise((resolve, reject) => {
    stream.on("finish", () => resolve({ pages: count, entries, tocFits }));
    stream.on("error", reject);
  });
}

async function main() {
  if (!fs.existsSync(coverPath)) {
    throw new Error(`Cover image missing at ${coverPath}`);
  }

  ensureDir(outPath);
  const probe = await buildBook(0, null);
  let slots = estimateTocPages(probe.entries);
  let result = await buildBook(slots, outPath);
  if (!result.tocFits) {
    slots += 1;
    result = await buildBook(slots, outPath);
  }
  console.log(`Wrote ${outPath}`);
  console.log(`toc=${slots} pages=${result.pages} bytes=${fs.statSync(outPath).size} tocFits=${result.tocFits}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
