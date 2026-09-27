const fs = require("fs");
const path = require("path");
const PDFDocument = require("pdfkit");
const { registerBookFonts } = require("./fonts");
const { AUTHOR, compiled, copyright } = require("./credit");
const { createTocState, estimateTocPages, reserveTocPages, fillTocPages, discardStream } = require("./toc");

const WIDTH = 432;
const HEIGHT = 648;
const TARGET_PAGES = 100;
const INK = "#160e3d";
const TEAL = "#4f2bff";
const PINK = "#ff2d92";
const MUTED = "#5a5480";
const PAPER = "#f8f6ff";

const root = path.resolve(__dirname, "..", "..");
const coverPath = path.join(root, "api", "Store", "career-path-planner-cover.png");
const artDir = path.join(root, "api", "Store", "art");
const outPath = path.join(root, "api", "Store", "career-path-planner.pdf");

const STREAMS = [
  {
    title: "PCM — Physics, Chemistry, Mathematics",
    image: "ebook-pcm.png",
    caption: "PCM is a workshop: numbers, models, and experiments you can explain.",
    body: "PCM is the most crowded Class 12 route in India because it keeps engineering, architecture, defence, pure science, and many design-adjacent doors open. It is not the only intelligent choice. It is the right choice when you can sit with numbers for two years without dreading every problem set.\n\nA strong PCM student is not the one who memorizes formulae. It is the one who can explain why a beam bends, why an acid reacts, and how a limit becomes a slope. Entrance exams reward that habit.\n\nTypical next hops: JEE Main and Advanced, state CETs, BITSAT, NATA for architecture, NDA, and later GATE if you stay in engineering. Cost bands vary wildly: a government B.Tech can be modest; a private campus can run into several lakhs a year.\n\nProtect your Class 12 board marks. Many state counselling processes still use them. Do not treat boards as a distraction from JEE — treat them as a second exam that uses the same syllabus.",
    bullets: [
      "Daily: 1 timed maths paper + 1 physics numerical block",
      "Weekly: one full mock and a written error log",
      "Keep chemistry NCERT line-by-line; it is still the cheapest mark bank",
      "If maths is a struggle by October of Class 11, add a tutor or change the target",
    ],
  },
  {
    title: "PCB — Physics, Chemistry, Biology",
    image: "ebook-pcb.png",
    caption: "PCB is a living syllabus: bodies, plants, and the clinic at the end of the road.",
    body: "PCB is the clinical corridor: MBBS, BDS, BAMS, BHMS, B.Sc Nursing, physiotherapy, pharmacy, biotechnology, and a growing set of allied-health degrees. NEET UG is the gate for the medical college seats. It is a rank exam, not a pass-fail exam, which means your relative standing matters more than a raw score.\n\nBiology in NEET is still rooted in NCERT. Students who treat the textbook as optional lose easy marks. Physics and chemistry decide the rank once biology is saturated.\n\nIf you want medicine but cannot face six years plus internship plus residency, write that down now. Nursing, physiotherapy, and optometry are not consolation prizes; they are licensed professions with their own dignity and demand.\n\nA PCB student who later wants engineering will usually need mathematics. Do not drop maths casually if you are undecided between medicine and research.",
    bullets: [
      "Read NCERT biology twice before any reference book",
      "Keep a diagram notebook — examiners love labelled figures",
      "Plan a drop year only with a written budget and a mock-score gate",
      "Visit one hospital or clinic before you lock MBBS as identity",
    ],
  },
  {
    title: "Commerce — Accounts, Business, Economics",
    image: "ebook-commerce.png",
    caption: "Commerce starts in a real shop and ends in a ledger someone else will trust.",
    body: "Commerce is the language of firms, tax, and markets. It leads to CA, CS, CMA, B.Com, BBA, economics honours, banking, and a large private-sector hiring pool. The mistake is to treat it as the 'easy stream'. Accounts is a craft. Economics is a way of seeing trade-offs. Business studies is only useful if you can connect it to a real shop or a listed company.\n\nCA Foundation can be attempted after Class 12. Many students begin coaching in Class 11. That is optional. What is not optional is comfort with journals, ledgers, and GST at a basic level.\n\nCUET has become a major door to central universities for B.Com and BBA. State universities still run their own merit lists. Keep both calendars.\n\nIf you dislike sitting with numbers but like people and stories, commerce can still work through marketing, HR, and operations — but you will need internships to prove it.",
    bullets: [
      "Maintain a mock ledger for a fictional kirana shop",
      "Read one company annual-report summary each month",
      "Decide CA / CS / CMA / campus degree by the winter of Class 12",
      "Learn spreadsheets early; they are the workshop of this stream",
    ],
  },
  {
    title: "Arts / Humanities — History, Political Science, Languages, Psychology",
    image: "ebook-arts.png",
    caption: "Arts is a reading life: arguments, stories, and public rooms.",
    body: "Arts is the most misunderstood stream in Indian families. It is the native route to law, civil services, journalism, design theory, teaching, psychology, social work, and a wide range of public-policy roles. It is not a leftover stream. It is a reading stream.\n\nCLAT and other law tests sit on comprehension, legal reasoning, and current affairs. UPSC is years away, but the reading habit starts now. Psychology and economics combinations are increasingly useful.\n\nThe risk in Arts is vagueness. 'I will do something in humanities' is not a plan. Name a profession, a degree, and an exam. Then the stream becomes a tool instead of a fog.\n\nLanguages, if you are strong in one, can become translation, content, teaching, or the foreign-service language papers later. Do not abandon a language you actually love.",
    bullets: [
      "Read one quality newspaper editorial every day, on paper if you can",
      "Write 200 words of summary, not highlight-and-forget",
      "Pair the stream with a concrete degree: BA LLB, BA Economics, B.Des, B.El.Ed",
      "Build a portfolio of essays or design work by Class 12",
    ],
  },
];

const EXAMS = [
  {
    title: "JEE Main and Advanced",
    body: "JEE Main is the gateway to NITs, IIITs, and GFTIs, and the qualifier for JEE Advanced. Advanced is the IIT door. Both are now computer-based. Dates usually fall in two Main sessions (often January and April) and Advanced in May or June.\n\nThe syllabus is Class 11 and 12 PCM. Students who skip Class 11 gravely and try to 'finish the course' in Class 12 repeat the same chapters under panic. A saner plan is to close Class 11 by February of that year and spend Class 12 on revision plus mocks.\n\nRank matters more than marks. A 99 percentile in Main is a different world from 95. Know the previous-year opening ranks for the branches you actually want, not the branches your relatives want.\n\nState CETs (MHT CET, KCET, EAMCET, WBJEE, and others) are parallel doors. Many good careers never touch an IIT campus. Write those doors on your calendar so one bad Main day does not feel like the end of engineering.",
  },
  {
    title: "NEET UG",
    body: "NEET UG is a single-day, pen-and-paper exam for MBBS, BDS, and several other medical seats. It uses Physics, Chemistry, and Biology from the NCERT-centred syllabus. Cut-offs move every year with the paper and the candidate count.\n\nCounselling is a second exam. AIQ and state quotas, category ranks, and bond rules can matter as much as the score. Read the information bulletin the week it is published. Families lose seats to paperwork more often than they admit.\n\nA drop year is common. It is also expensive in money and mood. Set a mock-score gate in December. If you are not near last year's cut-off band by then, revisit nursing, physiotherapy, pharmacy, or a B.Sc route instead of drifting into a second unfocused drop.",
  },
  {
    title: "CUET UG",
    body: "CUET UG is the common door to many central universities and a growing list of other campuses. It is domain-subject plus language plus a general test, depending on the programme. That means your Class 12 subjects suddenly matter for admissions that once used only board percentages.\n\nPick universities before you pick papers. A student who wants B.A. (Hons) Political Science at one campus and B.Com at another may need different domain tests. The information bulletin is dull and mandatory.\n\nCUET does not replace every state process. Keep your home-state university calendar anyway.",
  },
  {
    title: "CLAT and law admissions",
    body: "CLAT feeds the National Law Universities for the five-year B.A. LL.B. Other tests (AILET, SLAT, state law CETs) sit beside it. The paper rewards reading speed, legal aptitude, logical reasoning, and quantitative techniques at a modest level.\n\nYou do not need Class 12 law coaching for years. You need comprehension practice and a habit of reading judgments in plain English summaries. Current affairs help, but they are not a GK dump.\n\nLaw is a profession of language and stamina. If you dislike reading for two hours, believe that signal.",
  },
  {
    title: "CA, CS, and CMA",
    body: "These are institute-run professional routes, not campus degrees — though many students do both. CA Foundation, Intermediate, and Final are staged. So are CS and CMA. Pass percentages are low because the standard is a working professional's standard, not a college internal.\n\nArticleship is the real classroom. A rank without articleship discipline is an incomplete qualification. Talk to two articled assistants before you treat the prospectus as destiny.\n\nFoundation after Class 12 is the common entry. Direct entry exists for graduates under institute rules. Confirm the current ICAI / ICSI / ICMAI notification; they change.",
  },
  {
    title: "NDA, CDS, and defence academies",
    body: "NDA is open after Class 12 for the Army, Navy, and Air Force wings, with UPSC written papers and Services Selection Board. CDS is the graduate door. NDA is not a backup for students who missed JEE. It is a service career with its own physical, medical, and character filters.\n\nWritten marks get you to SSB. SSB looks at Officer-Like Qualities over five days. Coaching can familiarise you with the format. It cannot invent a personality you have not practised in school — responsibility, teamwork, and clear speech.\n\nMedical standards are strict, especially for flying branches. Get an honest medical read early if that is the dream.",
  },
  {
    title: "NATA, NID, NIFT, and design",
    body: "Architecture uses NATA or JEE Paper 2 depending on the campus. Design uses NID DAT, UCEED, NIFT, and a swarm of private tests. Portfolios matter more here than in engineering. A sketchbook you have used for a year beats a two-week crash course.\n\nDesign is not 'drawing pretty things'. It is problem-solving with form, material, and user. If you cannot explain a chair you redesigned, you are not ready for the studio critique culture.",
  },
  {
    title: "GATE, CAT, and later-life exams",
    body: "Some exams arrive after a degree. GATE is the M.Tech and many PSU door. CAT, XAT, and SNAP are MBA doors. UPSC CSE is a graduate exam with a long runway. You do not need to decide them in Class 10. You do need to know they exist so you do not treat the first degree as the last credential.\n\nThe healthy stance: pick a first profession you can enter, then keep one later exam as an option, not an identity.",
  },
];

const PROFESSIONS = [
  ["Software engineer", "PCM or later lateral entry", "B.Tech / B.Sc CS, then internships", "JEE / CET / CUET", "You turn problems into running systems. The job is less about typing and more about clarifying requirements, testing, and living with other people's code. A GitHub trail and one shipped project beat a certificate pile."],
  ["Data analyst / data scientist", "PCM or Commerce with maths", "B.Tech, B.Stat, B.Sc Maths/Eco, then projects", "JEE / CUET / ISI / later GATE", "You clean messy tables until a decision becomes obvious. SQL, spreadsheets, and one plotting tool will take you further than a fashionable course title."],
  ["Doctor (MBBS)", "PCB", "NEET, MBBS, internship, then PG", "NEET UG, later NEET PG", "You will spend a decade becoming useful. Night duty, paperwork, and uncertainty are the job, not a side effect. Shadow a resident before you romanticise the white coat."],
  ["Dentist", "PCB", "NEET, BDS, internship", "NEET UG", "Dentistry is a fine-motor clinical craft with a private-practice path. Manual skill and patient talk matter as much as biology ranks."],
  ["Nurse", "PCB or vocational nursing", "B.Sc Nursing or GNM, then registration", "State / national nursing tests", "Nursing is licensed, mobile, and in global demand. It is clinical work, not a fallback. Night shifts are real; so is the chance to specialise."],
  ["Physiotherapist", "PCB", "BPT, internship, then a clinic or hospital", "State / university admissions", "You rebuild movement after injury. Empathy plus anatomy. Sports teams, ICUs, and neighbourhood clinics all hire."],
  ["Pharmacist", "PCM or PCB", "B.Pharm or D.Pharm, then registration", "State CETs / GPAT later", "You sit at the junction of chemistry, regulation, and patient safety. Retail, hospital, and industry are different lives — pick one to sample."],
  ["Civil servant", "Any stream, then a graduate degree", "Bachelor's, then UPSC or state PSC", "UPSC CSE / state PSC", "You administer rules, money, and conflict. The exam is a reading marathon. The job is a people marathon. Intern with a local office if you can."],
  ["Lawyer", "Any stream; Arts helps", "Five-year BA LLB or 3-year LLB after graduation", "CLAT / AILET / state tests", "You write, argue, and wait. Litigation, firms, and counsel work feel different. Court internships in the second year tell the truth faster than brochures."],
  ["Chartered accountant", "Commerce preferred", "Foundation, Intermediate, articleship, Final", "ICAI exams", "You attest numbers other people will spend. Articleship is the forge. Tax season will test sleep and accuracy together."],
  ["Company secretary", "Commerce preferred", "CS programme plus training", "ICSI exams", "You keep a company legal and governed. Board work, filings, and the Companies Act are the craft."],
  ["Banker", "Any graduate stream", "B.Com / BBA / any degree plus bank tests", "IBPS / SBI / RBI / campus", "Retail, credit, and markets are three jobs. Public-sector exams are a process; private banks hire for talk and targets."],
  ["Architect", "PCM", "NATA or JEE Paper 2, then B.Arch", "NATA / JEE", "Studio culture, models, and late plots. You design spaces people inhabit. Site visits teach more than renders."],
  ["Civil engineer", "PCM", "B.Tech Civil", "JEE / CET", "Bridges, water, and housing. Sites are dusty and political. If you hate being outdoors, this is a mismatch."],
  ["Mechanical engineer", "PCM", "B.Tech Mechanical", "JEE / CET", "Machines, heat, and manufacture. Core plants still hire; so do auto and robotics if you add projects."],
  ["Electrical engineer", "PCM", "B.Tech Electrical / ECE", "JEE / CET", "Power, chips, and embedded systems. Lab work and safety habits matter. A microcontroller project is a better story than a generic workshop."],
  ["Commercial pilot", "PCM, medical standards", "CPL through a flying school, plus DGCA papers", "Class 1 medical, school tests", "Expensive, regulated, and schedule-heavy. Get the medical first. Then talk to two first officers about debt and simulators."],
  ["Teacher", "Any stream", "B.El.Ed, B.Ed, or subject Master's plus TET", "CTET / state TET", "You design other people's attention. It is performance plus planning. Classroom internships in year one, not after the degree."],
  ["Journalist", "Arts or any stream", "B.A. Journalism / mass comm, plus clips", "CUET / university tests", "You report, not recycle. A published piece in a college paper is worth more than a media-degree brochure. Ethics are the job."],
  ["UX / product designer", "Any stream; design tests help", "B.Des or a strong portfolio path", "NID / UCEED / NIFT", "You watch people fail at software and fix the path. User tests beat opinions. Keep a case-study notebook."],
  ["Fashion designer", "Any stream", "NIFT / private fashion degrees", "NIFT / campus", "Pattern, cloth, and cost. Fashion week photos are marketing. The work is sampling and vendor calls."],
  ["Hotel / hospitality manager", "Any stream", "BHM / hospitality degrees", "NCHMCT / campus", "Shifts, guests, and operations. Internships in a working hotel will confirm or kill the romance in one summer."],
  ["Psychologist", "Arts or Science with psychology", "B.A./B.Sc Psychology, then Master's and licence path", "CUET / university", "Listening is trained, not innate. Clinical work needs further study. School and HR roles exist earlier."],
  ["Scientist / researcher", "PCM or PCB", "B.Sc / Integrated M.Sc / B.Tech, then NET or PhD", "NEST / IAT / JEE / GATE / NET", "You live with unanswered questions. Labs are slow. Publish a student poster before you decide academia is the life."],
  ["Veterinarian", "PCB", "NEET or state vet admissions, B.V.Sc", "NEET / state", "Animals, rural postings, and clinics. If you only like puppies and not livestock, say so early."],
  ["Armed forces officer", "PCM for NDA technical; any for some entries", "NDA, CDS, or technical entries", "UPSC NDA / CDS / SSB", "Command, risk, and service. Fitness is not optional. Family mobility is part of the contract."],
  ["Entrepreneur", "Any stream", "No single degree; a first skill plus a customer", "None required", "You sell before you scale. Keep a day job or a tiny service until one customer pays twice. Accounts still matter."],
  ["Actuary", "PCM or Commerce with maths", "ACET plus institute papers", "ACET / IAI", "Probability as a career. Insurance and risk. It is a long paper trail. Love maths or walk away."],
  ["Physical education / sports coach", "Any stream; science helps", "B.P.Ed / sports science, plus federation licences", "University / NIS pathways", "Training plans, injuries, and patience. Playing was the hobby. Coaching is pedagogy."],
  ["Social worker", "Arts or any stream", "BSW / MSW", "University", "You work at the edge of policy and a family's worst week. NGOs and CSR teams hire. Burnout is occupational — plan rest."],
];

const WORKSHEETS = [
  ["Values inventory", "Write ten things you refuse to give up (city, income floor, creativity, service, status, outdoor work, nights off). Circle the three you will not trade. Every later choice must honour at least two."],
  ["Energy log", "For seven days, note two hours when you felt quick and two hours when you felt dull. Careers are energy systems. Do not pick a night-shift life if your log is empty after 9 p.m."],
  ["Subject truth", "Rank Physics, Chemistry, Maths, Biology, Accounts, History, and Language from 1 to 7 by enjoyment, not marks. Then rank them again by last exam marks. Where the two lists disagree, you have a story to investigate."],
  ["Family map", "List the careers your family keeps naming. Beside each, write their reason and your reason. If both columns are empty, the name is noise."],
  ["Money ceiling", "Ask a parent or guardian the real annual fee they can pay without loans, with loans, and not at all. Write three numbers. A plan that needs a fourth number is a fantasy."],
  ["Stream comparison", "Draw four columns: PCM, PCB, Commerce, Arts. For each, write one profession, one exam, one fear, one cost. The stream with a fear you can live with is more useful than the stream with a glamour you cannot fund."],
  ["Exam calendar", "Pick three exams. Write notification month, form month, exam month, and result month. Leave a row for the official URL. Update it when the bulletin drops."],
  ["Mock score gate", "Write the exam, today's mock score, the score you need by 1 December, and the score you need by 1 March. If December misses, the plan changes — you do not just 'try harder' in the same shape."],
  ["Week grid", "Seven rows, four columns: morning deep work, school, evening practice, sleep. Fill one real week. If sleep is the leftover, the plan will fail in January."],
  ["Error log", "After every mock, write five rows: question, concept, silly or conceptual, time lost, next drill. Review every Sunday. This page is worth more than a new book."],
  ["Campus shortlist", "Ten campuses. For each: fees, city, median placement or licence outcome, and one thing you dislike. Dislike is information."],
  ["People to ask", "Five humans who do the job you want. Write how you will reach them and one question that is not 'how is the salary?'."],
  ["Internship hunt", "Twenty firms or clinics. Status: not written, written, replied, rejected, offered. Start this in Class 12 winter even if the internship is next year."],
  ["Skill stack", "Three skills you will be able to demonstrate in 90 days (for example: Tally, Python, a published article, a 5 km run for NDA). Demonstration beats intention."],
  ["Backup path", "If the first exam fails, what is path B that still uses this year's work? Write it now so panic does not invent a worse one."],
  ["Health ledger", "Eyes, back, sleep, and one sport. A two-year exam plan that ignores the body is a plan to get sick in the last month."],
  ["Phone rules", "Write the hours the phone lives in another room. Write the one app you will delete during mocks. Social feeds are designed to beat your plan."],
  ["Scholarship hunt", "Five schemes (NSP, state, campus, private). Deadline and documents. A scholarship is a part-time job with a form."],
  ["Decision log", "Date, choice, reasons, who was in the room, what you will review in six months. Future-you deserves a paper trail."],
  ["First-year campus kit", "If you get the seat: hostel, travel, laptop, and one adult you can call at 11 p.m. Write names, not vibes."],
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
      Title: "Career Path Planner",
      Author: AUTHOR,
      Subject: "A 100-page career planning ebook for Indian students",
      Keywords: "career, India, JEE, NEET, CUET, Class 10, Class 12",
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
  doc.text("AGAMIPATHA  ·  CAREER PATH PLANNER", 52, 28, { width: WIDTH - 104, align: "left" });
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
  doc.fillColor("#f8f6ff").font("Display-Bold").fontSize(26);
  doc.text("Career Path Planner", 36, HEIGHT - 128, { width: WIDTH - 72 });
  doc.fillColor("#14d4e8").font("Book-Italic").fontSize(12);
  doc.text(compiled, 36, HEIGHT - 70, { width: WIDTH - 72 });
  doc.fillColor("#c4b6fb").font("Book").fontSize(9);
  doc.text("From Class 10 to your first profession  ·  100 pages", 36, HEIGHT - 48, { width: WIDTH - 72 });
  doc.restore();
}

function titlePage(doc) {
  addInteriorPage(doc);
  mark("Title");
  doc.y = 120;
  doc.font("Book-Bold").fontSize(10).fillColor(PINK).text("AGAMIPATHA", { align: "center" });
  doc.moveDown(1.4);
  doc.font("Display-Bold").fontSize(28).fillColor(TEAL).text("Career Path Planner", { align: "center" });
  doc.moveDown(0.6);
  doc.font("Book-Italic").fontSize(13).fillColor(MUTED).text("A stepwise map of Indian education routes,\nexams, professions, and weekly practice.", { align: "center" });
  doc.moveDown(0.7);
  doc.font("Book-Bold").fontSize(12).fillColor(TEAL).text(compiled, { align: "center" });
  doc.moveDown(0.25);
  doc.font("Book").fontSize(9.5).fillColor(MUTED).text(copyright, { align: "center" });
  doc.moveDown(0.9);
  figure(doc, "ebook-streams.png", "Four streams, four colours — pick a syllabus you can inhabit.");
  doc.moveDown(0.6);
  doc.font("Book").fontSize(11).fillColor(INK).text("Digital edition  ·  100 pages  ·  For Class 10 to first job", { align: "center" });
  doc.moveDown(1.2);
  callout(doc, "Confirm every exam date, fee, and eligibility from the official bulletin. This book is a planner, not a counselling order or a guarantee of a seat.");
}

function copyrightPage(doc) {
  addInteriorPage(doc);
  mark("Copyright and how to use this book");
  heading(doc, "Copyright and how to use this book");
  para(
    doc,
    `Career Path Planner is a AgamiPatha digital edition, ${compiled.toLowerCase()}. ${copyright} You may print it for personal study. You may not sell the file, upload it as a course, or present it as official counselling.\n\nDates move. Institutes rewrite rules. A page that was right in March can be wrong in April. Whenever this book names an exam, treat the sentence as a prompt to open the current information bulletin.\n\nWork the worksheets in pencil. The value of the book is not that it is 100 pages long. The value is that page 67 still has your handwriting on it in November.`,
  );
  subhead(doc, "A simple weekly rhythm");
  bullets(doc, [
    "Monday: one hour on the path you chose — syllabus or skill, not browsing",
    "Wednesday: one conversation or one official page, written down",
    "Friday: one mock, drill, or portfolio artefact",
    "Sunday: fifteen minutes on the decision log and the week grid",
  ]);
  subhead(doc, "What this book will not do");
  para(
    doc,
    "It will not pick a stream for you. It will not promise an IIT, an MBBS seat, or a campus package. It will not replace a licensed counsellor if you are in distress. If studies have become a health problem, talk to a trusted adult and a professional. A career plan can wait a week. You cannot.",
  );
}

function writeStreams(doc) {
  currentPart = "Part I  ·  Streams";
  partOpener(
    doc,
    "PART I",
    "Streams and the first fork",
    "Class 11 is a door, not a personality. Choose a syllabus you can inhabit for two years.",
    "ebook-streams.png",
    "The first real choice is which two-year workshop you will sit in.",
  );
  mark("Part I  ·  Streams and the first fork");
  addInteriorPage(doc);
  drawRunningHeader(doc, currentPart);
  heading(doc, "The Indian education spine");
  mark("The Indian education spine", 1);
  para(
    doc,
    "Almost every formal Indian career still walks a familiar spine: Class 10, a Class 12 stream, an entrance or merit list, a degree or diploma, then a licence, articleship, internship, or first job. The spine is not oppression. It is a map. You can step off it — open-source careers, sport, family business, creative work — but you should step off it on purpose.\n\nAgamiPatha exists to show the stepwise version of that map: what comes after Metric, what a given profession usually expects, and which exams sit on the road. This book is the paper companion. Use the site to expand a path; use these pages to decide which path is yours.\n\nThree mistakes show up in every school year. The first is choosing a stream to impress a relative. The second is choosing a stream to avoid a subject you could learn with help. The third is choosing no stream at all and waiting for Class 12 summer. Start the conversation in Class 10 winter.",
  );
  heading(doc, "Class 10 is a sorting year, not a verdict");
  mark("Class 10 is a sorting year, not a verdict", 1);
  para(
    doc,
    "Boards matter because they are a common language. They do not measure curiosity, stamina, or kindness — the traits that keep a profession alive at thirty. Treat Class 10 as a fitness test: can you finish a syllabus, sit an exam, and recover?\n\nIf a subject collapsed this year, ask whether the cause was teaching, attendance, language, or dislike. Those four causes want four different next moves. A tutor fixes the first. A timetable fixes the second. A medium-of-instruction change is rarer and serious. Dislike, if it survives honest effort, is data for the stream choice.",
  );
  for (const stream of STREAMS) {
    heading(doc, stream.title);
    mark(stream.title, 1);
    figure(doc, stream.image, stream.caption);
    para(doc, stream.body);
    bullets(doc, stream.bullets);
  }
}

function writeExams(doc) {
  currentPart = "Part II  ·  Exams";
  partOpener(
    doc,
    "PART II",
    "Entrance exams without mythology",
    "An exam is a filter with a date. Learn the filter, then practise the date.",
    "ebook-exams.png",
    "Papers are weather. A mock schedule is climate.",
  );
  mark("Part II  ·  Entrance exams without mythology");
  addInteriorPage(doc);
  drawRunningHeader(doc, currentPart);
  heading(doc, "How to read any information bulletin");
  mark("How to read any information bulletin", 1);
  figure(doc, "ebook-exams.png", "Read the bulletin. WhatsApp forwards are not a syllabus.");
  para(
    doc,
    "Every serious Indian entrance exam publishes a bulletin: eligibility, pattern, fees, cities, and rules for calculators, dress, and documents. Students lose years to WhatsApp forwards. The bulletin is boring on purpose. Read the contents page, the eligibility, the pattern, and the important dates. Write those four onto the exam-calendar worksheet later in this book.\n\nA healthy exam plan has three layers. Layer one is the official syllabus. Layer two is a question bank you will finish. Layer three is a mock schedule you will not negotiate away in January. Books you will not finish are furniture.",
  );
  for (const exam of EXAMS) {
    heading(doc, exam.title);
    mark(exam.title, 1);
    para(doc, exam.body);
  }
}

function writeProfessions(doc) {
  currentPart = "Part III  ·  Professions";
  partOpener(
    doc,
    "PART III",
    "Thirty professions, written plainly",
    "A profession is a repeated week, not a title on a wedding card.",
    "ebook-professions.png",
    "Titles fade. The weekly texture stays.",
  );
  mark("Part III  ·  Thirty professions, written plainly");
  addInteriorPage(doc);
  drawRunningHeader(doc, currentPart);
  heading(doc, "How to use these sketches");
  mark("How to use these sketches", 1);
  para(
    doc,
    "Each sketch names a typical school stream, a training route, the exams that usually sit on the road, and the texture of the work. Typical is not mandatory. Doctors have entered from unusual routes; engineers have become civil servants; commerce graduates write software. Use the sketch as a default spine, then check AgamiPatha or an official site for the exact hops.\n\nWhen a sketch mentions cost or years, treat the numbers as order-of-magnitude. Private flying schools and private medical seats can be an order higher than government ones. Always ask for this year's prospectus.",
  );
  const professionArt = {
    "Software engineer": ["ebook-pcm.png", "Engineering work is built things, not just marks."],
    "Doctor (MBBS)": ["ebook-pcb.png", "Clinical lives are night duty and paperwork as much as the coat."],
    "Chartered accountant": ["ebook-commerce.png", "Accounts is a craft other people will spend."],
    Lawyer: ["ebook-arts.png", "Law is a reading and waiting profession."],
    Teacher: ["ebook-internship.png", "Teaching is designed attention, rehearsed in real rooms."],
  };
  for (const [name, stream, route, exams, texture] of PROFESSIONS) {
    heading(doc, name);
    mark(name, 1);
    const art = professionArt[name];
    if (art) {
      figure(doc, art[0], art[1]);
    }
    para(doc, texture);
    bullets(doc, [`Usual school door: ${stream}`, `Training spine: ${route}`, `Exams you will actually meet: ${exams}`]);
    para(
      doc,
      `A practical next step this month: speak to one person who does this work, and write five lines about a day they described — not the day you imagined. If you cannot find a person, read one official regulator page (NMC, BCI, ICAI, DGCA, AICTE, NCTE) and write what surprised you. Then add the profession to your shortlist or cross it off in the decision log. Either result is progress.\n\nCommon misfit: wanting the status of ${name.toLowerCase()} and disliking the weekly texture above. Status fades by the third year of training. Texture stays. If the texture feels like a tax you will resent, keep looking. If it feels like a sport you could lose track of time inside, keep this page marked.`,
    );
  }
}

function writeExecution(doc) {
  currentPart = "Part IV  ·  Execution";
  partOpener(
    doc,
    "PART IV",
    "Plans that survive November",
    "Motivation is a weather system. Systems are climate.",
    "ebook-planner.png",
    "Write the year as four quarters, not as 365 days of grit.",
  );
  mark("Part IV  ·  Plans that survive November");
  addInteriorPage(doc);
  drawRunningHeader(doc, currentPart);
  heading(doc, "A twelve-month shape");
  mark("A twelve-month shape", 1);
  para(
    doc,
    "If you are in Class 10, the next twelve months are stream choice, board revision, and one skill you can show. If you are in Class 11, they are syllabus completion and a first mock baseline. If you are in Class 12, they are mocks, forms, and a written backup. If you are in the first year of college, they are internships and not losing the thread of why you came.\n\nWrite the year as four quarters, not as 365 days of grit. Quarter one: close the last syllabus hole. Quarter two: raise mock frequency. Quarter three: forms, documents, and sleep. Quarter four: the exam and the counselling paperwork. Reward the quarter, not the mood of a Tuesday.",
  );
  heading(doc, "Money, loans, and scholarships");
  mark("Money, loans, and scholarships", 1);
  para(
    doc,
    "A career that bankrupts the household is a household event, not a personal brand. Sit with the money-ceiling worksheet before you fall in love with a private campus brochure. Education loans are tools. They are also EMIs during your first salary years. Ask what happens if the placement median is half the brochure number.\n\nNational Scholarship Portal, state minority and merit schemes, and campus waivers exist. They need documents you should gather in Class 11: ID, income, caste or EWS papers if they apply, and marksheets in one envelope.",
  );
  heading(doc, "Internships and the first job");
  mark("Internships and the first job", 1);
  figure(doc, "ebook-internship.png", "The first workplace is a rehearsal, not a verdict.");
  para(
    doc,
    "The first job is rarely the dream job. It is proof you can finish work other people needed. Internships are the rehearsal. Write twenty names on the internship worksheet. Send ten polite emails. Expect silence. Send ten more. A two-week shadow at a clinic, a CA office, a newsroom, or a small software shop will teach more than a winter of highlight reels.\n\nResumes for students are one page. Education, two projects, one responsibility, skills you can demonstrate. The resume starter kit in the AgamiPatha store is a template. This paragraph is the rule: do not invent responsibilities you cannot talk about for two minutes.",
  );
  heading(doc, "When to change course");
  mark("When to change course", 1);
  para(
    doc,
    "Change course when two of these three are true for a full term: your mocks are not moving, your body is getting worse, and you cannot describe why you still want the destination. One bad month is weather. Three bad months with no experiment (tutor, sleep, target change) is a plan that needs rewriting.\n\nChanging course is not failure if you take the skills with you. A NEET year still taught you biology. A JEE year still taught you sitting with hard problems. Write what transfers on the backup-path worksheet so the year is not emotionally wasted.",
  );
  heading(doc, "Parents, relatives, and noise");
  mark("Parents, relatives, and noise", 1);
  para(
    doc,
    "Most Indian career fights are love wearing the wrong costume. A parent who pushes engineering may be pushing safety. Hear the safety. Then show a funded, examined alternative. A vague 'I want to do something creative' loses to a concrete 'NIFT + this fee + this backup B.Com'. Paper beats volume at the dinner table.\n\nRelatives who have not held the job should get a time limit in the conversation, not a veto.",
  );
}

function writeWorksheets(doc) {
  currentPart = "Part V  ·  Worksheets";
  partOpener(
    doc,
    "PART V",
    "Write in the book",
    "A planner you do not mark is a brochure.",
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
    doc.moveDown(0.3);
    for (let line = 0; line < 14; line += 1) {
      needSpace(doc, 22);
      doc.moveTo(52, doc.y).lineTo(WIDTH - 52, doc.y).strokeColor("#c4b6fb").lineWidth(0.6).stroke();
      doc.y += 20;
    }
    index += 1;
  }
}

function writeAppendix(doc) {
  currentPart = "Appendix";
  partOpener(doc, "APPENDIX", "Lists you can keep open", "Copy these into your own notebook and update them when bulletins change.");
  mark("Appendix  ·  Lists you can keep open");
  addInteriorPage(doc);
  drawRunningHeader(doc, currentPart);
  heading(doc, "Usual exam windows (confirm every year)");
  mark("Usual exam windows", 1);
  bullets(doc, [
    "JEE Main — often two sessions, winter and spring",
    "JEE Advanced — early summer, after Main",
    "NEET UG — early summer",
    "CUET UG — late spring / early summer",
    "CLAT — late year for the next academic cycle",
    "CA Foundation — mid-year and year-end windows",
    "NDA — two UPSC windows, then SSB",
    "NATA — multiple cycles; check the Council of Architecture",
    "NID / UCEED / NIFT — winter applications, winter–spring tests",
    "GATE — winter, for graduates",
    "CAT — late year, for graduates",
  ]);
  heading(doc, "Documents to keep in one folder");
  mark("Documents to keep in one folder", 1);
  bullets(doc, [
    "Class 10 marksheet and passing certificate",
    "Class 12 admit card and later marksheet",
    "Photo ID that matches the application name exactly",
    "Passport photographs in the size the bulletin asks",
    "Category / EWS / PwD certificates if they apply, still valid",
    "Income certificate dated as required",
    "A scanned PDF set under 200 KB each before form season",
  ]);
  heading(doc, "A short letter to the tired student");
  mark("A short letter to the tired student", 1);
  para(
    doc,
    "If you are reading this at midnight after a mock that went badly, close the rank predictor. Sleep. Tomorrow you will do one page of error log and one walk. Careers are built on hundreds of ordinary Tuesdays, not on a single legendary night.\n\nYou are allowed to want a life that is not a brochure. You are allowed to want money. You are allowed to want service. You are not required to want them in the ratio your neighbourhood prefers.\n\nWhen you are ready, open AgamiPatha, pick a starting qualification and a destination, and walk the steps. Then come back to worksheet 9 and put those steps on a week grid. That is the whole method.",
  );
  heading(doc, "Colophon");
  para(
    doc,
    `Set as a 6 × 9 inch digital edition. ${copyright} Cover illustration commissioned for this ebook. Printed pages welcome; the file you downloaded after Razorpay checkout is yours to keep for personal study.\n\nEnd of the planned sections. Remaining pages, if any, are extra lined planner sheets so the edition is a full 100 pages you can actually write in.`,
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
    heading(doc, `Open planner sheet ${i}`);
    para(doc, "Use this page for overflow notes, a second exam calendar, or a conversation you want to remember. Date the top line.");
    doc.moveDown(0.2);
    for (let line = 0; line < 18; line += 1) {
      if (doc.y > HEIGHT - 70) break;
      doc.moveTo(52, doc.y).lineTo(WIDTH - 52, doc.y).strokeColor("#ddd4ff").lineWidth(0.6).stroke();
      doc.y += 20;
    }
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
  writeStreams(doc);
  writeExams(doc);
  writeProfessions(doc);
  writeExecution(doc);
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
