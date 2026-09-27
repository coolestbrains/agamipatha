const fs = require("fs");
const path = require("path");
const PDFDocument = require("pdfkit");
const { registerBookFonts } = require("./fonts");
const { AUTHOR, compiled, copyright } = require("./credit");

const { createTocState, estimateTocPages, reserveTocPages, fillTocPages, discardStream } = require("./toc");

const WIDTH = 432;
const HEIGHT = 648;
const TARGET_PAGES = 56;
const INK = "#160e3d";
const TEAL = "#4f2bff";
const PINK = "#ff2d92";
const MUTED = "#5a5480";

const root = path.resolve(__dirname, "..", "..");
const coverPath = path.join(root, "api", "Store", "first-year-college-survival-cover.png");
const artDir = path.join(root, "api", "Store", "art");
const outPath = path.join(root, "api", "Store", "first-year-college-survival.pdf");

const HOSTEL = [
  {
    title: "The room is a workshop, not a film set",
    body: "A hostel room in the first fortnight looks like freedom. It is actually a small factory: sleep, laundry, charging ports, and a desk that will either hold a syllabus or a pile of delivery bags. The students who stay sane treat the bed as sleep, the desk as work, and the floor as not a wardrobe.\n\nYou do not need aesthetic. You need a place you can find your ID card at 7.40 a.m. Put the admit-card folder, ATM card, and a photocopy set in one envelope on day one. Future-you in counselling week and exam week will not forgive a 'I will organise it later' pile.",
    bullets: [
      "One envelope: ID, hostel ID, fee receipts, photocopies, two extra photographs",
      "Charge the phone away from the pillow. Night scrolling is how internals die",
      "A cheap laundry bag beats a corner of damp clothes that becomes a health problem",
      "If you share a room, write a two-line pact: sleep window, guests, and who buys the broom",
    ],
  },
  {
    title: "Roommates are a skill, not luck",
    body: "You will not always like the person on the other bed. You do not have to. You have to be predictable. Unpredictable roommates — 3 a.m. calls, borrowed chargers that never return, relatives who 'just came' — are a grade problem wearing a social costume.\n\nSay the hard things in the first week while everyone is still polite: lights-out window, whether food stays in the room, and whether you can study with earphones. If the match is impossible, ask the warden early. Waiting until internals week makes you look like the problem.",
    bullets: [
      "Ask, do not hint. Hints do not survive a semester",
      "Lock valuables; trust is not a CCTV",
      "If ragging shows up, it is illegal. UGC regulations exist. Tell a warden, a parent, and a written note — not only a WhatsApp vent",
      "Homesickness in week two is common. A daily ten-minute call is better than a midnight collapse every fourth day",
    ],
  },
  {
    title: "Warden, out-pass, and the unwritten clock",
    body: "Hostels run on clocks you did not vote for: mess timings, gate timings, visitor rules. Copy them into your phone notes on day one. Missing a gate by twenty minutes in August is a story. Missing it in a mid-sem week is an attendance hole plus a fight.\n\nOut-pass is a tool, not a personality. Students who treat every weekend as an exit often discover that the campus library, the lab, and the people who will sit internals with them all live inside the gate.",
    bullets: [
      "Photograph the hostel notice board once a month. Rules change; rumours do not count",
      "Keep one local guardian number the college actually accepts, not a fictional uncle",
      "If you are unwell, the campus medical room plus a written note beats disappearing",
    ],
  },
  {
    title: "Money on a hostel week",
    body: "UPI makes spending feel like nothing. It is not nothing. First-year students leak money on late-night orders, printouts they could have shared, and 'just this once' travel. Write a weekly ceiling before the first stipend or parental transfer arrives.\n\nMess fees are usually the cheapest calories you will be offered. Delivery is a tax on loneliness. If the mess is genuinely inedible, cook — do not default to fried snacks that wreck sleep and internals week.",
    bullets: [
      "A weekly envelope or a notes app with three lines: mess already paid, must-spend, play-spend",
      "Print in batches. Emergency printing on exam morning is a luxury tax",
      "If someone asks you to pay 'for the group' and collect later, decline once, calmly, forever",
    ],
  },
];

const ATTENDANCE = [
  {
    title: "Seventy-five percent is a law of the building",
    body: "Many Indian universities and AICTE-affiliated campuses will not let you sit the end-sem if your attendance in that course is short — often around 75 percent, sometimes with a medical window, sometimes without. The number is in your ordinance, not in a senior's memory.\n\nAttendance is not morality. It is a gate. Students who 'know the subject' still get detained. Detained means you repeat the paper, sometimes the year-shape of that course, and you explain it at home. Read the rule in writing in week one.",
    bullets: [
      "Find the ordinance PDF or the student handbook. Screenshot the attendance clause",
      "Know whether labs, tutorials, and lectures are counted together or separately",
      "Know the last date to apply for medical leave — a hospital bill in May does not always unlock April",
      "Proxy is a disciplinary case, not a favour. It can stain more than one paper",
    ],
  },
  {
    title: "Bunking has arithmetic",
    body: "If a course has 40 lectures and you need 75 percent, you can miss 10. Those 10 are for fever, a train, a family event, and one real emergency — not for a web series. Spend them like rupees.\n\nSeniors will say 'mass bunk, everyone goes'. Mass bunk still lands on your card. If the teacher marks it, the crowd will not sit the detained list for you.",
    bullets: [
      "Keep a running tally per course in a notebook, not in your head",
      "Front-load attendance in August–September. October festivals and November internals eat days",
      "If you must miss, miss a lecture you can recover from notes, not a lab you cannot repeat",
    ],
  },
  {
    title: "What actually happens when you fall short",
    body: "Short attendance can mean: you cannot fill the exam form; you fill it and are struck off; you sit a condonation committee; you pay a fine and still fail the threshold. Campuses differ. Shame is optional. The paperwork is not.\n\nIf you are sliding in September, talk to the teacher and the mentor while there are still classes to attend. Begging in November is a different conversation.",
    bullets: [
      "Condonation, if it exists, is a process with dates — not a personality contest",
      "Parents should hear the number from you before the exam cell emails them",
      "A detained first-year course is recoverable. Hiding it until results week is how people lose a year",
    ],
  },
];

const INTERNALS = [
  {
    title: "Internals are the semester you can still steer",
    body: "End-semesters are a camera. Internals are a workshop. In a typical theory course, internals (mid-sem, quizzes, assignments, attendance marks, viva) can be 20 to 50 percent of the grade. Students who treat internals as 'small tests' donate that band to people who simply showed up with a pen.\n\nYou cannot always out-write a difficult end-sem. You can almost always collect the internals that are offered in daylight.",
    bullets: [
      "On day one, list every internal component and its weight from the course handout",
      "A quiz you skip is not a rest. It is a number that will not grow later",
      "Assignment copy-paste is easy to detect and expensive when a department decides to make an example",
    ],
  },
  {
    title: "Mid-semesters, labs, and viva",
    body: "Mid-semesters reward the syllabus you actually opened in weeks 1–6, not the night before. Labs reward a record that looks like you were there: readings, graphs, a conclusion in your language. Viva rewards being able to say what you did, not what your partner did.\n\nIf you are from a board exam culture, internals feel informal. They are not informal in the grade report. A 12/20 internals plus a weak end-sem is how a 'smart student' lands a 6-point something and then cannot change branch.",
    bullets: [
      "Rewrite lab records the same week, not the night before submission",
      "For viva: three sentences — aim, method, what went wrong. Examiners smell recitation",
      "If a mid-sem is open-notes, that is not a holiday. It is a test of whether your notes exist",
    ],
  },
  {
    title: "SGPA, CGPA, and the first-year trap",
    body: "SGPA is this term. CGPA is the running average. Branch change, some internships, and some campus filters look at first-year CGPA because it is the only number you have. A 'I will start from second year' plan is a plan to keep a number you cannot edit.\n\nBacklogs in first year are not a personality. They are a calendar. One backlog you clear in a supplementary is a story. Three backlogs plus short attendance is a year-shape.",
    bullets: [
      "Know whether failed courses sit in CGPA until you clear them",
      "Supplementary forms have fees and dates. Put them in the same calendar as internals",
      "Do not drop a course informally. Withdrawal, if allowed, is a form, not a vibe",
    ],
  },
];

const SYLLABUS = [
  {
    title: "A syllabus is a contract, not a PDF to ignore",
    body: "The document you get in week one — course code, credits, L-T-P (lecture-tutorial-practical hours), textbooks, reference books, course outcomes, and the exam split — is the closest thing you have to a map of the paper. Students who only follow classroom gossip study the teacher's favourite chapter and miss the unit that the paper actually loves.\n\nRead it once with a pen. Star the verbs: explain, calculate, design, compare. Those verbs are the paper.",
    bullets: [
      "Credits tell you how heavy the course is relative to others, not how 'important' it feels",
      "Prescribed textbook is the default spine. Reference books are for when the spine is thin",
      "Course outcomes (COs) are not decoration. Question papers are often mapped to them",
      "If L-T-P shows practical hours, the lab is not optional flavouring",
    ],
  },
  {
    title: "How to turn a unit list into a week",
    body: "Take the number of units and the number of teaching weeks before internals. That division is your pace. If unit 3 is 40 percent of the mid-sem (ask, or look at last year's paper), it gets 40 percent of your time, not an equal slice of vibes.\n\nPast papers, if the department shares them, are the syllabus with a highlighter. If they do not share them, the assignment questions are a leak of what the teacher thinks matters.",
    bullets: [
      "After each lecture, write three lines: topic, example, what you still cannot do",
      "A week with only highlighting is a week you did not study",
      "If the teacher skips a unit, check whether the paper still includes it. Many do",
    ],
  },
  {
    title: "Textbooks, notes, and YouTube",
    body: "YouTube is a tutor, not a syllabus. Watch a concept after you have attempted one problem from the book. The other way around produces students who can recognise a thumbnail and cannot start a numerical.\n\nBorrowed notes from a topper are a backup, not a personality. Copying them the night before a mid-sem teaches handwriting, not the course.",
    bullets: [
      "One primary resource per course. Three playlists is procrastination with extra tabs",
      "If English is heavy, keep a glossary page. Language failure looks like subject failure on a paper",
      "Group study works when everyone brings a solved problem. It fails when it becomes a hostel adda",
    ],
  },
];

const CHANGE = [
  {
    title: "Changing course is a plan with dates, not a mood",
    body: "First year is when many Indian campuses allow a branch change on CGPA, when some universities still let you migrate, and when a second attempt at an entrance is still inside the age window for several exams. It is also when loneliness can dress up as 'this course is not me'.\n\nWrite the difference. A course that is wrong has a pattern: you cannot sit the core subject even after honest weeks. A mood that is wrong has a pattern: you cannot sit anything after a bad hostel month. Fix the hostel month before you burn the degree.",
    bullets: [
      "List the official doors: intra-college branch change, university transfer, re-admission, a new entrance next year",
      "Each door has a CGPA or rank gate and a calendar. Rumour is not a gate",
      "Tell one adult with money in the game before you fill a form that costs a year",
    ],
  },
  {
    title: "Branch change after first year",
    body: "Engineering campuses often move students across branches using first-year CGPA and seat matrices. Computer-facing branches fill first. Core branches sometimes have space. If this is your plan, internals and attendance are not side quests — they are the application.\n\nIf you entered a branch as a 'backup' and intend to jump, behave like an applicant from day one. The students already in the target branch are also applying with their numbers.",
    bullets: [
      "Read last year's cutoff CGPA if the department publishes it",
      "A 0.2 CGPA gap is often a year of Saturday mornings, not a motivational quote",
      "Have a life in the branch you already have. Jumping is a probability, not a booking",
    ],
  },
  {
    title: "Leaving, dropping, or starting again",
    body: "Some students should leave. A course that needs a licence you do not want (and will not want after a real internship or ward visit) is a long expensive costume. A second attempt at NEET, JEE, CLAT, or CA Foundation can be rational if the age rule, the money, and a mock-score gate are on paper.\n\nDropping without a gate is how a year becomes a fog. Write: exam, target score by a date, living cost, and what happens if the score misses. If you cannot write those four, you are not dropping. You are fleeing.",
    bullets: [
      "Check age limits and attempt limits on the official bulletin this year, not a blog",
      "A parent-funded drop year is a household project. Put the budget on one page",
      "If mental health is the real subject, a counsellor beats a new entrance form. A course can wait a term. You cannot always",
    ],
  },
  {
    title: "Too early, too late",
    body: "Too early: week three of August, before you have attended a lab or failed a quiz honestly. Homesickness and a harsh teacher are not a syllabus.\n\nToo late: after you have already missed the branch-change window, missed the entrance notification, and collected enough backlogs that a new start is two problems. The middle — after first internals, before the form dates — is when adults make this decision.",
    bullets: [
      "Use the first internals as data, not as identity",
      "Put every relevant form date on one calendar in September",
      "If you stay, stay on purpose. Resentful attendance is still attendance, but it is a miserable way to buy a degree",
    ],
  },
];

const FOOD = [
  {
    title: "Mess is a system. Delivery is a mood",
    body: "Hostel mess exists so you do not have to cook after a 5 p.m. lab. It is repetitive. It is also usually the cheapest safe calories on campus. Students who abandon it in week two for fried snacks and midnight biryani meet October with less money and heavier sleep.\n\nIf the mess is actually unsafe or inedible, escalate with others, not with a private food app habit. And cook. A kettle and a pan are a skill. They are also how you stop treating hunger as an emergency.",
    bullets: [
      "Give the mess ten days before you declare war. First-week cooking is often chaos, not the real menu",
      "Carry a banana or roasted chana to class. Internals week is not the week to skip lunch",
      "Food poisoning is an attendance event. Choose vendors the campus already survived",
    ],
  },
  {
    title: "This book sits next to 99 Recipes",
    body: "AgamiPatha's 99 Cost-Effective Recipes for Bachelors is the kitchen companion: one-pan Indian food, photographs, and a price sense that fits a first-year transfer. This survival file tells you when to cook (mess closed, internals week, you are tired of oil) and how not to let cooking eat the syllabus.\n\nUse them as a pair. Survival without food is martyrdom. Recipes without a timetable is a hostel YouTube channel. Buy the recipes book if you will actually light a stove. Steal its shopping logic even if you only cook twice a week.",
    bullets: [
      "Cook on a schedule: two nights a week beats a doomed 'I will meal-prep Sundays'",
      "If the hostel bans induction or gas, believe the notice. Fines and fire are not internships",
      "Share a shop run with a roommate. Six onions are cheaper than six panic Maggi cups",
      "The recipes book is in the AgamiPatha store beside this one. Same publisher, same idea: first year should not be only mess and panic",
    ],
  },
];

const WORKSHEETS = [
  [
    "First 45 days",
    "Write: room number, warden name, medical room hours, mess timings, library hours, one classmate phone, one teacher email. If any line is blank after week two, that is the homework — not another series.",
  ],
  [
    "Attendance ledger",
    "Table: course code, classes held, classes you attended, percent, bunks remaining if 75 percent is the rule. Update every Friday. Circle any course under 80 percent in September.",
  ],
  [
    "Internals map",
    "For each course: mid-sem date, quiz dates, assignment due, lab record, viva, weight of each. Put the weights as a pie you can see. Then mark which slice you have already collected.",
  ],
  [
    "Syllabus in one sitting",
    "Pick the hardest course. Copy L-T-P, credits, prescribed book, unit names, and the three verbs that appear most in the outcomes. Star the unit you have not opened. Open it this week.",
  ],
  [
    "Hostel pact",
    "Sleep window, guests, food in the room, cleaning, borrowing. Sign it with a roommate or write it for yourself if you are alone. Revisit after the first fight, not during it.",
  ],
  [
    "Weekly money",
    "Transfer in, mess already paid, must-spend (printouts, travel home), play-spend. If play-spend ate must-spend last week, write what you will refuse this week.",
  ],
  [
    "Food and energy",
    "Seven days: breakfast, lunch, dinner, sleep time. Note two days you crashed. Pair those days with mess skip or delivery. Then pick two recipes from the bachelors cookbook you will actually cook.",
  ],
  [
    "Change-course page",
    "I want to leave / stay because: (facts from internals and attendance, not a mood). Official door: (branch change / transfer / new exam / stay). Date of the form. Money. Who I will tell this week. What I will do if the door is shut.",
  ],
  [
    "Who to tell",
    "Mentor, parent, warden, friend who attends class. For each: what they can actually do (signature, notes, a meal). Do not load one person with all four jobs.",
  ],
  [
    "Decision log",
    "Date, what you decided (stay, jump, drop, cook twice a week), evidence, review date in six weeks. First year rewards paper trails. Leave two blank dated lines.",
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
      Title: "First-year College Survival",
      Author: AUTHOR,
      Subject: "Hostel, attendance, internals, syllabi, and when to change course — for Indian first-year students",
      Keywords: "first year, hostel, attendance, internals, syllabus, college, India, AgamiPatha",
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
  doc.text("AGAMIPATHA  ·  FIRST YEAR", 52, 28, { width: WIDTH - 104, align: "left" });
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
  doc.fillColor("#f8f6ff").font("Display-Bold").fontSize(20);
  doc.text("First-year College Survival", 36, HEIGHT - 128, { width: WIDTH - 72 });
  doc.fillColor("#14d4e8").font("Book-Italic").fontSize(12);
  doc.text(compiled, 36, HEIGHT - 70, { width: WIDTH - 72 });
  doc.fillColor("#c4b6fb").font("Book").fontSize(9);
  doc.text("Hostel · attendance · internals · syllabus · when to change  ·  56 pages", 36, HEIGHT - 48, { width: WIDTH - 72 });
  doc.restore();
}

function titlePage(doc) {
  addInteriorPage(doc);
  mark("Title");
  doc.y = 100;
  doc.font("Book-Bold").fontSize(10).fillColor(PINK).text("AGAMIPATHA", { align: "center" });
  doc.moveDown(1.4);
  doc.font("Display-Bold").fontSize(24).fillColor(TEAL).text("First-year College Survival", { align: "center" });
  doc.moveDown(0.6);
  doc.font("Book-Italic").fontSize(13).fillColor(MUTED).text("Hostel, attendance, internals, how to read a syllabus, and when to change course — without losing the year to mess food and rumour.", { align: "center" });
  doc.moveDown(0.7);
  doc.font("Book-Bold").fontSize(12).fillColor(TEAL).text(compiled, { align: "center" });
  doc.moveDown(0.25);
  doc.font("Book").fontSize(9.5).fillColor(MUTED).text(copyright, { align: "center" });
  doc.moveDown(0.7);
  figure(doc, "ebook-planner.png", "A desk that holds a syllabus will outlast a desk that holds only delivery bags.");
  doc.moveDown(0.35);
  doc.font("Book").fontSize(11).fillColor(INK).text("Digital edition  ·  56 pages  ·  Companion to 99 Recipes for Bachelors", { align: "center" });
  doc.moveDown(0.85);
  callout(doc, "College rules differ. Confirm attendance, internships, and branch-change from your ordinance and this year's notice. This book is a workshop, not a university order.");
}

function copyrightPage(doc) {
  addInteriorPage(doc);
  mark("How to use this book");
  heading(doc, "How to use this book");
  para(
    doc,
    `First-year College Survival is a AgamiPatha digital edition, ${compiled.toLowerCase()}. ${copyright} You may print it for personal study. You may not sell the file or present it as official counselling.\n\nPair it with 99 Cost-Effective Recipes for Bachelors in the same store when the mess fails you. This file is the campus operating system: room, hours, marks, syllabus, and the decision to stay or leave. The recipes book is the kitchen. First year needs both more often than it needs another entrance rumour.\n\nWork in pencil. The attendance ledger and the change-course page are the product. A clean unread PDF is a brochure.`,
  );
  subhead(doc, "A six-week rhythm");
  bullets(doc, [
    "Week 1: Part I and the first-45-days worksheet — IDs, timings, one human in each course",
    "Week 2: Hostel pact and money page before the first UPI leak",
    "Week 3: Attendance ledger and internals map from the actual handouts",
    "Week 4: Read one full syllabus with a pen (Part V)",
    "Week 5: Food log; cook twice or make peace with the mess on purpose",
    "Week 6: After first internals, fill the change-course page even if you stay",
  ]);
  subhead(doc, "What this book will not do");
  para(
    doc,
    "It will not raise your CGPA by itself. It will not override a detained list. If you are unsafe, unwell, or being ragged, tell a warden, a parent, and a professional. A grade can wait a week. You cannot.",
  );
}

function writeLanding(doc) {
  currentPart = "Part I  ·  Arrival";
  partOpener(
    doc,
    "PART I",
    "The first 45 days",
    "Orientation is a brochure. The semester is a calendar.",
    "ebook-planner.png",
    "Write the clocks before you write your personality.",
  );
  mark("Part I  ·  The first 45 days");
  addInteriorPage(doc);
  drawRunningHeader(doc, currentPart);
  heading(doc, "You are not late, and you are not on holiday");
  mark("You are not late, and you are not on holiday", 1);
  para(
    doc,
    "First year in an Indian college is a new clock: lectures that start when the teacher arrives, labs that do not wait, a hostel gate that does. Board exam culture taught you a one-paper climax. College distributes the climax across internals, attendance, and a December paper you cannot cram in the old way.\n\nThe students who look effortless in March usually front-loaded August. They found the handbook. They sat in the second row once. They asked where the medical room was before they needed it.\n\nYou can still have a life. The life has to fit inside the ordinance. Read the ordinance.",
  );
  heading(doc, "Five numbers to collect in week one");
  mark("Five numbers to collect in week one", 1);
  bullets(doc, [
    "Attendance rule (percent, labs separate or not, medical window)",
    "Internal–end-sem split for each course",
    "Branch-change or migration window, if any",
    "Mess and gate timings",
    "Who signs a leave: mentor, HOD, warden",
  ]);
  callout(doc, "If a senior's advice contradicts a PDF, keep the PDF. Seniors are sometimes kind. They are not the exam cell.");
  heading(doc, "Homesickness is not a syllabus problem");
  mark("Homesickness is not a syllabus problem", 1);
  para(
    doc,
    "Week two is famous for it. Eat, sleep, attend, call home at a fixed time. Do not decide the rest of your life on a Sunday night in a dark room. If the sadness stays past a fortnight and you cannot attend, that is health. Use the campus counsellor or a trusted adult. Switching courses will not fix a sleep collapse.",
  );
}

function writeSections(doc, partLabel, opener, items, extra) {
  currentPart = partLabel;
  partOpener(doc, opener.kicker, opener.title, opener.blurb, opener.image, opener.caption);
  mark(opener.mark);
  addInteriorPage(doc);
  drawRunningHeader(doc, currentPart);
  if (extra) {
    extra(doc);
  }
  for (const item of items) {
    heading(doc, item.title);
    mark(item.title, 1);
    para(doc, item.body);
    if (item.bullets) {
      bullets(doc, item.bullets);
    }
  }
}

function writeWorksheets(doc) {
  currentPart = "Part VIII  ·  Worksheets";
  partOpener(
    doc,
    "PART VIII",
    "Write in the book",
    "A survival manual you do not mark is a brochure.",
    "ebook-planner.png",
    "Friday updates beat a guilty November.",
  );
  mark("Part VIII  ·  Write in the book");
  let index = 1;
  for (const [title, prompt] of WORKSHEETS) {
    addInteriorPage(doc);
    drawRunningHeader(doc, currentPart);
    doc.y = 58;
    heading(doc, `Worksheet ${index}  ·  ${title}`);
    mark(`Worksheet ${index}  ·  ${title}`, 1);
    para(doc, prompt);
    linedBlock(doc, 13);
    index += 1;
  }
}

function writeAppendix(doc) {
  currentPart = "Appendix";
  partOpener(doc, "APPENDIX", "Keep these open", "Copy them. Update them when notices change.");
  mark("Appendix  ·  Keep these open");
  addInteriorPage(doc);
  drawRunningHeader(doc, currentPart);
  heading(doc, "Usual first-year gates (confirm on your campus)");
  mark("Usual first-year gates", 1);
  bullets(doc, [
    "Attendance threshold and condonation dates",
    "Mid-sem and lab-record calendars",
    "Exam form last date — detained lists are silent until they are not",
    "Branch-change / internal sliding notice (often after first-year results)",
    "Supplementary / makeup exam fees",
    "Scholarship and income-certificate renewals if you hold one",
  ]);
  heading(doc, "Documents in one envelope");
  mark("Documents in one envelope", 1);
  bullets(doc, [
    "College ID, hostel ID, Aadhaar or other photo ID that matches the form name",
    "Fee receipts and allotment letter",
    "Class 12 marksheet — still asked in odd offices",
    "Medical book or insurance card if you have one",
    "Passport photographs in the size the office actually wants",
  ]);
  heading(doc, "A short letter to the student who wants to go home");
  mark("A short letter to the student who wants to go home", 1);
  para(
    doc,
    "Wanting to go home in September is common. Going home forever in September is a different sentence. Stay long enough to collect the five numbers, sit one internals cycle, and eat one week of mess on purpose. Then fill the change-course page with facts.\n\nIf the facts say leave, leave with a bulletin and a budget. If they say stay, stay with a ledger and a roommate pact. Either way, cook twice. The recipes book is waiting in the same store. You are allowed a life that includes dal.\n\nWhen you are ready for the longer map — what this degree can become — open AgamiPatha and walk from where you stand.",
  );
  heading(doc, "Colophon");
  para(
    doc,
    `Set as a 6 × 9 inch digital edition. ${copyright} Cover illustration commissioned for AgamiPatha. The file you downloaded after Razorpay checkout is yours to keep for personal study. Companion: 99 Cost-Effective Recipes for Bachelors.`,
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
    para(doc, "Overflow: a leave application draft, a teacher email, a shop list for the recipes book. Date the top line.");
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
  writeLanding(doc);
  writeSections(doc, "Part II  ·  Hostel", {
    kicker: "PART II",
    title: "Hostel",
    blurb: "A room is a factory. Run it like one.",
    image: "ebook-planner.png",
    caption: "The corridor is social. The desk is the degree.",
    mark: "Part II  ·  Hostel",
  }, HOSTEL);
  writeSections(doc, "Part III  ·  Attendance", {
    kicker: "PART III",
    title: "Attendance",
    blurb: "Percentages are gates. Spend misses like rupees.",
    image: "ebook-exams.png",
    caption: "A detained list does not care that you understood the unit.",
    mark: "Part III  ·  Attendance",
  }, ATTENDANCE);
  writeSections(doc, "Part IV  ·  Internals", {
    kicker: "PART IV",
    title: "Internals",
    blurb: "The semester you can still steer.",
    image: "ebook-exams.png",
    caption: "Mid-semesters are not small. They are early.",
    mark: "Part IV  ·  Internals",
  }, INTERNALS);
  writeSections(doc, "Part V  ·  Syllabus", {
    kicker: "PART V",
    title: "How to read a syllabus",
    blurb: "The PDF is a contract. The paper will quote it.",
    image: "ebook-planner.png",
    caption: "Verbs in the outcomes are verbs on the question paper.",
    mark: "Part V  ·  How to read a syllabus",
  }, SYLLABUS);
  writeSections(doc, "Part VI  ·  Change", {
    kicker: "PART VI",
    title: "When to change course",
    blurb: "A door with a date beats a mood with a suitcase.",
    image: "ebook-streams.png",
    caption: "Stay or leave on purpose. Resentment is not a plan.",
    mark: "Part VI  ·  When to change course",
  }, CHANGE);
  writeSections(doc, "Part VII  ·  Food", {
    kicker: "PART VII",
    title: "Mess, stove, recipes",
    blurb: "Hunger is an attendance event. Cook on a calendar.",
    image: "recipe-lunch.png",
    caption: "The bachelors cookbook is the other half of this kit.",
    mark: "Part VII  ·  Mess, stove, recipes",
  }, FOOD);
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
    throw new Error(`Cover image missing at ${coverPath}. Run stamp-covers.js first.`);
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
