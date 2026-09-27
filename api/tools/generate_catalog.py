#!/usr/bin/env python3
"""Build a large Indian qualifications + professions catalogue for AgamiPatha."""
from __future__ import annotations

import json
from pathlib import Path

def node(
    id: str,
    title: str,
    short: str,
    kind: str,
    field: str,
    duration: str,
    age: str,
    summary: str,
    study: list[str],
    exams: list[str],
    skills: list[str],
    outlook: str,
    salary: str | None = None,
    workplaces: list[str] | None = None,
) -> dict:
    item = {
        "id": id,
        "title": title,
        "shortTitle": short,
        "kind": kind,
        "field": field,
        "duration": duration,
        "typicalAge": age,
        "summary": summary,
        "whatYouStudy": study,
        "exams": exams,
        "skills": skills,
        "outlook": outlook,
    }
    if salary:
        item["salaryHint"] = salary
    if workplaces:
        item["workplaces"] = workplaces
    return item


def edge(frm: str, to: str, via: str, notes: str) -> dict:
    return {"from": frm, "to": to, "via": via, "notes": notes}


nodes: list[dict] = []
edges: list[dict] = []

# --- School & higher secondary ---
nodes += [
    node("metric", "Class 10 (Metric)", "Metric", "school", "Foundation", "Until Class 10", "15–16",
         "First major board. Opens Class 12 streams, polytechnic, ITI, and later every mapped profession through those routes.",
         ["Languages", "Mathematics", "Science", "Social science"],
         ["CBSE / ICSE / State board Class 10"],
         ["Study habits", "Numeracy", "Reading"],
         "Pick a Class 12 stream that matches the professions you are curious about. Science keeps the most technical doors open."),
    node("hs-pcm", "Class 12 Science — PCM", "12th PCM", "higher-secondary", "Science", "2 years", "16–18",
         "Physics, Chemistry, Mathematics. Standard route into engineering, architecture, computing, pure sciences, defence academies, and commercial pilot theory.",
         ["Physics", "Chemistry", "Mathematics", "Optional CS / English"],
         ["Class 12 board", "JEE Main / Advanced", "BITSAT", "NDA", "NATA", "CUET"],
         ["Quantitative reasoning", "Problem solving", "Lab work"],
         "Sit engineering and architecture entrances, or continue into B.Sc / BCA."),
    node("hs-pcb", "Class 12 Science — PCB", "12th PCB", "higher-secondary", "Science", "2 years", "16–18",
         "Physics, Chemistry, Biology. Primary path into medicine, dentistry, AYUSH, veterinary, pharmacy, nursing, and life sciences.",
         ["Physics", "Chemistry", "Biology"],
         ["Class 12 board", "NEET-UG", "State allied-health CETs"],
         ["Observation", "Memorisation with understanding", "Empathy"],
         "NEET-UG is the main medical gate. Keep B.Sc life sciences as a parallel plan."),
    node("hs-pcmb", "Class 12 Science — PCMB", "12th PCMB", "higher-secondary", "Science", "2 years", "16–18",
         "All four science subjects. Keeps both engineering and medical options open at the cost of a heavier Class 12 load.",
         ["Physics", "Chemistry", "Mathematics", "Biology"],
         ["Class 12 board", "JEE", "NEET-UG"],
         ["Breadth", "Time management"],
         "Useful if you are genuinely undecided between PCM and PCB careers."),
    node("hs-commerce", "Class 12 Commerce", "12th Commerce", "higher-secondary", "Commerce", "2 years", "16–18",
         "Accountancy, business studies, economics. Launch pad for CA, CS, CMA, B.Com, BBA, banking, and later MBA.",
         ["Accountancy", "Business studies", "Economics", "Optional maths"],
         ["Class 12 board", "CA Foundation", "CUET", "IPMAT / NPAT / SET"],
         ["Numerical accuracy", "Business vocabulary"],
         "You can start CA Foundation in Class 12 or take a bachelor’s first."),
    node("hs-arts", "Class 12 Arts / Humanities", "12th Arts", "higher-secondary", "Humanities", "2 years", "16–18",
         "History, political science, sociology, psychology, languages. Feeds law, journalism, civil services, teaching, design, and social work.",
         ["Humanities electives", "Languages", "Optional economics / psychology"],
         ["Class 12 board", "CUET", "CLAT / AILET", "NID / NIFT / UCEED"],
         ["Writing", "Argument", "Wide reading"],
         "A B.A. plus a targeted exam (CLAT, UPSC, design) is a common pattern."),
    node("hs-vocational", "Class 12 Vocational / Applied", "12th Vocational", "higher-secondary", "Vocational", "2 years", "16–18",
         "Applied streams such as IT, retail, hospitality, or healthcare at senior secondary. Can continue to diplomas or related bachelor’s degrees.",
         ["Vocational theory", "Practical / on-the-job training"],
         ["Board vocational papers", "Skill assessments"],
         ["Applied craft", "Workplace habits"],
         "Map the vocational subject to a diploma or bachelor in the same field."),
]

# --- Vocational ---
nodes += [
    node("iti", "ITI / NCVT Certificate", "ITI", "vocational", "Skilled trades", "1–2 years", "16–18",
         "Trade training (electrician, fitter, welder, COPA, and others) for apprenticeships and skilled jobs.",
         ["Trade theory", "Workshop", "Employability skills"],
         ["State ITI counselling / NCVT"],
         ["Craft skill", "Safety", "Tools"],
         "Many later join a polytechnic diploma or a PSU apprenticeship."),
    node("diploma-eng", "Polytechnic Diploma (Engineering)", "Diploma Engg.", "vocational", "Engineering", "3 years", "16–19",
         "Hands-on engineering after Class 10. Work as a technician or take lateral entry into B.Tech year two.",
         ["Applied science", "Workshop", "Branch subjects"],
         ["State polytechnic entrance", "LEET / JELET"],
         ["Drafting", "Shop-floor skills"],
         "A practical engineering start that still keeps the full B.Tech path open."),
    node("diploma-pharmacy", "D.Pharm", "D.Pharm", "vocational", "Pharmacy", "2 years", "17–19",
         "Diploma in pharmacy. Allows registered pharmacist practice in retail/hospital under council rules; B.Pharm is the upgrade.",
         ["Pharmaceutics basics", "Pharmacology intro", "Hospital training"],
         ["State pharmacy counselling"],
         ["Dispensing", "Accuracy"],
         "Register with the pharmacy council; consider B.Pharm lateral entry."),
    node("gnm", "GNM (General Nursing & Midwifery)", "GNM", "vocational", "Healthcare", "3 years", "17–20",
         "Diploma nursing programme. Leads to registered nurse roles; B.Sc Nursing post-basic is a common upgrade.",
         ["Fundamentals of nursing", "Midwifery", "Clinical postings"],
         ["State nursing entrance", "Council registration"],
         ["Patient care", "Clinical routine"],
         "Hospitals hire GNM nurses; post-basic B.Sc widens promotion and overseas options."),
    node("diploma-hotel", "Diploma in Hotel Management", "DHM", "vocational", "Hospitality", "1–3 years", "17–20",
         "Food production, front office, and housekeeping training for hotels and catering.",
         ["Food production", "Front office", "Hygiene"],
         ["Institute / NCHM-related diplomas"],
         ["Service", "Team shifts"],
         "Can later join BHM or work up through hotel operations."),
    node("anm", "ANM (Auxiliary Nurse Midwifery)", "ANM", "vocational", "Healthcare", "2 years", "17–19",
         "Community and maternal-health nursing diploma, often used in rural public-health posts.",
         ["Community health", "Midwifery basics"],
         ["State ANM counselling"],
         ["Community outreach", "Basic care"],
         "A public-health nursing start; GNM or B.Sc Nursing can follow."),
]

# --- Engineering UG ---
BTECH = [
    ("btech-cse", "B.Tech Computer Science", "B.Tech CSE", "Computing", "Programming, algorithms, OS, databases, networks"),
    ("btech-it", "B.Tech Information Technology", "B.Tech IT", "Computing", "Software systems, networks, web and enterprise IT"),
    ("btech-ece", "B.Tech Electronics & Communication", "B.Tech ECE", "Electronics", "Signals, VLSI, embedded, communication systems"),
    ("btech-ee", "B.Tech Electrical Engineering", "B.Tech EE", "Electrical", "Power systems, machines, control, electronics"),
    ("btech-mech", "B.Tech Mechanical Engineering", "B.Tech Mech", "Mechanical", "Thermofluids, design, manufacturing, CAD"),
    ("btech-civil", "B.Tech Civil Engineering", "B.Tech Civil", "Civil", "Structures, surveying, geotech, transportation, water"),
    ("btech-chem", "B.Tech Chemical Engineering", "B.Tech Chem", "Chemical", "Transport processes, reaction engineering, plant design"),
    ("btech-aero", "B.Tech Aerospace Engineering", "B.Tech Aero", "Aerospace", "Aerodynamics, propulsion, flight mechanics, structures"),
    ("btech-chemeng-petro", "B.Tech Petroleum Engineering", "B.Tech Petro", "Energy", "Reservoir, drilling, production engineering"),
    ("btech-biotech", "B.Tech Biotechnology", "B.Tech Biotech", "Biotech", "Bioprocess, genetics, downstream processing"),
    ("btech-auto", "B.Tech Automobile Engineering", "B.Tech Auto", "Automotive", "Vehicle design, engines, EV systems"),
    ("btech-ai", "B.Tech AI / Data Science", "B.Tech AI", "Computing", "ML, statistics, data engineering, AI systems"),
]
for i, title, short, field, study in BTECH:
    nodes.append(node(i, title, short, "undergraduate", field, "4 years", "18–22",
                      f"{title} after Class 12 PCM (or lateral entry from diploma). Branch choice shapes the first job more than the college brand alone.",
                      [s.strip() for s in study.split(",")],
                      ["JEE Main / Advanced or state CET", "GATE later for M.Tech / PSU"],
                      ["Engineering maths", "Labs and projects", "Internships"],
                      "Placements, GATE, CAT, and civil services are all common next moves."))

nodes += [
    node("bca", "BCA", "BCA", "undergraduate", "Computing", "3 years", "18–21",
         "Bachelor of Computer Applications. Computing degree; maths in Class 12 helps but is not always mandatory.",
         ["Programming", "Databases", "Web / software engineering"],
         ["University / CUET"],
         ["Coding", "SQL"],
         "Direct software path; MCA or a specialised master’s strengthens it."),
    node("barch", "B.Arch", "B.Arch", "undergraduate", "Architecture", "5 years", "18–23",
         "Professional architecture degree recognised by the Council of Architecture.",
         ["Design studios", "Construction", "History of architecture", "Practice"],
         ["NATA or JEE Main Paper 2"],
         ["Spatial design", "CAD / drawing"],
         "Firms, urban design, interiors, or a master’s in planning."),
    node("bdes", "B.Des", "B.Des", "undergraduate", "Design", "4 years", "18–22",
         "Bachelor of Design (product, communication, UX, or similar) via NID/IIT/private design schools.",
         ["Studios", "Design research", "Prototyping"],
         ["NID DAT", "UCEED", "NIFT"],
         ["Craft", "Critique", "Portfolio"],
         "Portfolio is the hiring document. M.Des optional."),
    node("bfa", "BFA / BVA", "BFA", "undergraduate", "Fine arts", "4 years", "18–22",
         "Bachelor of Fine Arts. Studio practice in painting, sculpture, applied art, or related disciplines.",
         ["Studio practice", "Art history", "Applied art"],
         ["University / college entrance + portfolio"],
         ["Visual craft", "Critique"],
         "Studios, teaching, illustration, or design-adjacent work."),
]

# --- Science UG ---
SCI = [
    ("bsc-physics", "B.Sc Physics", "B.Sc Physics", "Physics"),
    ("bsc-chemistry", "B.Sc Chemistry", "B.Sc Chem", "Chemistry"),
    ("bsc-maths", "B.Sc Mathematics", "B.Sc Maths", "Mathematics"),
    ("bsc-stats", "B.Sc Statistics", "B.Sc Stats", "Statistics"),
    ("bsc-cs", "B.Sc Computer Science", "B.Sc CS", "Computing"),
    ("bsc-biotech", "B.Sc Biotechnology", "B.Sc Biotech", "Biotech"),
    ("bsc-micro", "B.Sc Microbiology", "B.Sc Micro", "Life sciences"),
    ("bsc-zoology", "B.Sc Zoology", "B.Sc Zoo", "Life sciences"),
    ("bsc-botany", "B.Sc Botany", "B.Sc Botany", "Life sciences"),
    ("bsc-agri", "B.Sc Agriculture", "B.Sc Agri", "Agriculture"),
    ("bsc-forestry", "B.Sc Forestry", "B.Sc Forestry", "Environment"),
    ("bsc-forensic", "B.Sc Forensic Science", "B.Sc Forensic", "Forensics"),
    ("bsc-food", "B.Sc Food Technology", "B.Sc Food", "Food science"),
    ("bsc-nursing", "B.Sc Nursing", "B.Sc Nursing", "Healthcare"),
    ("bsc-it", "B.Sc Information Technology", "B.Sc IT", "Computing"),
]
for i, title, short, field in SCI:
    nodes.append(node(i, title, short, "undergraduate", field, "3–4 years", "18–22",
                      f"{title}. Supports research, teaching, industry labs, or a switch into computing/data depending on the major.",
                      [f"Core {field} papers", "Practicals", "Optional computing / statistics"],
                      ["CUET / university", "IIT JAM later for many M.Sc programmes"],
                      ["Scientific method", "Quantitative work"],
                      "Pair with M.Sc, B.Ed, MCA, or professional master’s as needed."))

# --- Health UG ---
nodes += [
    node("mbbs", "MBBS", "MBBS", "undergraduate", "Medicine", "5.5 years incl. internship", "18–24",
         "Primary medical qualification in India. After internship and registration you may practise; MD/MS for most specialties.",
         ["Pre-clinical", "Para-clinical", "Clinical rotations", "Internship"],
         ["NEET-UG", "NEXT / NEET-PG later"],
         ["Clinical reasoning", "Communication", "Stamina"],
         "General practice, government service, or postgraduate specialisation."),
    node("bds", "BDS", "BDS", "undergraduate", "Dentistry", "5 years incl. internship", "18–23",
         "Bachelor of Dental Surgery. Dentist after council registration; MDS for specialisation.",
         ["Oral anatomy", "Conservative dentistry", "Prosthodontics"],
         ["NEET-UG", "NEET-MDS later"],
         ["Fine motor skill", "Patient care"],
         "Clinics, hospitals, public health dentistry."),
    node("bams", "BAMS", "BAMS", "undergraduate", "AYUSH", "5.5 years", "18–24",
         "Bachelor of Ayurvedic Medicine and Surgery. Ayurveda physician after council registration.",
         ["Ayurveda samhitas", "Modern anatomy / physiology", "Clinical training"],
         ["NEET-UG + AYUSH counselling"],
         ["Traditional + modern clinical mix"],
         "AYUSH hospitals, private practice, wellness industry, or MD Ayurveda."),
    node("bhms", "BHMS", "BHMS", "undergraduate", "AYUSH", "5.5 years", "18–24",
         "Bachelor of Homeopathic Medicine and Surgery.",
         ["Homeopathic materia medica", "Organon", "Clinical postings"],
         ["NEET-UG + AYUSH counselling"],
         ["Case taking", "Dispensing"],
         "Clinics and AYUSH services; check current practice regulations."),
    node("bums", "BUMS", "BUMS", "undergraduate", "AYUSH", "5.5 years", "18–24",
         "Bachelor of Unani Medicine and Surgery.",
         ["Unani principles", "Clinical training"],
         ["NEET-UG + AYUSH counselling"],
         ["Clinical Unani practice"],
         "Unani hospitals and private practice."),
    node("bvsc", "B.V.Sc & A.H.", "B.V.Sc", "undergraduate", "Veterinary", "5.5 years", "18–24",
         "Veterinary science and animal husbandry. Qualifies veterinarians for clinical, farm, and government roles.",
         ["Animal anatomy", "Medicine & surgery", "Livestock production"],
         ["NEET-UG / state veterinary counselling"],
         ["Animal handling", "Clinical vet skills"],
         "Clinics, dairies, government AH departments, research."),
    node("bpharm", "B.Pharm", "B.Pharm", "undergraduate", "Pharmacy", "4 years", "18–22",
         "Undergraduate pharmacy: drug science, dispensing, and industry manufacturing.",
         ["Pharmaceutics", "Pharmacology", "Pharm chemistry"],
         ["Pharmacy counselling", "GPAT for M.Pharm"],
         ["Drug knowledge", "Quality systems"],
         "Retail, hospital, industry, regulatory affairs."),
    node("pharmd", "Pharm.D", "Pharm.D", "undergraduate", "Pharmacy", "6 years", "18–24",
         "Doctor of Pharmacy — clinically oriented pharmacy degree with hospital residency-style training.",
         ["Clinical pharmacy", "Therapeutics", "Hospital rotations"],
         ["Pharmacy counselling"],
         ["Clinical counselling", "Ward rounds support"],
         "Hospitals, clinical research, pharmacovigilance."),
    node("bpt", "BPT (Physiotherapy)", "BPT", "undergraduate", "Allied health", "4.5 years", "18–23",
         "Bachelor of Physiotherapy with clinical internships in rehab and orthopaedics.",
         ["Exercise therapy", "Electrotherapy", "Anatomy"],
         ["State / university allied-health entrance"],
         ["Rehab assessment", "Manual therapy basics"],
         "Hospitals, sports clinics, private practice, MPT."),
    node("bot", "BOT (Occupational Therapy)", "BOT", "undergraduate", "Allied health", "4.5 years", "18–23",
         "Occupational therapy degree focused on function and daily living after injury or disability.",
         ["OT theory", "Assistive rehab", "Clinical postings"],
         ["Allied-health counselling"],
         ["Functional assessment", "Adaptive strategies"],
         "Rehab centres, hospitals, paediatric OT, MOT."),
    node("baslp", "BASLP", "BASLP", "undergraduate", "Allied health", "4 years", "18–22",
         "Bachelor in Audiology and Speech-Language Pathology.",
         ["Audiology", "Speech language pathology", "Clinics"],
         ["Allied-health / university entrance"],
         ["Assessment", "Therapy planning"],
         "Hospitals, schools, private clinics, MASLP."),
    node("boptom", "B.Optom", "B.Optom", "undergraduate", "Allied health", "4 years", "18–22",
         "Optometry degree for primary eye care, refraction, and optical practice.",
         ["Optics", "Ocular disease", "Clinics"],
         ["University / allied-health entrance"],
         ["Refraction", "Patient counselling"],
         "Optical retail, hospitals, private practice."),
    node("bsc-mlt", "B.Sc Medical Lab Technology", "B.Sc MLT", "undergraduate", "Allied health", "3–4 years", "18–22",
         "Laboratory diagnostics degree for pathology, microbiology, and biochemistry labs.",
         ["Clinical pathology", "Microbiology", "Lab quality"],
         ["University / paramedical counselling"],
         ["Lab technique", "Accuracy"],
         "Hospitals, diagnostic chains, research labs."),
    node("bsc-rad", "B.Sc Radiology / Imaging", "B.Sc Radiology", "undergraduate", "Allied health", "3–4 years", "18–22",
         "Medical imaging technology (X-ray, CT, MRI support) under radiologist supervision.",
         ["Radiographic technique", "Radiation safety", "Anatomy"],
         ["Paramedical counselling"],
         ["Imaging protocols", "Safety"],
         "Hospitals and diagnostic centres."),
]

# --- Commerce / management / arts / law UG ---
nodes += [
    node("bcom", "B.Com", "B.Com", "undergraduate", "Commerce", "3 years", "18–21",
         "Accountancy, finance, and business law. Pairs with CA, CS, CMA, or MBA.",
         ["Financial accounting", "Taxation", "Corporate law"],
         ["University / CUET"],
         ["Accounting", "Excel"],
         "Accounts, banking, tax, or professional qualifications on top."),
    node("bcom-hons", "B.Com (Hons)", "B.Com Hons", "undergraduate", "Commerce", "3 years", "18–21",
         "Honours commerce with deeper accounting and finance papers. Favoured for CA and campus finance.",
         ["Advanced accounting", "Finance", "Tax"],
         ["CUET / college cut-offs"],
         ["Accounting depth", "Analysis"],
         "Same onward paths as B.Com with a stronger finance signal."),
    node("bba", "BBA", "BBA", "undergraduate", "Management", "3 years", "18–21",
         "Bachelor of Business Administration. Management runway to MBA or corporate roles.",
         ["Marketing", "HR", "Finance basics", "Operations"],
         ["NPAT, SET, IPMAT, CUET"],
         ["Presentation", "Case work"],
         "Management trainee roles, family business, then often MBA."),
    node("bms", "BMS", "BMS", "undergraduate", "Management", "3 years", "18–21",
         "Bachelor of Management Studies — similar to BBA, common in some universities.",
         ["Management core", "Specialisation electives"],
         ["University entrance"],
         ["Business communication"],
         "Treat as a BBA-equivalent for later MBA and corporate roles."),
    node("ba-eng", "B.A. English", "B.A. English", "undergraduate", "Humanities", "3 years", "18–21",
         "Literature and writing-intensive arts degree. Media, teaching, civil services, and publishing are common follow-ons.",
         ["Literature", "Criticism", "Writing"],
         ["CUET / university"],
         ["Writing", "Close reading"],
         "Add B.Ed, journalism internships, UPSC, or an MBA as a next filter."),
    node("ba-hist", "B.A. History", "B.A. History", "undergraduate", "Humanities", "3 years", "18–21",
         "History honours — a frequent UPSC optional and teaching subject.",
         ["Indian and world history", "Historiography"],
         ["CUET / university"],
         ["Essay writing", "Sources"],
         "Civil services, teaching, museums, research M.A."),
    node("ba-pol", "B.A. Political Science", "B.A. Pol. Sci.", "undergraduate", "Social science", "3 years", "18–21",
         "Political science — common for UPSC, journalism, and policy internships.",
         ["Political theory", "Indian government", "IR"],
         ["CUET / university"],
         ["Argument", "Current affairs"],
         "UPSC, journalism, law (3-year LL.B.), policy master’s."),
    node("ba-eco", "B.A. / B.Sc Economics", "Economics", "undergraduate", "Economics", "3 years", "18–21",
         "Economics honours. Quant track if maths is included — useful for analyst, RBI/UPSC, and master’s abroad or DSE/ISI.",
         ["Micro / macro", "Statistics", "Econometrics intro"],
         ["CUET / university"],
         ["Quant", "Writing"],
         "Analyst roles, IES/UPSC, M.A. Economics, MBA."),
    node("ba-psy", "B.A. / B.Sc Psychology", "Psychology UG", "undergraduate", "Psychology", "3 years", "18–21",
         "Undergraduate psychology. Independent clinical practice in India typically needs a recognised master’s (and RCI pathways where applicable).",
         ["General psychology", "Research methods", "Practicals"],
         ["CUET / university"],
         ["Listening", "Research basics"],
         "M.A./M.Sc Psychology, counselling, HR, or research."),
    node("ba-soc", "B.A. Sociology", "B.A. Sociology", "undergraduate", "Social science", "3 years", "18–21",
         "Sociology — social research, development sector, UPSC, and social work master’s.",
         ["Sociological theory", "Indian society", "Research"],
         ["CUET / university"],
         ["Field observation", "Writing"],
         "NGOs, research, MSW, civil services."),
    node("bsw", "BSW", "BSW", "undergraduate", "Social work", "3 years", "18–21",
         "Bachelor of Social Work with field placements in NGOs and community settings.",
         ["Social work methods", "Field work"],
         ["University admission"],
         ["Community work", "Case work"],
         "NGOs, CSR, MSW for deeper practice."),
    node("bjmc", "B.A. Journalism / BJMC", "BJMC", "undergraduate", "Media", "3 years", "18–21",
         "Journalism and mass communication undergraduate. Internships and a clip file matter as much as the degree.",
         ["Reporting", "Media law", "Production"],
         ["University / IIMC-related UG where offered"],
         ["Writing under deadline", "Sourcing"],
         "Newsrooms, digital media, PR; M.A. Journalism optional."),
    node("llb5", "B.A. LL.B. (5-year)", "5-yr LL.B.", "undergraduate", "Law", "5 years", "18–23",
         "Integrated law after Class 12. Graduates enrol as advocates.",
         ["Constitutional law", "Contracts", "Criminal & corporate", "Moots"],
         ["CLAT, AILET, SLAT, LSAT-India"],
         ["Legal research", "Advocacy"],
         "Litigation, firms, in-house, judiciary, LL.M."),
    node("llb3", "LL.B. (3-year)", "3-yr LL.B.", "undergraduate", "Law", "3 years", "21–24",
         "Law after any bachelor’s degree. Same advocate enrolment as the five-year course.",
         ["Core law papers", "Internships"],
         ["DU LL.B. / MHCET Law / university tests"],
         ["Drafting", "Research"],
         "Useful if you discovered law after another bachelor’s."),
    node("bhm", "BHM / B.Sc Hospitality", "BHM", "undergraduate", "Hospitality", "3–4 years", "18–22",
         "Hotel and hospitality management. Operations across F&B, rooms, and events.",
         ["F&B", "Front office", "Revenue basics"],
         ["NCHM JEE / university"],
         ["Service operations", "Shift leadership"],
         "Hotels, airlines catering, QSR, MBA later."),
    node("bpharma-ayush", "B.Pharm (Ayurveda) / related", "B.Pharm Ayurveda", "undergraduate", "AYUSH", "4 years", "18–22",
         "Ayurvedic / herbal pharmacy programmes where offered — industry and AYUSH dispensing.",
         ["Dravyaguna", "Formulations"],
         ["University / AYUSH counselling"],
         ["Herbal formulation"],
         "AYUSH manufacturing and pharmacies."),
    node("bp-ed", "B.P.Ed", "B.P.Ed", "undergraduate", "Sports", "2–4 years", "18–23",
         "Physical education bachelor’s for school PE teaching and coaching pathways.",
         ["Sports science", "Pedagogy of PE"],
         ["University PE entrance + fitness tests"],
         ["Coaching", "Fitness"],
         "Schools, academies; M.P.Ed for advancement."),
    node("bel-ed", "B.El.Ed", "B.El.Ed", "undergraduate", "Education", "4 years", "18–22",
         "Integrated elementary education degree (notably Delhi University model) for primary teaching.",
         ["Child development", "Pedagogy", "School internship"],
         ["University B.El.Ed entrance"],
         ["Classroom practice"],
         "Primary schools; TET still required for many government posts."),
]

# --- Professional accountancy ---
nodes += [
    node("ca-foundation", "CA Foundation", "CA Foundation", "professional", "Accountancy", "4–8 months prep", "17–19",
         "First ICAI level. Can be attempted around Class 12 windows.",
         ["Accounting", "Business laws", "Quant", "Economics"],
         ["ICAI CA Foundation"],
         ["Accounting basics", "Exam stamina"],
         "Then Intermediate + articleship."),
    node("ca-inter", "CA Intermediate", "CA Inter", "professional", "Accountancy", "~1 year + articleship start", "19–22",
         "Second CA level. Articleship begins after groups as per ICAI rules.",
         ["Accounting", "Law", "Tax", "Audit / costing"],
         ["ICAI Intermediate"],
         ["Tax computation", "Working papers"],
         "Final after required training."),
    node("ca-final", "CA Final", "CA Final", "professional", "Accountancy", "After articleship", "22–25",
         "Last ICAI exam before membership.",
         ["Financial reporting", "SFM", "Audit", "Direct & indirect tax"],
         ["ICAI Final"],
         ["Professional judgement"],
         "Practice, industry finance, Big Four."),
    node("cs-executive", "CS Executive", "CS Exec", "professional", "Governance", "~1 year", "19–22",
         "Company Secretary Executive programme (ICSI) after Foundation or a graduate entry route.",
         ["Company law", "Tax", "Securities"],
         ["ICSI Executive"],
         ["Compliance", "Law reading"],
         "Then Professional programme + training."),
    node("cs-professional", "CS Professional", "CS Prof.", "professional", "Governance", "~1 year + training", "21–24",
         "Final ICSI academic stage before membership.",
         ["Governance", "Secretarial audit", "Restructuring"],
         ["ICSI Professional"],
         ["Board support", "Compliance"],
         "Company secretary roles in listed companies and practice."),
    node("cma-inter", "CMA Intermediate", "CMA Inter", "professional", "Cost accounting", "~1 year", "19–22",
         "ICMAI Intermediate after Foundation or graduate entry.",
         ["Cost accounting", "Financial accounting", "Law & tax"],
         ["ICMAI Intermediate"],
         ["Costing", "Analysis"],
         "Then Final and practical training."),
    node("cma-final", "CMA Final", "CMA Final", "professional", "Cost accounting", "~1 year + training", "21–24",
         "Final CMA qualification stage.",
         ["Strategic costing", "Corporate finance", "Audit"],
         ["ICMAI Final"],
         ["Cost strategy"],
         "Manufacturing finance, cost audit, industry."),
    node("nda", "NDA / Service Academy", "NDA", "professional", "Defence", "3–4 years academy", "16–19 at entry",
         "National Defence Academy after Class 12, or equivalent academy entries. Leads to a commission.",
         ["Academic degree + military training", "Physical training"],
         ["NDA (UPSC) + SSB"],
         ["Fitness", "Leadership"],
         "Army, Navy, or Air Force officer subject to branch and medicals."),
    node("cds-ima", "CDS / OTA / IMA entry training", "CDS path", "professional", "Defence", "Training after graduation", "20–24",
         "Combined Defence Services and related graduate entries into IMA, INA, AFA, OTA.",
         ["Academy training", "Leadership"],
         ["CDS (UPSC) + SSB"],
         ["Fitness", "OLQ"],
         "Commissioned officer after academy."),
]

# --- PG ---
nodes += [
    node("mtech", "M.Tech / M.E.", "M.Tech", "postgraduate", "Engineering", "2 years", "22–24",
         "Postgraduate engineering via GATE. Specialist industry, R&D, teaching.",
         ["Advanced electives", "Thesis"],
         ["GATE"],
         ["Domain depth", "Research writing"],
         "Specialist engineer, labs, Ph.D., teaching."),
    node("mca", "MCA", "MCA", "postgraduate", "Computing", "2 years", "21–23",
         "Master of Computer Applications after BCA or eligible B.Sc.",
         ["Advanced programming", "Architecture", "Data"],
         ["NIMCET / university MCA"],
         ["Delivery", "Full-stack or backend depth"],
         "Software hiring; stronger signal than BCA alone at many campuses."),
    node("mba", "MBA / PGDM", "MBA", "postgraduate", "Management", "2 years", "22–26",
         "Postgraduate management. Consulting, product, marketing, ops, IB depending on school.",
         ["Core management", "Specialisation", "Internship"],
         ["CAT, XAT, SNAP, NMAT, GMAT"],
         ["Cases", "Leadership"],
         "School quality and internships matter as much as the title."),
    node("msc", "M.Sc (Science)", "M.Sc", "postgraduate", "Science", "2 years", "21–23",
         "Master’s in a science discipline — research, analytics, teaching (NET), industry science.",
         ["Advanced papers", "Dissertation"],
         ["IIT JAM, CUET-PG"],
         ["Research methods"],
         "NET/JRF, labs, or Ph.D."),
    node("ma", "M.A.", "M.A.", "postgraduate", "Humanities", "2 years", "21–23",
         "Master of Arts in the undergraduate subject or an allied field.",
         ["Seminars", "Dissertation / papers"],
         ["CUET-PG / university"],
         ["Research writing"],
         "NET for college teaching, UPSC, specialist roles."),
    node("md-ms", "MD / MS", "MD / MS", "postgraduate", "Medicine", "3 years", "25–28",
         "Medical postgraduate specialisation. MD medicine-side; MS surgery-side.",
         ["Specialty training", "Thesis", "Duties"],
         ["NEET-PG / NEXT"],
         ["Specialty procedures", "Ward leadership"],
         "Consultant practice or super-speciality DM/MCh."),
    node("mds", "MDS", "MDS", "postgraduate", "Dentistry", "3 years", "24–27",
         "Master of Dental Surgery — specialist dentist.",
         ["Specialty clinics", "Thesis"],
         ["NEET-MDS"],
         ["Specialty dentistry"],
         "Specialty practice and teaching hospitals."),
    node("mpharm", "M.Pharm", "M.Pharm", "postgraduate", "Pharmacy", "2 years", "22–24",
         "Master of Pharmacy via GPAT. Industry R&D, QA, academia.",
         ["Specialisation", "Research project"],
         ["GPAT"],
         ["Formulation / pharmacology depth"],
         "Pharma R&D, regulatory, teaching."),
    node("llm", "LL.M.", "LL.M.", "postgraduate", "Law", "1–2 years", "24–26",
         "Master of Laws for academic, policy, or specialised practice depth.",
         ["Specialisation seminars", "Dissertation"],
         ["CLAT PG / university"],
         ["Doctrinal research"],
         "Academia, specialist firms, policy."),
    node("mdes", "M.Des", "M.Des", "postgraduate", "Design", "2 years", "22–24",
         "Master of Design. Deepens undergraduate design or converts some engineers/architects.",
         ["Studios", "Thesis project"],
         ["CEED / institute tests"],
         ["Advanced design research"],
         "Specialist design roles and studios."),
    node("msw", "MSW", "MSW", "postgraduate", "Social work", "2 years", "21–23",
         "Master of Social Work — development sector, hospitals, CSR, policy NGOs.",
         ["Methods", "Field work", "Specialisation"],
         ["University MSW tests"],
         ["Case work", "Programme design"],
         "NGOs, hospitals, government schemes, CSR."),
    node("mph", "MPH", "MPH", "postgraduate", "Public health", "2 years", "22–26",
         "Master of Public Health after a health or life-science bachelor’s (rules vary by school).",
         ["Epidemiology", "Biostats", "Health systems"],
         ["Institute MPH admissions"],
         ["Population health", "Programme eval"],
         "Govt public health, WHO/UN internships, NGOs, hospitals."),
    node("med", "M.Ed", "M.Ed", "postgraduate", "Education", "2 years", "23–26",
         "Master of Education after B.Ed. Leadership, teacher education, research.",
         ["Education research", "Leadership"],
         ["University M.Ed"],
         ["Pedagogy research"],
         "Teacher education institutes, school leadership."),
    node("mpt", "MPT", "MPT", "postgraduate", "Allied health", "2 years", "23–25",
         "Master of Physiotherapy specialisation.",
         ["Specialty rehab", "Dissertation"],
         ["University MPT"],
         ["Advanced rehab"],
         "Specialty clinics and teaching."),
    node("bed", "B.Ed", "B.Ed", "professional", "Education", "2 years", "21–24",
         "Bachelor of Education after a subject bachelor’s. Usual credential for school teaching.",
         ["Pedagogy", "Ed psych", "Practice teaching"],
         ["State B.Ed entrance", "later CTET / TET"],
         ["Classroom management", "Lesson design"],
         "Government and private schools."),
    node("phd", "Ph.D.", "Ph.D.", "postgraduate", "Research", "3–6 years", "24–32",
         "Doctoral research after a relevant master’s (or integrated routes). Required for most permanent college/university teaching.",
         ["Original research", "Thesis", "Publications"],
         ["NET/JRF, GATE, institute interviews"],
         ["Independent research"],
         "Academia, R&D labs, specialist industry research."),
]

# --- Professions ---
PROF = [
    ("software-engineer", "Software Engineer", "Software Eng.", "Technology", "From ~21",
     "Builds software products and systems. Internships and projects matter as much as the exact degree.",
     ["A primary stack", "Data structures", "System design on the job"],
     ["Interviews; optional GATE"],
     ["Programming", "Debugging", "Collaboration"],
     "Product, IT services, start-ups, later data/security/management.",
     "Wide range from services campus offers to product bands",
     ["Product firms", "IT services", "Start-ups", "In-house tech"]),
    ("data-scientist", "Data Scientist", "Data Scientist", "Technology", "From ~22",
     "Models and decisions from data. Needs statistics plus programming, often after B.Tech, B.Sc stats/maths, or a master’s.",
     ["Statistics", "ML", "SQL and Python"],
     ["Interviews / take-homes"],
     ["Python", "Stats", "Storytelling"],
     "Analytics, product ML, research labs.",
     "Typically above generic services when specialised",
     ["Tech", "Finance", "Consulting analytics"]),
    ("data-analyst", "Data Analyst", "Data Analyst", "Technology", "From ~21",
     "Reporting, SQL, dashboards, and business insight. A common first data job before scientist/engineer roles.",
     ["SQL", "Excel / BI tools", "Basic stats"],
     ["Analyst interviews"],
     ["SQL", "Visualisation"],
     "Every industry hires analysts; a master’s is optional.",
     "Campus analyst to specialist BI bands",
     ["Corporates", "Start-ups", "Consulting"]),
    ("ml-engineer", "ML Engineer", "ML Eng.", "Technology", "From ~22",
     "Production machine-learning systems — closer to software engineering than pure research science.",
     ["ML systems", "MLOps", "Python"],
     ["Hiring loops"],
     ["Engineering + ML"],
     "Usually after CSE/AI B.Tech or a strong software base.",
     "Specialist tech compensation",
     ["Product ML teams", "AI start-ups"]),
    ("prompt-engineer", "Prompt Engineer", "Prompt Eng.", "Technology", "From ~21",
     "Designs, tests, and improves prompts and LLM workflows so products get reliable answers from models like GPT or Gemini. Mix of clear writing, evaluation, and light Python/API work — not a substitute for full ML engineering.",
     ["Prompt design and evaluation", "LLM APIs and tooling", "Guardrails and regression tests"],
     ["Portfolio of prompt systems; product interviews"],
     ["Clear writing", "Experiment design", "Basic scripting"],
     "AI product teams, start-ups, and IT services GenAI practices. Titles are still fluid; many roles sit inside software or content teams.",
     "About ₹5–14 LPA early · ₹12–28 LPA when you own GenAI product quality",
     ["AI product teams", "Start-ups", "IT services GenAI", "In-house digital"]),
    ("cybersecurity-analyst", "Cybersecurity Analyst", "Cyber Analyst", "Technology", "From ~21",
     "Defends systems: SOC, pentest-adjacent, GRC. Degrees in CSE/IT plus certifications (Security+, OSCP later) are common.",
     ["Networks", "OS internals", "Security tools"],
     ["Interviews; optional certifications"],
     ["Threat awareness", "Incident process"],
     "IT, banks, consulting, government.",
     "Premium over generic IT when certified",
     ["SOC", "Consultancies", "Banks"]),
    ("uiux-designer", "UI / UX Designer", "UX Designer", "Design", "From ~21",
     "Product interface and research. B.Des, B.Tech + portfolio, or design master’s.",
     ["Research", "Wireframes", "Visual UI"],
     ["Portfolio reviews"],
     ["Figma craft", "User research"],
     "Product companies and agencies; portfolio is mandatory.",
     "Design bands vary by company",
     ["Product", "Agencies", "Freelance"]),
    ("product-manager", "Product Manager", "PM", "Technology", "From ~23",
     "Owns product outcomes. Often after engineering/MBA plus internships; not a first-degree job for most.",
     ["Discovery", "Metrics", "Roadmaps"],
     ["PM interviews"],
     ["Prioritisation", "Communication"],
     "Usually 1–3 years in another role or an MBA internship convert.",
     "Strong at product firms",
     ["Product companies", "Start-ups"]),
    ("civil-engineer", "Civil Engineer", "Civil Eng.", "Engineering", "From ~21",
     "Buildings, roads, water, infrastructure. Civil B.Tech or diploma-plus-degree.",
     ["Structures", "Construction management"],
     ["GATE / ESE / state services"],
     ["CAD/BIM basics", "Site coordination"],
     "Contractors, consultancies, PWD/municipal.",
     "Site roles start modestly; public services vary",
     ["Construction", "Consultancies", "Government"]),
    ("mechanical-engineer", "Mechanical Engineer", "Mech. Eng.", "Engineering", "From ~21",
     "Machines, manufacturing, auto, energy. Core mechanical degree.",
     ["Thermo", "Machine design", "Manufacturing"],
     ["GATE, ESE, PSU"],
     ["CAD", "Diagnosis"],
     "Core industry, auto, energy, or later MBA/software.",
     "Core vs PSU bands differ",
     ["Manufacturing", "Auto", "Energy", "PSUs"]),
    ("electrical-engineer", "Electrical Engineer", "EE", "Engineering", "From ~21",
     "Power, electrical machines, and related industry or PSU roles.",
     ["Power systems", "Machines"],
     ["GATE, ESE"],
     ["Power systems", "Safety"],
     "Utilities, PSUs, manufacturing, design consultancies.",
     "PSU/GATE roles are competitive",
     ["Utilities", "PSUs", "Industry"]),
    ("electronics-engineer", "Electronics Engineer", "ECE Eng.", "Engineering", "From ~21",
     "Embedded, VLSI, telecom, instrumentation. ECE/EEE degrees.",
     ["Embedded", "Circuits", "Communication"],
     ["GATE; core company tests"],
     ["Hardware debug", "C/embedded"],
     "Core ECE jobs are fewer than software; GATE and skills matter.",
     "Core ECE vs software switch",
     ["Electronics firms", "Telecom", "PSUs"]),
    ("chemical-engineer", "Chemical Engineer", "Chem Eng.", "Engineering", "From ~21",
     "Process plants, speciality chemicals, energy, FMCG manufacturing.",
     ["Process design", "Safety"],
     ["GATE; core placements"],
     ["Process thinking", "Plant safety"],
     "Refineries, chemicals, FMCG, consultancies.",
     "Core plant vs office roles",
     ["Process industry", "Energy", "FMCG"]),
    ("aerospace-engineer", "Aerospace Engineer", "Aero Eng.", "Engineering", "From ~22",
     "Aircraft and spacecraft systems. Limited core seats — HAL, ISRO/DRDO, private aviation, or a software/mechanical pivot.",
     ["Aero structures", "Propulsion"],
     ["GATE; ISRO/DRDO exams"],
     ["Flight systems", "Analysis"],
     "Core aero is competitive; many graduates diversify.",
     "Core aero is niche",
     ["HAL", "ISRO/DRDO", "Aviation firms"]),
    ("biotech-scientist", "Biotech / Life-science Scientist", "Biotech Scientist", "Science", "From ~22",
     "Labs in biopharma, diagnostics, or research. M.Sc or B.Tech biotech plus internships.",
     ["Wet lab", "Documentation", "Regulated work"],
     ["NET; industry hiring"],
     ["Lab technique", "Protocol discipline"],
     "Industry jobs often need a master’s; Ph.D. for independent research.",
     "Industry vs academia bands",
     ["Biopharma", "Diagnostics", "Institutes"]),
    ("research-scientist", "Research Scientist", "Scientist", "Science", "From ~25",
     "Original research in institutes or industry R&D. Usually M.Sc/M.Tech plus Ph.D. or JRF years.",
     ["Research programme", "Publications"],
     ["NET/JRF, GATE, institute jobs"],
     ["Independent inquiry"],
     "Long training; CSIR labs, IITs, industry R&D.",
     "Institute pay matrix vs industry R&D",
     ["National labs", "Universities", "Industry R&D"]),
    ("statistician", "Statistician", "Statistician", "Science", "From ~22",
     "Official statistics, surveys, biostats, or analytics. B.Sc/M.Sc statistics is the cleanest academic path.",
     ["Inference", "Survey methods", "Software (R/Python)"],
     ["ISS; campus analytics"],
     ["Probability", "Communication of numbers"],
     "MOSPI/ISS, pharma stats, analytics firms.",
     "Government ISS vs private analytics",
     ["Government", "Pharma", "Analytics"]),
    ("agronomist", "Agronomist / Agri Officer", "Agronomist", "Agriculture", "From ~22",
     "Crop science and farm systems after B.Sc Agriculture. Banks (AFO), state agri departments, input companies.",
     ["Agronomy", "Soils", "Extension"],
     ["IBPS AFO; state agri exams"],
     ["Field diagnosis", "Extension"],
     "Public agri services and private inputs/seed firms.",
     "Government agri officer vs private",
     ["State agri", "Banks", "Agri business"]),
    ("architect", "Architect", "Architect", "Design", "From ~23",
     "Licensed building designer after B.Arch and Council of Architecture registration.",
     ["Design practice", "Codes", "Coordination"],
     ["CoA registration"],
     ["Design", "Technical drawing"],
     "Studios, developers, public works, interiors.",
     "Studio salaries start modestly",
     ["Studios", "Developers", "PWD"]),
    ("urban-planner", "Urban / Town Planner", "Planner", "Design", "From ~24",
     "Usually after B.Arch/B.Plan/civil plus a planning master’s (SPA and similar).",
     ["Land use", "Transport", "Policy"],
     ["GATE planning / institute tests"],
     ["Spatial analysis", "Stakeholder work"],
     "Development authorities, consultancies, NGOs.",
     "Public authorities and consultancies",
     ["ULBs", "Consultancies"]),
    ("interior-designer", "Interior Designer", "Interiors", "Design", "From ~21",
     "Interior practice via B.Des interiors, B.Arch, or diplomas plus a portfolio.",
     ["Space planning", "Materials", "Client presentation"],
     ["Institute / portfolio"],
     ["Visualisation", "Vendor coordination"],
     "Studios and freelance; overlapping with architecture firms.",
     "Freelance and studio variance",
     ["Studios", "Freelance"]),
    ("fashion-designer", "Fashion Designer", "Fashion", "Design", "From ~21",
     "Apparel and textile design, typically NIFT/NID or B.Des fashion.",
     ["Design studios", "Garmenting", "Trend"],
     ["NIFT / NID"],
     ["Draping", "Collection building"],
     "Labels, export houses, freelance, fashion media.",
     "House salary vs own label risk",
     ["Labels", "Export", "Freelance"]),
    ("graphic-designer", "Graphic / Visual Designer", "Designer", "Design", "From ~20",
     "Visual communication. Design school after Class 12 or a serious portfolio from B.A./BFA.",
     ["Typography", "Layout", "Brand systems"],
     ["NID, NIFT, UCEED"],
     ["Visual craft", "Critique"],
     "Agencies, in-house brand, freelance.",
     "City and craft dependent",
     ["Studios", "Agencies", "Freelance"]),
    ("animator", "Animator / Motion Designer", "Animator", "Media", "From ~21",
     "2D/3D or motion graphics. Design/animation degrees or BFA plus a reel.",
     ["Animation principles", "Tools", "Storyboarding"],
     ["Institute / reel"],
     ["Timing", "Software craft"],
     "Studios, games, advertising. Reel is everything.",
     "Studio vs freelance",
     ["Animation studios", "Ad films", "Games"]),
    ("doctor", "Doctor (Physician)", "Doctor", "Healthcare", "From ~24",
     "Practises medicine after MBBS, internship, and registration. Many later take MD/MS.",
     ["Clinical medicine", "Ethics"],
     ["NEET-UG path; NEET-PG optional"],
     ["Diagnosis", "Empathy"],
     "Government hospitals, private practice, specialisation.",
     "Govt scales vs private vary by city and specialty",
     ["Hospitals", "Clinics", "Public health"]),
    ("surgeon", "Surgeon", "Surgeon", "Healthcare", "From ~28",
     "Operative specialist after MBBS plus MS (or equivalent).",
     ["Surgical specialty", "Theatre", "Post-op care"],
     ["NEET-PG / NEXT"],
     ["Operative skill", "Stamina"],
     "Tertiary hospitals and specialty centres.",
     "Long training; later earning potential higher",
     ["Tertiary hospitals"]),
    ("dentist", "Dentist", "Dentist", "Healthcare", "From ~23",
     "Oral healthcare after BDS and dental council registration.",
     ["Clinical dentistry", "Practice management"],
     ["NEET-UG; NEET-MDS optional"],
     ["Precision", "Clinic ops"],
     "Own clinic, hospitals, MDS.",
     "Private practice depends on city and flow",
     ["Clinics", "Hospitals"]),
    ("ayush-physician", "AYUSH Physician", "AYUSH Doctor", "Healthcare", "From ~24",
     "Ayurveda, homeopathy, or Unani practice after BAMS/BHMS/BUMS and council registration. Scope is defined by AYUSH law.",
     ["System-specific practice", "Dispensing"],
     ["NEET-UG AYUSH path"],
     ["Clinical AYUSH"],
     "AYUSH hospitals, wellness, private clinics.",
     "Clinic and government AYUSH posts",
     ["AYUSH hospitals", "Clinics"]),
    ("veterinarian", "Veterinarian", "Vet", "Healthcare", "From ~24",
     "Animal clinical and production practice after B.V.Sc & A.H.",
     ["Clinical vet", "Livestock"],
     ["Veterinary counselling path"],
     ["Animal handling", "Surgery basics"],
     "Clinics, dairy, government AH, research.",
     "Govt AH vs city clinics",
     ["Clinics", "Farms", "AH departments"]),
    ("pharmacist", "Pharmacist", "Pharmacist", "Healthcare", "From ~22",
     "Dispensing, hospital pharmacy, or pharma industry after D.Pharm/B.Pharm and registration.",
     ["Pharmacology in practice", "GMP"],
     ["Council registration; GPAT optional"],
     ["Accuracy", "Counselling"],
     "Retail, hospitals, industry QA, regulatory.",
     "Retail starts modestly; industry pays more later",
     ["Pharmacies", "Hospitals", "Pharma"]),
    ("nurse", "Registered Nurse", "Nurse", "Healthcare", "From ~21",
     "Clinical nursing after GNM or B.Sc Nursing and council registration.",
     ["Clinical protocols", "Patient education"],
     ["Council registration"],
     ["Care delivery", "Communication"],
     "Hospitals, community, defence, overseas with extra licensing.",
     "Govt vs private vs overseas differ widely",
     ["Hospitals", "Community", "Defence"]),
    ("physiotherapist", "Physiotherapist", "Physio", "Healthcare", "From ~23",
     "Rehab professional after BPT and internships.",
     ["Assessment", "Exercise prescription"],
     ["Council / association norms"],
     ["Rehab", "Communication"],
     "Hospitals, sports, private clinics, MPT.",
     "Clinic practice builds slowly",
     ["Hospitals", "Sports", "Clinics"]),
    ("occupational-therapist", "Occupational Therapist", "OT", "Healthcare", "From ~23",
     "Functional rehab after BOT.",
     ["ADL training", "Paediatric / adult OT"],
     ["Practice registration as applicable"],
     ["Adaptive rehab"],
     "Rehab hospitals, paediatrics, NGOs.",
     "Fewer posts than physio in some cities",
     ["Rehab centres", "Hospitals"]),
    ("audiologist", "Audiologist / SLP", "Audiologist", "Healthcare", "From ~22",
     "Hearing and speech-language practice after BASLP (RCI).",
     ["Audiometry", "Speech therapy"],
     ["RCI as applicable"],
     ["Assessment", "Therapy"],
     "Hospitals, schools, private clinics.",
     "Clinic and hospital mix",
     ["Hospitals", "Clinics", "Schools"]),
    ("optometrist", "Optometrist", "Optometrist", "Healthcare", "From ~22",
     "Primary eye care after B.Optom.",
     ["Refraction", "Contact lens", "Screening"],
     ["Practice norms"],
     ["Clinical optics"],
     "Optical chains, hospitals, own practice.",
     "Retail optical vs clinical",
     ["Optical retail", "Hospitals"]),
    ("lab-technologist", "Medical Lab Technologist", "Lab Tech", "Healthcare", "From ~21",
     "Diagnostic laboratory professional after B.Sc MLT or diploma routes.",
     ["Sample processing", "Quality control"],
     ["Paramedical credentials"],
     ["Lab accuracy"],
     "Hospitals and diagnostic chains.",
     "Structured hospital pay",
     ["Hospitals", "Labs"]),
    ("radiology-technologist", "Radiology Technologist", "Radiographer", "Healthcare", "From ~21",
     "Imaging technologist after B.Sc radiology / diploma.",
     ["Positioning", "Radiation safety"],
     ["Paramedical credentials"],
     ["Protocols", "Safety"],
     "Hospitals and imaging centres.",
     "Hospital bands",
     ["Hospitals", "Imaging centres"]),
    ("chartered-accountant", "Chartered Accountant", "CA", "Finance", "From ~23",
     "ICAI member after Foundation, Intermediate, articleship, and Final.",
     ["Audit", "Tax", "Reporting"],
     ["ICAI membership"],
     ["Judgement", "Ethics"],
     "Practice, CFO-track, consulting.",
     "Articleship stipends low; qualified packages rise quickly",
     ["CA firms", "Big Four", "Industry", "Practice"]),
    ("company-secretary", "Company Secretary", "CS", "Finance", "From ~23",
     "ICSI member — governance, listings, board support.",
     ["Secretarial practice", "Companies Act"],
     ["ICSI membership"],
     ["Compliance", "Drafting"],
     "Listed companies, practice, law-adjacent roles.",
     "In-house CS vs practice",
     ["Corporates", "Practice"]),
    ("cost-accountant", "Cost Accountant (CMA)", "CMA", "Finance", "From ~23",
     "ICMAI member — cost audit, manufacturing finance, performance management.",
     ["Cost audit", "Management accounting"],
     ["ICMAI membership"],
     ["Costing", "Control"],
     "Manufacturing, infrastructure, practice.",
     "Industry finance bands",
     ["Industry", "Practice"]),
    ("investment-analyst", "Investment / Finance Analyst", "Finance Analyst", "Finance", "From ~21",
     "Research, markets, or corporate finance. Commerce, economics, engineering, or MBA all appear — internships decide.",
     ["Modelling", "Accounting", "Markets"],
     ["Optional CFA / FRM"],
     ["Modelling", "Memos"],
     "Banks, AMCs, corporates. MBA is a common accelerator.",
     "Varies by institute and desk",
     ["Banks", "AMCs", "Corporates"]),
    ("actuary", "Actuary", "Actuary", "Finance", "From ~23",
     "IFoA / IAI exam series plus a quantitative degree. Insurance and risk.",
     ["Probability", "Financial maths", "Insurance"],
     ["IAI / IFoA papers"],
     ["Probability", "Modelling"],
     "Long exam path; insurers and consultancies.",
     "Qualified actuaries are well paid; students less so",
     ["Insurers", "Consultancies"]),
    ("banker", "Banker (PO / specialist)", "Banker", "Finance", "From ~21",
     "Public and private bank officers. Any bachelor’s plus IBPS/SBI exams for PSU banks; campus for private.",
     ["Banking ops", "Credit basics"],
     ["IBPS / SBI PO; campus"],
     ["Customer + credit"],
     "A major graduate employer across streams.",
     "PSU scales vs private targets",
     ["PSU banks", "Private banks"]),
    ("lawyer", "Lawyer", "Lawyer", "Law", "From ~23",
     "Enrolled advocate after LL.B. and bar enrolment.",
     ["Procedure in practice", "Chambers"],
     ["AIBE as applicable"],
     ["Advocacy", "Drafting"],
     "Litigation builds slowly; firms can start sooner.",
     "Litigation uneven; firms more predictable",
     ["Courts", "Firms", "In-house"]),
    ("inhouse-counsel", "In-house / Corporate Counsel", "Counsel", "Law", "From ~24",
     "Company legal teams. LL.B. plus internships; often a few years in a firm first.",
     ["Contracts", "Compliance", "Advisory"],
     ["Interviews"],
     ["Business judgement", "Drafting"],
     "Corporates, start-ups, PSUs.",
     "Corporate legal bands",
     ["Companies", "PSUs"]),
    ("civil-servant", "Civil Servant (UPSC / State)", "Civil Services", "Public service", "From ~22",
     "IAS, IPS, IFS and others via UPSC CSE, or state PSCs. Any recognised bachelor’s; preparation is the filter.",
     ["GS", "Optional", "Essay", "Interview"],
     ["UPSC CSE", "State PSC"],
     ["Answer writing", "Wide reading"],
     "Extremely competitive. Keep a backup career.",
     "Pay matrix plus service role",
     ["Districts", "Ministries", "Police/IFS as allotted"]),
    ("police-officer", "Police Officer (DSP / state)", "Police Officer", "Public service", "From ~22",
     "State police services via PSC, or IPS via UPSC. Physical standards apply for many posts.",
     ["Law & order training", "Investigation basics"],
     ["UPSC / state PSC + physicals"],
     ["Leadership", "Fitness"],
     "State police and central police organisations.",
     "Government pay + allowances",
     ["State police", "CAPFs related paths"]),
    ("defence-officer", "Armed Forces Officer", "Defence Officer", "Defence", "From ~20",
     "Commissioned officer after NDA, CDS, or technical entries. SSB and medicals are decisive.",
     ["Service training", "Leadership"],
     ["NDA / CDS + SSB"],
     ["Leadership", "Fitness"],
     "Structured career with postings and later resettlement.",
     "Pay commission scales",
     ["Army", "Navy", "Air Force"]),
    ("commercial-pilot", "Commercial Pilot", "Pilot", "Aviation", "From ~19",
     "CPL via DGCA after Class 12 PCM (maths & physics) plus flying hours. Expensive training path.",
     ["Flying hours", "Air navigation", "Meteorology"],
     ["DGCA exams + medicals"],
     ["Airmanship", "Discipline"],
     "Airlines and charter. Type rating is an extra cost.",
     "Training is costly; airline pay later is high",
     ["Airlines", "Charter"]),
    ("merchant-navy-officer", "Merchant Navy Officer", "Merchant Navy", "Maritime", "From ~20",
     "Deck or engine officer after IMU / sponsored marine programmes, typically with PCM.",
     ["Navigation or marine engineering", "Sea training"],
     ["IMU CET / sponsorships", "DG Shipping"],
     ["Watchkeeping", "Safety"],
     "Contract-based sea service; medical standards apply.",
     "Contract pay can be high; lifestyle is unique",
     ["Shipping companies"]),
    ("teacher", "School Teacher", "Teacher", "Education", "From ~23",
     "School teaching after a subject bachelor’s plus B.Ed and often CTET/TET.",
     ["Subject + pedagogy"],
     ["CTET / TET", "recruitments"],
     ["Explanation", "Classroom leadership"],
     "KVs, state and private schools. NET/Ph.D. for college.",
     "Government teacher pay is structured",
     ["Government schools", "Private schools"]),
    ("professor", "College / University Teacher", "Professor", "Education", "From ~27",
     "Higher education teaching. Master’s plus NET/Ph.D. as per UGC rules for permanent posts.",
     ["Research", "Teaching"],
     ["NET/JRF", "Ph.D. admissions"],
     ["Scholarship", "Lecturing"],
     "Colleges, universities, research centres.",
     "UGC / state pay scales",
     ["Colleges", "Universities"]),
    ("journalist", "Journalist", "Journalist", "Media", "From ~21",
     "Reporting and editing. BJMC, English, or political science plus internships and clips.",
     ["Reporting", "Beat knowledge"],
     ["Newsroom tests"],
     ["Deadline writing", "Ethics"],
     "Print, digital, TV. Pay is uneven.",
     "Entry newsroom pay is often modest",
     ["Newspapers", "Digital", "Broadcast"]),
    ("content-strategist", "Content Strategist", "Content Strategist", "Media", "From ~21",
     "Plans brand and digital content systems — editorial calendars, SEO, and channel storytelling. Arts, journalism, or any degree plus a writing/design portfolio.",
     ["Editorial", "Social", "SEO basics"],
     ["Portfolio"],
     ["Writing", "Editing"],
     "Agencies, start-ups, in-house comms.",
     "Start-up vs agency bands",
     ["Agencies", "In-house"]),
    ("psychologist", "Psychologist", "Psychologist", "Healthcare", "From ~23",
     "Assessment and counselling. Master’s after psychology UG; check current RCI rules for clinical titles.",
     ["Assessment", "Practicum", "Ethics"],
     ["Master’s; RCI pathways where applicable"],
     ["Listening", "Boundaries"],
     "Hospitals, schools, private counselling, organisations.",
     "Practice builds slowly",
     ["Clinics", "Hospitals", "Schools"]),
    ("social-worker", "Social Worker", "Social Worker", "Social sector", "From ~21",
     "Community and case work after BSW/MSW or related social science plus field work.",
     ["Case work", "Community organisation"],
     ["NGO / hospital hiring"],
     ["Empathy", "Programme work"],
     "NGOs, hospitals, CSR, government schemes.",
     "NGO pay is often modest",
     ["NGOs", "Hospitals", "CSR"]),
    ("hotel-manager", "Hotel / Hospitality Manager", "Hotel Manager", "Hospitality", "From ~22",
     "Rooms, F&B, and operations leadership after BHM or diploma plus operations years.",
     ["Operations", "Guest recovery", "P&L basics"],
     ["Campus hotel hiring"],
     ["Service leadership"],
     "Hotel chains, resorts, QSR area roles.",
     "Ops allowances + tips culture varies",
     ["Hotels", "Resorts"]),
    ("chef", "Chef", "Chef", "Hospitality", "From ~20",
     "Kitchen professional via hotel management, craftsmanship certificates, or apprenticeships.",
     ["Cuisine", "Kitchen management"],
     ["Institute + kitchen trials"],
     ["Craft", "Stamina"],
     "Hotels, restaurants, cloud kitchens, entrepreneurship.",
     "Brigade structure; head chef later",
     ["Hotels", "Restaurants"]),
    ("entrepreneur", "Founder / Business Owner", "Entrepreneur", "Business", "Any time after a skill base",
     "Not a single qualification. Stack a domain plus internships, then start. MBA is optional.",
     ["Customers", "Basic finance", "Craft of the product"],
     ["None required"],
     ["Sales", "Resourcefulness"],
     "High variance. Prepare a domain rather than skipping one.",
     "Irregular by definition",
     ["Own venture", "Family business"]),
    ("marketing-manager", "Marketing Manager", "Marketing", "Business", "From ~23",
     "Brand and growth roles. BBA/MBA or any degree plus internships; MBA accelerates.",
     ["Campaigns", "Consumer insight"],
     ["Campus / MBA placements"],
     ["Positioning", "Analytics basics"],
     "FMCG, tech, agencies.",
     "MBA campus vs non-MBA",
     ["FMCG", "Tech", "Agencies"]),
    ("digital-marketing-manager", "Digital Marketing Manager", "Digital Marketing", "Business", "From ~23",
     "Owns paid, organic, and lifecycle digital channels — SEO, ads, analytics, and conversion. Often after a marketing degree or any degree plus a performance-marketing portfolio.",
     ["Performance ads", "SEO and content distribution", "Analytics and attribution"],
     ["Portfolio and case interviews"],
     ["Campaign craft", "Analytics", "Budget ownership"],
     "Agencies, D2C brands, and in-house growth teams. Live account results matter more than certificates.",
     "Agency vs in-house growth bands",
     ["Digital agencies", "D2C / e-commerce brands", "In-house growth teams"]),
    ("sustainability-manager", "Sustainability Manager", "Sustainability Mgr", "Environment", "From ~24",
     "Owns ESG reporting, carbon, and sustainability programmes in companies or consultancies. Often after an environment, engineering, or MBA background plus project years.",
     ["ESG frameworks", "Carbon and energy baselines", "Stakeholder reporting"],
     ["Hiring loops; optional GRI / ISO / ESG certificates"],
     ["Systems thinking", "Reporting", "Cross-functional influence"],
     "Manufacturing, IT services, FMCG, and consulting. Stronger after real projects than after a course alone.",
     "ESG specialist bands",
     ["Corporates ESG cells", "Sustainability consultancies", "Infrastructure and manufacturing"]),
    ("ev-engineer", "EV Engineer", "EV Eng.", "Engineering", "From ~21",
     "Designs or validates electric-vehicle systems — batteries, motors, power electronics, and charging. Mechanical, electrical, electronics, or automobile engineering is the usual base.",
     ["Battery and BMS basics", "Electric motors / power electronics", "Vehicle integration and testing"],
     ["Campus / lateral hiring; optional GATE"],
     ["Mechatronics", "Testing discipline", "Safety awareness"],
     "OEM EV programmes, tier-1 suppliers, and charging infrastructure. Portfolio projects and internships matter.",
     "EV OEM and supplier bands",
     ["EV OEMs", "Battery and motor suppliers", "Charging infra firms"]),
    ("healthcare-administrator", "Healthcare Administrator", "Healthcare Admin", "Healthcare", "From ~24",
     "Runs hospital or clinic operations — capacity, quality, billing, and compliance. Common after BHA/MBA healthcare, MPH, nursing leadership, or clinical years moving into admin.",
     ["Hospital operations", "Quality and accreditation", "Health economics basics"],
     ["Hospital / chain hiring; optional NABH-related training"],
     ["Operations", "People management", "Process discipline"],
     "Hospital chains, diagnostic networks, and health-tech ops. Experience on the floor beats a certificate alone.",
     "Hospital ops bands",
     ["Hospital chains", "Diagnostic networks", "Health insurers / TPAs"]),
    ("supply-chain-manager", "Supply Chain Manager", "Supply Chain", "Business", "From ~24",
     "Plans and runs inventory, logistics, and supplier networks so product arrives on time and on cost. Engineering, BBA, or MBA ops plus warehouse/plant years is a common path.",
     ["Demand and inventory planning", "Logistics and warehousing", "Supplier and cost management"],
     ["Ops / consulting hiring; optional APICS / CSCP later"],
     ["Planning", "Negotiation", "Data literacy"],
     "Manufacturing, retail, e-commerce, and 3PL. Floor experience is valued.",
     "Ops and SCM bands",
     ["Manufacturing", "Retail / e-commerce", "3PL logistics"]),
    ("hr-manager", "HR Manager", "HR", "Business", "From ~23",
     "People operations and business HR. BBA/MBA HR or psychology plus internships.",
     ["Talent", "ER", "Comp basics"],
     ["Campus HR"],
     ["Listening", "Process"],
     "Every industry; MBA HR is a common flag.",
     "HR bands lag some frontline roles",
     ["Corporates"]),
    ("economist", "Economist", "Economist", "Economics", "From ~23",
     "Research and policy economics after economics honours plus typically a master’s (DSE, IGIDR, ISI, abroad).",
     ["Econometrics", "Policy writing"],
     ["Master’s admissions; IES"],
     ["Modelling", "Writing"],
     "Think tanks, RBI/IES, consultancies, banks.",
     "Public IES vs private research",
     ["Government", "Think tanks", "Banks"]),
    ("special-educator", "Special Educator", "Special Educator", "Education", "From ~22",
     "Inclusive education after B.Ed special education or RCI diplomas plus a bachelor’s.",
     ["IEP", "Inclusive pedagogy"],
     ["RCI programmes", "TET variants"],
     ["Patience", "Adaptation"],
     "Inclusive schools, NGOs, therapy centres.",
     "School and NGO mix",
     ["Schools", "NGOs"]),
    ("environmental-scientist", "Environmental Scientist", "Env. Scientist", "Environment", "From ~22",
     "Impact, pollution, and conservation work after environmental science, forestry, or civil/chem with a relevant master’s.",
     ["EIA", "Sampling", "Policy"],
     ["NET; consultancy hiring"],
     ["Field + regulation"],
     "Consultancies, pollution boards, NGOs.",
     "Consultancy vs government boards",
     ["Consultancies", "Regulators", "NGOs"]),
    ("embedded-engineer", "Embedded Systems Engineer", "Embedded Eng.", "Engineering", "From ~21",
     "Firmware and hardware-near software. ECE/EE/CSE with C and microcontroller projects.",
     ["C", "RTOS", "Schematics"],
     ["Core company tests"],
     ["Low-level debug"],
     "Automotive, IoT, electronics product firms.",
     "Core embedded specialist bands",
     ["Auto", "Electronics", "IoT"]),
    ("robotics-automation-engineer", "Robotic & Automation Engineer", "Robotics & Auto.", "Engineering", "From ~21",
     "Designs and commissions industrial robots, PLCs, and cell automation on the shop floor — pick-and-place, welding, packaging, and material handling. Mech/ECE/EE (or mechatronics) with PLC and robot-lab projects; software/ROS paths also exist.",
     ["PLC and HMI", "Industrial robots (FANUC / ABB / KUKA)", "Sensors, actuators, and cell safety"],
     ["Core company tests; optional PLC / robot vendor certs"],
     ["Controls troubleshooting", "Mechanical + electrical integration", "Safety standards"],
     "Auto OEMs, ancillaries, FMCG plants, warehouses, and system integrators. Hands-on cell work beats a cert alone.",
     "About ₹4–10 LPA campus · ₹10–22 LPA with cell-commissioning depth",
     ["Auto OEMs", "System integrators", "FMCG / warehouses", "Electronics manufacturing"]),
    ("game-developer", "Game Developer", "Game Dev", "Technology", "From ~21",
     "Gameplay and engine work. CSE/B.Des/self-taught plus a shipped demo.",
     ["Unity/Unreal", "Gameplay programming or art"],
     ["Studio tests / reels"],
     ["Real-time systems or art pipeline"],
     "Studios and remote indie. Demo or GitHub is required.",
     "Studio vs indie variance",
     ["Game studios", "Indie"]),
    ("full-stack-developer", "Full Stack Developer", "Full Stack", "Technology", "From ~21",
     "Builds both the user interface and the server/API behind it. Shipped web apps matter more than the exact degree title.",
     ["A frontend framework", "APIs and databases", "Git and deployment"],
     ["Interviews; take-home builds"],
     ["JavaScript/TypeScript", "A backend language", "Debugging"],
     "Product firms, IT services, and start-ups; a natural first title after B.Sc CS or BCA.",
     "Services campus to product full-stack bands",
     ["Product firms", "IT services", "Start-ups"]),
    ("cloud-engineer", "Cloud Engineer", "Cloud Eng.", "Technology", "From ~21",
     "Designs and runs applications on AWS, Azure, or GCP — networking, IAM, cost, and reliability.",
     ["Cloud architecture", "Linux and networking", "Infrastructure as code"],
     ["Interviews; optional AWS/Azure/GCP certs"],
     ["Cloud platforms", "Automation"],
     "Every industry moving workloads to the cloud; production labs help more than a cert alone.",
     "Specialist cloud bands above generic IT",
     ["IT services", "Product firms", "Consultancies"]),
    ("cloud-architect", "Cloud Architect", "Cloud Architect", "Technology", "From ~25",
     "Designs multi-service cloud systems on AWS, Azure, or GCP — landing zones, security boundaries, cost, and reliability. Usually after software or cloud engineering years, not a first campus title.",
     ["Reference architectures", "Multi-account / landing zones", "Cost, security, and reliability trade-offs"],
     ["Architecture interviews; optional professional-level cloud certs"],
     ["System design", "Cloud platforms", "Stakeholder communication"],
     "Product firms, IT services architecture practices, and consultancies. Stronger after production cloud years than after a cert alone.",
     "Mid-to-senior cloud architecture bands",
     ["Product firms", "IT services architecture", "Cloud consultancies"]),
    ("devops-engineer", "DevOps Engineer", "DevOps", "Technology", "From ~21",
     "Connects development and operations: CI/CD, containers, observability, and release safety.",
     ["Linux", "CI/CD", "Containers and Kubernetes"],
     ["Hiring loops; optional CKA later"],
     ["Automation", "Incident response"],
     "Product and services firms; often a second role after software engineering.",
     "Specialist platform bands",
     ["Product firms", "IT services", "Start-ups"]),
    ("qa-automation-engineer", "QA / Automation Testing Engineer", "QA Automation", "Technology", "From ~21",
     "Writes automated tests and quality gates so software ships safely. Coding testers are preferred over purely manual QA.",
     ["Test design", "Selenium / Playwright / API tests", "CI integration"],
     ["QA interviews; coding screens"],
     ["Test thinking", "Scripting"],
     "IT services campus hiring is large; product firms want automation, not only manual cycles.",
     "Services QA to SDET bands",
     ["IT services", "Product firms", "Captives"]),
    ("database-administrator", "Database Administrator", "DBA", "Technology", "From ~21",
     "Keeps databases available, fast, and recoverable — backups, tuning, access control, and increasingly cloud data platforms.",
     ["SQL", "Backup and recovery", "Performance tuning"],
     ["Interviews; optional vendor certs"],
     ["SQL", "Operations discipline"],
     "Banks, enterprises, and cloud migrations still need DBAs; many roles now blend with data engineering.",
     "Enterprise DBA bands",
     ["Enterprises", "Banks", "IT services"]),
    ("business-analyst", "Business Analyst", "BA", "Technology", "From ~21",
     "Turns business problems into requirements and process change. IT-BA work is a common path from computing degrees in Indian services firms.",
     ["Requirements", "Process mapping", "Basic SQL / Excel"],
     ["BA interviews; case-style screens"],
     ["Stakeholder communication", "Analysis"],
     "IT services, banks, product ops; an MBA later can move you toward PM or consulting.",
     "Services BA to specialist bands",
     ["IT services", "Banks", "Product ops"]),
]

for p in PROF:
    nodes.append(node(p[0], p[1], p[2], "profession", p[3], "Career", p[4], p[5], p[6], p[7], p[8], p[9], p[10], p[11]))

_certs_file = Path(__file__).with_name("profession_certs.json")
if _certs_file.exists():
    _certs_data = json.loads(_certs_file.read_text(encoding="utf-8"))
    _by_id = _certs_data.get("byId", {})
    _by_field = _certs_data.get("byField", {})
    for n in nodes:
        if n.get("kind") != "profession":
            continue
        certs = _by_id.get(n["id"]) or _by_field.get(n["field"])
        if certs:
            n["certifications"] = certs

# Experience-required mid-career professions (structured; UI + ranking consume these).
EXPERIENCE = {
    "cloud-architect": {
        "experienceYearsMin": 3,
        "experienceYearsTypical": 5,
        "entryLevel": "experienced",
        "feederRoles": ["cloud-engineer", "software-engineer", "devops-engineer"],
    },
    "product-manager": {
        "experienceYearsMin": 2,
        "experienceYearsTypical": 4,
        "entryLevel": "experienced",
        "feederRoles": ["software-engineer", "full-stack-developer", "business-analyst"],
    },
    "content-strategist": {
        "entryLevel": "early",
    },
    "marketing-manager": {
        "experienceYearsMin": 2,
        "experienceYearsTypical": 4,
        "entryLevel": "experienced",
        "feederRoles": ["content-strategist", "digital-marketing-manager"],
    },
    "digital-marketing-manager": {
        "experienceYearsMin": 2,
        "experienceYearsTypical": 4,
        "entryLevel": "experienced",
        "feederRoles": ["content-strategist"],
    },
    "sustainability-manager": {
        "experienceYearsMin": 2,
        "experienceYearsTypical": 4,
        "entryLevel": "experienced",
        "feederRoles": ["civil-engineer", "chemical-engineer", "mechanical-engineer"],
    },
    "healthcare-administrator": {
        "experienceYearsMin": 2,
        "experienceYearsTypical": 5,
        "entryLevel": "experienced",
        "feederRoles": ["nurse", "pharmacist"],
    },
    "supply-chain-manager": {
        "experienceYearsMin": 2,
        "experienceYearsTypical": 5,
        "entryLevel": "experienced",
        "feederRoles": ["mechanical-engineer", "business-analyst"],
    },
    "hotel-manager": {
        "experienceYearsMin": 2,
        "experienceYearsTypical": 4,
        "entryLevel": "experienced",
        "feederRoles": ["chef"],
    },
    "hr-manager": {
        "experienceYearsMin": 2,
        "experienceYearsTypical": 4,
        "entryLevel": "experienced",
    },
}
for n in nodes:
    meta = EXPERIENCE.get(n["id"])
    if meta:
        n.update(meta)

# --- Edges ---
def add(*args):
    edges.append(edge(*args))

# Metric
add("metric", "hs-pcm", "Class 11–12 Science (PCM)", "Keep maths for engineering, architecture, pilot theory, and quantitative science.")
add("metric", "hs-pcb", "Class 11–12 Science (PCB)", "Required for NEET-based medical, dental, AYUSH, vet, and many allied health degrees.")
add("metric", "hs-pcmb", "Class 11–12 PCMB", "Heavier load; keeps JEE and NEET both possible.")
add("metric", "hs-commerce", "Class 11–12 Commerce", "Best default for CA, CS, CMA, accounting, and business degrees.")
add("metric", "hs-arts", "Class 11–12 Arts / Humanities", "Strong for law, UPSC, teaching, media, psychology, and design.")
add("metric", "hs-vocational", "Class 11–12 vocational", "Applied senior-secondary if you already know a trade family.")
add("metric", "diploma-eng", "State polytechnic entrance", "Start engineering skills two years earlier; later B.Tech via lateral entry.")
add("metric", "iti", "ITI counselling", "Trade skill first; diploma upgrade remains possible.")

add("iti", "diploma-eng", "Bridge / lateral into polytechnic", "Common upgrade from a trade certificate.")
add("hs-vocational", "diploma-eng", "Related polytechnic", "If the vocational subject is technical.")
add("hs-vocational", "diploma-hotel", "Hospitality diploma", "When the vocational stream is hospitality or related.")
add("hs-vocational", "gnm", "Nursing diploma (eligibility permitting)", "Healthcare vocational students may enter GNM/ANM routes.")
add("hs-vocational", "anm", "ANM counselling", "Community nursing diploma.")

# PCM / PCMB to UG
pcm_sources = ["hs-pcm", "hs-pcmb"]
pcb_sources = ["hs-pcb", "hs-pcmb"]

for src in pcm_sources:
    for bid, *_ in BTECH:
        add(src, bid, "JEE Main / Advanced or state CET", "Four-year engineering. Match the paper and counselling to the branch.")
    add(src, "barch", "NATA or JEE Main Paper 2", "Five-year professional architecture.")
    add(src, "bdes", "UCEED / NID / institute tests", "Design is open to PCM students with a portfolio.")
    add(src, "bca", "University / CUET", "Computing without a full B.Tech.")
    add(src, "bsc-physics", "CUET / university", "Pure science if you prefer research or teaching.")
    add(src, "bsc-chemistry", "CUET / university", "Chemistry honours; industry and M.Sc later.")
    add(src, "bsc-maths", "CUET / university", "Mathematics honours — data, actuarial, teaching, research.")
    add(src, "bsc-stats", "CUET / university", "Cleanest undergraduate statistics path.")
    add(src, "bsc-cs", "CUET / university", "Computing via B.Sc rather than B.Tech.")
    add(src, "bsc-it", "CUET / university", "IT via B.Sc.")
    add(src, "nda", "NDA (UPSC) + SSB", "Age and medical standards apply.")
    add(src, "bba", "IPMAT / NPAT / SET / CUET", "Management undergraduate; PCM students are eligible.")
    add(src, "llb5", "CLAT / AILET", "National law universities accept all streams.")
    add(src, "commercial-pilot", "DGCA Class 1 medical + CPL school", "Physics and maths in Class 12 are required for Indian CPL.")
    add(src, "merchant-navy-officer", "IMU CET / sponsored marine programmes", "PCM with medicals; deck or engine.")
    add(src, "ba-eco", "CUET economics", "If the university allows PCM students into economics honours.")

for src in pcb_sources:
    add(src, "mbbs", "NEET-UG", "All-India and state counselling. Keep a parallel plan.")
    add(src, "bds", "NEET-UG", "Same exam; separate dental counselling.")
    add(src, "bams", "NEET-UG + AYUSH counselling", "Ayurveda seats through AYUSH counselling.")
    add(src, "bhms", "NEET-UG + AYUSH counselling", "Homeopathy seats.")
    add(src, "bums", "NEET-UG + AYUSH counselling", "Unani seats.")
    add(src, "bvsc", "NEET-UG / state veterinary", "Veterinary counselling.")
    add(src, "bpharm", "Pharmacy counselling (some states use NEET)", "Industry and hospital pharmacy.")
    add(src, "pharmd", "Pharmacy counselling", "Longer clinical pharmacy degree.")
    add(src, "bsc-nursing", "NEET or state nursing entrance", "Clinical degree with hospital postings.")
    add(src, "bpt", "Allied-health counselling", "Physiotherapy.")
    add(src, "bot", "Allied-health counselling", "Occupational therapy.")
    add(src, "baslp", "University / allied-health", "Audiology and speech-language pathology.")
    add(src, "boptom", "University / allied-health", "Optometry.")
    add(src, "bsc-mlt", "Paramedical counselling", "Laboratory technology.")
    add(src, "bsc-rad", "Paramedical counselling", "Imaging technology.")
    add(src, "bsc-biotech", "CUET / university", "Life-science backup if NEET does not convert.")
    add(src, "bsc-micro", "CUET / university", "Microbiology honours.")
    add(src, "bsc-zoology", "CUET / university", "Zoology honours.")
    add(src, "bsc-botany", "CUET / university", "Botany honours.")
    add(src, "bsc-forensic", "University forensic admission", "Forensic science bachelor’s.")
    add(src, "bsc-food", "University / ICAR-related where applicable", "Food technology.")
    add(src, "bsc-agri", "ICAR / state agri entrance (eligibility varies)", "Some states allow PCB into agriculture.")
    add(src, "llb5", "CLAT / AILET", "Law remains open to PCB students.")
    add(src, "gnm", "State nursing diploma", "If you want a shorter nursing diploma instead of B.Sc Nursing.")

add("hs-pcm", "bsc-agri", "ICAR / state agri", "Many agri programmes want PCM or PCB — check the prospectus.")
add("hs-pcmb", "bsc-agri", "ICAR / state agri", "PCMB usually satisfies both PCM and PCB agri eligibility.")
add("hs-pcm", "btech-biotech", "JEE / CET", "Biotechnology engineering.")
add("hs-pcb", "btech-biotech", "Some universities allow PCB into B.Tech biotech", "Check each college; not universal.")

# Commerce
add("hs-commerce", "bcom", "University / CUET", "Pairs with CA/CS/CMA papers.")
add("hs-commerce", "bcom-hons", "CUET / college cut-offs", "Honours commerce for deeper accounting.")
add("hs-commerce", "bba", "NPAT / SET / IPMAT / CUET", "More management, less pure accountancy.")
add("hs-commerce", "bms", "University BMS tests", "Management studies.")
add("hs-commerce", "ca-foundation", "ICAI Foundation", "You can begin CA around Class 12.")
add("hs-commerce", "bca", "University (maths may be required)", "Commerce + maths can enter computing.")
add("hs-commerce", "llb5", "CLAT / AILET", "Corporate law is a frequent commerce-to-law story.")
add("hs-commerce", "ba-eco", "CUET economics", "Economics may sit in arts faculties.")
add("hs-commerce", "bjmc", "University media admission", "Business journalism and corporate comms later.")
add("hs-commerce", "cs-executive", "ICSI graduate/foundation route", "CS often starts Foundation or executive after 12th/graduation — follow current ICSI entry.")
add("hs-commerce", "cma-inter", "ICMAI entry after Foundation or 12th rules", "Follow current ICMAI registration.")

# Arts
add("hs-arts", "ba-eng", "CUET / university", "Literature path.")
add("hs-arts", "ba-hist", "CUET / university", "History path — popular UPSC optional.")
add("hs-arts", "ba-pol", "CUET / university", "Political science path.")
add("hs-arts", "ba-eco", "CUET / university", "Economics (check maths requirements).")
add("hs-arts", "ba-psy", "CUET / university", "Psychology undergraduate.")
add("hs-arts", "ba-soc", "CUET / university", "Sociology.")
add("hs-arts", "bsw", "University BSW", "Social work bachelor’s.")
add("hs-arts", "bjmc", "University / media tests", "Journalism undergraduate.")
add("hs-arts", "llb5", "CLAT / AILET / SLAT", "Most direct school-to-law route.")
add("hs-arts", "bba", "Management UG tests", "Humanities students are eligible for many BBA programmes.")
add("hs-arts", "bdes", "NID / NIFT / UCEED", "Design school after Class 12.")
add("hs-arts", "bfa", "Fine arts entrance + portfolio", "Studio arts.")
add("hs-arts", "graphic-designer", "Portfolio or design school", "Some enter junior design roles with a strong portfolio even without B.Des.")
add("hs-arts", "bel-ed", "B.El.Ed entrance", "Integrated elementary teaching degree where offered.")
add("hs-arts", "bp-ed", "B.P.Ed / PE entrance", "If you have the sports background some institutes want.")

# Diploma onward
add("diploma-eng", "btech-cse", "Lateral entry LEET (allied branch)", "Join year two in an allied B.Tech branch.")
add("diploma-eng", "btech-mech", "Lateral entry", "Mechanical / production related diplomas.")
add("diploma-eng", "btech-civil", "Lateral entry", "Civil / architectural assistant diplomas.")
add("diploma-eng", "btech-ee", "Lateral entry", "Electrical diplomas.")
add("diploma-eng", "btech-ece", "Lateral entry", "Electronics diplomas.")
add("diploma-eng", "civil-engineer", "Junior engineer / technician posts", "Some public JE posts take diplomas directly.")
add("diploma-eng", "mechanical-engineer", "Technician / JE roles", "Shop-floor and maintenance; design still prefers B.Tech.")
add("diploma-eng", "electrical-engineer", "JE electrical posts", "State power utilities often recruit diploma holders.")
add("diploma-pharmacy", "bpharm", "Lateral entry to B.Pharm", "Upgrade diploma to degree.")
add("diploma-pharmacy", "pharmacist", "Pharmacy council registration", "D.Pharm allows registered pharmacist practice as per rules.")
add("gnm", "bsc-nursing", "Post-basic B.Sc Nursing", "Degree upgrade for GNM nurses.")
add("gnm", "nurse", "Nursing council registration", "Begin practice as a registered nurse.")
add("anm", "gnm", "GNM after ANM (where permitted)", "Step up to general nursing.")
add("anm", "nurse", "Limited community nurse posts", "ANM roles in public health; GNM/B.Sc widens hospital options.")
add("diploma-hotel", "bhm", "Lateral / related BHM", "Degree upgrade.")
add("diploma-hotel", "hotel-manager", "Operations + years in hotels", "Supervisory roles grow with experience.")
add("diploma-hotel", "chef", "Kitchen training track", "If the diploma emphasised food production.")

# Shared UG onward helpers
BTECH_IDS = [x[0] for x in BTECH]
SCI_IDS = [x[0] for x in SCI]
BA_IDS = ["ba-eng", "ba-hist", "ba-pol", "ba-eco", "ba-psy", "ba-soc"]

for bid in BTECH_IDS:
    add(bid, "mtech", "GATE", "Specialise or target PSU/teaching.")
    add(bid, "mba", "CAT / XAT / GMAT", "Common after 0–3 years of work.")
    add(bid, "civil-servant", "UPSC CSE / state PSC", "Any bachelor’s is enough academically.")
    add(bid, "entrepreneur", "Build in a domain you know", "Use internships and a first job to learn customers.")
    add(bid, "llb3", "3-year LL.B.", "Patent and technology law often attract engineers.")
    add(bid, "cds-ima", "CDS + SSB (age/medicals)", "Graduate defence entry.")
    add(bid, "banker", "IBPS / SBI / campus", "Engineering graduates are eligible for bank PO exams.")
    add(bid, "product-manager", "After software/core years or MBA internship", "Rare as a direct campus title except at a few firms.")

add("btech-cse", "software-engineer", "Campus or off-campus hiring", "Smoothest engineering-to-software branch.")
add("btech-it", "software-engineer", "Campus hiring", "IT branch is treated like CSE by most software employers.")
add("btech-ai", "software-engineer", "Campus hiring", "AI degrees still compete on DSA and projects.")
add("btech-ai", "data-scientist", "ML projects + internships", "Strongest undergraduate signal for data/ML among B.Tech titles.")
add("btech-ai", "ml-engineer", "ML systems projects", "Production ML roles.")
add("btech-ai", "prompt-engineer", "LLM app / evaluation projects", "AI degrees plus shipped prompt workflows are a clean fit.")
add("btech-cse", "data-scientist", "Stats/ML portfolio", "Add statistics; do not rely on the branch name.")
add("btech-cse", "ml-engineer", "Systems + ML internships", "Closer to software than research.")
add("btech-cse", "prompt-engineer", "LLM demos + evaluation harnesses", "CSE grads who ship GenAI features, not only chat experiments.")
add("btech-cse", "cloud-architect", "Cloud projects + architecture depth", "Usually after software/cloud years; campus titles are rare.")
add("btech-cse", "cybersecurity-analyst", "Security electives + certs", "SOC and product security.")
add("btech-cse", "game-developer", "Shipped demo / studio internships", "Games hire on demos.")
add("btech-cse", "uiux-designer", "HCI electives + portfolio", "Possible but B.Des is cleaner; portfolio required.")
add("btech-cse", "embedded-engineer", "Systems electives", "Possible; ECE is a more typical embedded degree.")
add("btech-it", "cybersecurity-analyst", "Networks + security labs", "IT networks background helps SOC roles.")
add("btech-it", "cloud-architect", "Cloud labs + production experience", "IT branch plus cloud depth; architecture interviews matter.")
add("btech-ai", "cloud-architect", "Platform/MLOps path into cloud design", "Possible when you design platforms, not only train models.")
add("btech-it", "data-analyst", "BI internships", "Analyst roles when ML depth is not yet there.")
add("btech-ece", "electronics-engineer", "Core ECE placements / GATE", "VLSI, embedded, telecom.")
add("btech-ece", "embedded-engineer", "Embedded internships", "C and microcontroller projects.")
add("btech-ece", "software-engineer", "DSA + internships", "Large numbers of ECE graduates switch to software.")
add("btech-ece", "cloud-architect", "DSA + cloud after a software switch", "Common ECE-to-software path, then cloud architecture later.")
add("btech-ece", "electrical-engineer", "Allied electrical roles", "Overlap with EE in some PSUs.")
add("btech-ee", "electrical-engineer", "Core EE / GATE / ESE", "Utilities and PSUs.")
add("btech-ee", "embedded-engineer", "Control + embedded", "Power electronics and industrial embedded.")
add("btech-ee", "robotics-automation-engineer", "PLC / drives / industrial control", "Electrical grads fit plant automation and robot power/control work.")
add("btech-ee", "software-engineer", "Switch with DSA", "Common when core seats are few.")
add("btech-ee", "ev-engineer", "Power electronics + motor control", "Electrical grads fit motors, chargers, and BMS-adjacent roles.")
add("btech-ece", "ev-engineer", "Power electronics / embedded for EVs", "Controls and embedded for battery and motor systems.")
add("btech-ece", "robotics-automation-engineer", "Controls + sensors + robot labs", "ECE is a common path into industrial automation and robotics cells.")
add("btech-mech", "mechanical-engineer", "Core mechanical / GATE", "Manufacturing internships matter.")
add("btech-mech", "aerospace-engineer", "Aero electives or GATE AE", "Some mechanical grads enter aero structures.")
add("btech-mech", "ev-engineer", "EV / powertrain electives + internships", "Mechanical grads enter battery, thermal, and vehicle integration.")
add("btech-mech", "robotics-automation-engineer", "Mechatronics / manufacturing automation electives", "Mechanical grads often join robot cells, fixtures, and plant automation.")
add("btech-mech", "sustainability-manager", "Energy / EHS years then ESG", "Plant energy roles often grow into sustainability.")
add("btech-cse", "robotics-automation-engineer", "ROS / vision / robot software projects", "Possible when you ship robot software, not only web apps.")
add("btech-ai", "robotics-automation-engineer", "Perception / planning for robots", "When the work is robot vision or motion planning, not only cloud ML.")
add("btech-auto", "mechanical-engineer", "Auto OEM / ancillary hiring", "Vehicle industry mechanical roles.")
add("btech-auto", "ev-engineer", "EV projects + OEM internships", "Automobile programmes are a natural EV path.")
add("btech-civil", "civil-engineer", "Core civil / GATE / ESE", "Site and design internships.")
add("btech-civil", "urban-planner", "Planning master’s later", "B.Tech civil is an accepted planning UG for many M.Plan programmes.")
add("btech-civil", "sustainability-manager", "Green building / ESG projects", "Infrastructure ESG and reporting pathways.")
add("btech-chem", "chemical-engineer", "Process industry / GATE", "Plants and FMCG.")
add("btech-chem", "sustainability-manager", "EHS / ESG projects + years", "Process industries need carbon and compliance owners.")
add("btech-chemeng-petro", "chemical-engineer", "Energy / process hiring", "Petroleum programmes feed process and energy firms.")
add("btech-aero", "aerospace-engineer", "Core aero / ISRO / GATE", "Niche core market.")
add("btech-aero", "mechanical-engineer", "Structures / manufacturing overlap", "Backup core path.")
add("btech-biotech", "biotech-scientist", "Internships + often M.Tech/M.Sc", "Industry scientists often need a master’s.")
add("btech-biotech", "data-analyst", "Bioinformatics electives", "Computational biology adjacent.")
add("btech-cse", "digital-marketing-manager", "Growth / analytics switch", "Possible with a strong analytics and campaign portfolio.")

add("bca", "software-engineer", "Projects and internships", "Compete with B.Tech via portfolio.")
add("bca", "cloud-architect", "Cloud portfolio + years of ops/build", "Compete via production experience and professional certs.")
add("bca", "mca", "NIMCET / university MCA", "Usual academic upgrade.")
add("bca", "mba", "CAT", "Product/management later.")
add("bca", "civil-servant", "UPSC / PSC", "Eligible after bachelor’s.")
add("bca", "data-analyst", "SQL + BI projects", "Analyst roles without a full data-science master’s.")
add("mca", "software-engineer", "Campus / lateral hiring", "Postgraduate computing credential.")
add("mca", "cloud-architect", "Cloud electives + architecture practice", "Postgraduate computing plus real cloud systems.")
add("mca", "data-scientist", "ML electives + portfolio", "Add statistics.")
add("mca", "cybersecurity-analyst", "Security electives", "Possible postgraduate computing path.")

for sid in SCI_IDS:
    add(sid, "msc", "IIT JAM / CUET-PG", "Deepen the same or allied science.")
    add(sid, "bed", "B.Ed admission", "School teaching in the science subject.")
    add(sid, "civil-servant", "UPSC / PSC", "Science optionals exist.")
    add(sid, "mba", "CAT", "Science graduates are eligible.")
    add(sid, "llb3", "3-year LL.B.", "After any bachelor’s.")
    add(sid, "banker", "IBPS / SBI", "Any graduate.")
    add(sid, "cds-ima", "CDS + SSB", "Graduate defence entry.")

add("bsc-cs", "software-engineer", "Coding practice + internships", "Possible without MCA if the portfolio is strong.")
add("bsc-cs", "full-stack-developer", "Projects in a web stack + internships", "A common first product/start-up title when the portfolio shows frontend and backend.")
add("bsc-cs", "data-analyst", "SQL + BI projects", "A frequent first data job after B.Sc CS without a master’s.")
add("bsc-cs", "data-scientist", "Stats/ML portfolio or M.Sc", "Stronger with maths electives; internships matter more than the degree title.")
add("bsc-cs", "ml-engineer", "ML systems projects + internships", "Closer to software than research; a strong Python base helps.")
add("bsc-cs", "cloud-engineer", "Cloud labs + internships", "Hireable from B.Sc CS when you can deploy and operate, not only pass a cert exam.")
add("bsc-cs", "cloud-architect", "Cloud labs then production years", "Hireable later when you can design, not only deploy.")
add("bsc-cs", "cybersecurity-analyst", "Security electives + certs", "SOC and GRC roles; certifications help campus and lateral hiring.")
add("bsc-cs", "devops-engineer", "Linux + CI/CD projects", "Often after a first software job; internships that ship pipelines count.")
add("bsc-cs", "qa-automation-engineer", "Test automation projects", "A common campus/services entry when you can code tests, not only manual QA.")
add("bsc-cs", "database-administrator", "SQL + DB internships", "Oracle/Postgres/SQL Server ops; cloud DBA work is growing.")
add("bsc-cs", "business-analyst", "Internships bridging IT and process", "IT-BA roles in services and product when you can talk to both users and engineers.")
add("bsc-cs", "uiux-designer", "HCI electives + portfolio", "Possible from B.Sc CS if the Figma/research portfolio is strong; B.Des is cleaner.")
add("bsc-cs", "mca", "MCA entrance", "Common upgrade.")
add("bsc-cs", "mtech", "GATE", "Possible after B.Sc CS in CSE-related M.Tech; many IITs/NITs prefer B.Tech or a 4-year B.Sc — check eligibility.")
add("bsc-it", "software-engineer", "Projects + internships", "IT B.Sc to software.")
add("bsc-it", "cloud-architect", "Cloud + networking depth", "IT B.Sc into cloud engineering, then architecture.")
add("bsc-it", "mca", "MCA entrance", "Academic upgrade.")
add("bsc-maths", "data-scientist", "Python + stats projects or M.Sc", "Maths is an underrated data path.")
add("bsc-maths", "actuary", "IAI / IFoA papers", "Start actuarial papers alongside college.")
add("bsc-maths", "statistician", "M.Sc stats or ISS path", "Official statistics and analytics.")
add("bsc-stats", "data-scientist", "ML + programming", "Best-fit science UG for data.")
add("bsc-stats", "data-analyst", "Internships", "Direct analyst hiring.")
add("bsc-stats", "actuary", "Actuarial papers", "Natural quantitative overlap.")
add("bsc-stats", "statistician", "ISS / M.Sc stats", "Core statistics profession.")
add("bsc-physics", "research-scientist", "M.Sc then NET/Ph.D.", "Physics research is a long path.")
add("bsc-physics", "data-analyst", "Computational physics + Python", "A common pivot.")
add("bsc-chemistry", "biotech-scientist", "M.Sc chemistry / related industry", "Chemists in pharma QC/QA and R&D.")
add("bsc-chemistry", "pharmacist", "Not automatic — usually B.Pharm is required", "Use M.Sc/pharma industry labs rather than retail pharmacist titles.")
add("bsc-biotech", "biotech-scientist", "M.Sc recommended", "Wet-lab internships.")
add("bsc-micro", "biotech-scientist", "M.Sc microbiology", "Diagnostics and pharma micro.")
add("bsc-agri", "agronomist", "IBPS AFO / state agri / private inputs", "Core agriculture officer path.")
add("bsc-agri", "environmental-scientist", "Master’s in env / related", "Natural resource overlap.")
add("bsc-forestry", "environmental-scientist", "State forest / env master’s", "Forestry and conservation.")
add("bsc-forensic", "lab-technologist", "Forensic labs / police scientific", "Government forensic labs are competitive.")
add("bsc-food", "biotech-scientist", "Food industry QA / M.Sc", "FMCG and food labs.")
add("bsc-nursing", "nurse", "Nursing council registration", "Clinical posts.")
add("bsc-nursing", "mph", "MPH admissions", "Public-health pivot for nurses.")

add("msc", "data-scientist", "Computational / stats M.Sc + projects", "Especially statistics, maths, CS.")
add("msc", "research-scientist", "NET/JRF then Ph.D.", "Academic science.")
add("msc", "teacher", "B.Ed if needed + TET, or NET for college", "School vs college split.")
add("msc", "professor", "NET + Ph.D.", "Higher education.")
add("msc", "phd", "Institute Ph.D. admissions", "Research doctorate.")
add("msc", "biotech-scientist", "Life-science M.Sc hiring", "Industry and institutes.")
add("msc", "statistician", "If the M.Sc is statistics", "ISS and analytics.")
add("phd", "professor", "UGC / institute faculty hiring", "Doctorate plus publications.")
add("phd", "research-scientist", "Lab scientist posts", "CSIR, DBT, industry R&D.")

# Health
add("mbbs", "doctor", "Internship + medical registration", "You can practise after MBBS; specialisation is optional.")
add("mbbs", "md-ms", "NEET-PG / NEXT", "Required for most consultant specialist posts.")
add("mbbs", "civil-servant", "UPSC CSE or UPSC CMS", "Doctors also sit Combined Medical Services.")
add("mbbs", "mph", "Public health master’s", "Epidemiology and health systems.")
add("md-ms", "surgeon", "MS in a surgical specialty", "General surgery, orthopaedics, ENT, and others.")
add("md-ms", "doctor", "Practice as a specialist physician", "MD graduates continue as doctors with a specialty.")
add("md-ms", "professor", "Medical college teaching", "Faculty after PG and experience.")
add("bds", "dentist", "Internship + dental council", "Begin practice; MDS optional.")
add("bds", "mds", "NEET-MDS", "Dental specialisation.")
add("mds", "dentist", "Specialty dental practice", "Specialist dentist.")
add("bams", "ayush-physician", "AYUSH council registration", "Ayurveda practice as permitted by law.")
add("bhms", "ayush-physician", "AYUSH council registration", "Homeopathy practice as permitted.")
add("bums", "ayush-physician", "AYUSH council registration", "Unani practice as permitted.")
add("bvsc", "veterinarian", "Veterinary council registration", "Clinical and production practice.")
add("bpharm", "pharmacist", "Pharmacy council registration", "Retail, hospital, or industry.")
add("bpharm", "mpharm", "GPAT", "M.Pharm for R&D and academia.")
add("pharmd", "pharmacist", "Clinical pharmacy roles + registration", "Hospitals and pharmacovigilance.")
add("mpharm", "pharmacist", "Industry / hospital specialist pharmacist", "R&D and regulatory.")
add("bpt", "physiotherapist", "Internship + practice norms", "Begin physio practice.")
add("bpt", "mpt", "MPT admission", "Specialisation.")
add("mpt", "physiotherapist", "Specialty physiotherapy", "Advanced practice.")
add("bot", "occupational-therapist", "Clinical internships", "OT practice.")
add("baslp", "audiologist", "RCI as applicable", "Hearing and speech practice.")
add("boptom", "optometrist", "Clinical training", "Primary eye care.")
add("bsc-mlt", "lab-technologist", "Lab internships", "Diagnostic labs.")
add("bsc-rad", "radiology-technologist", "Hospital postings", "Imaging centres.")

# Architecture design
add("barch", "architect", "Council of Architecture registration", "Internship during B.Arch counts.")
add("barch", "mba", "CAT", "Real-estate or design management.")
add("barch", "urban-planner", "M.Plan / SPA", "Planning master’s.")
add("barch", "interior-designer", "Interior practice / diploma", "Many architects take interior projects.")
add("barch", "mdes", "CEED / design master’s", "Design research.")
add("bdes", "uiux-designer", "UX studios + portfolio", "If the major is communication/UI.")
add("bdes", "graphic-designer", "Communication design portfolio", "Agencies and brand teams.")
add("bdes", "fashion-designer", "If the major is fashion", "NIFT-style fashion B.Des.")
add("bdes", "animator", "If the major is animation / a reel", "Motion and animation studios.")
add("bdes", "interior-designer", "Interior B.Des", "Interior studios.")
add("bdes", "mdes", "CEED / M.Des", "Postgraduate design.")
add("bdes", "product-manager", "After design years in product companies", "Design-to-PM is a known path.")
add("bfa", "graphic-designer", "Applied art portfolio", "Illustration and visual design.")
add("bfa", "animator", "Animation electives / reel", "Studio art to motion.")
add("bfa", "teacher", "B.Ed for school art teacher", "Fine arts teaching.")
add("mdes", "uiux-designer", "Graduate design hiring", "Specialist UX.")
add("mdes", "graphic-designer", "Communication M.Des", "Senior visual roles.")

# Commerce professional
add("bcom", "ca-foundation", "ICAI Foundation if not cleared", "Many take Foundation in year one.")
add("bcom", "ca-inter", "Direct Intermediate after graduation as per ICAI rules", "Marks-based exemptions change — check ICAI.")
add("bcom", "mba", "CAT", "Finance and consulting aims.")
add("bcom", "investment-analyst", "Internships + modelling / CFA L1", "Campus finance or boutique research.")
add("bcom", "bed", "B.Ed", "Commerce teacher.")
add("bcom", "civil-servant", "UPSC / PSC", "Commerce optionals exist.")
add("bcom", "llb3", "3-year LL.B.", "Tax and corporate law.")
add("bcom", "entrepreneur", "Practice or a business", "Accounting literacy helps.")
add("bcom", "banker", "IBPS / SBI / campus", "Natural graduate employer.")
add("bcom", "cs-executive", "ICSI executive entry", "Graduate entry into CS.")
add("bcom", "cma-inter", "ICMAI intermediate entry", "Graduate entry into CMA.")
add("bcom", "actuary", "IAI papers (maths needed)", "Only if you can handle the quantitative papers.")
add("bcom-hons", "ca-inter", "ICAI graduate route", "Honours marks often help direct entry.")
add("bcom-hons", "investment-analyst", "Finance internships", "Stronger campus finance signal.")
add("bcom-hons", "mba", "CAT", "Finance MBA.")
add("bcom-hons", "banker", "Bank exams / campus", "Same as B.Com.")
for extra in ["civil-servant", "llb3", "cs-executive", "cma-inter", "bed"]:
    add("bcom-hons", extra, "Same onward exams as B.Com", "Honours is still a bachelor’s degree.")

add("bba", "mba", "CAT / XAT / GMAT", "Standard BBA → MBA ladder.")
add("bba", "investment-analyst", "Finance specialisation + internships", "Without MBA, internships matter more.")
add("bba", "civil-servant", "UPSC / PSC", "Eligible.")
add("bba", "entrepreneur", "Start or join a business", "Use BBA projects as experiments.")
add("bba", "llb3", "3-year LL.B.", "After graduation.")
add("bba", "marketing-manager", "Internships then MBA or years in brand", "MBA is the usual accelerator.")
add("bba", "digital-marketing-manager", "Digital marketing internships + portfolio", "Compete with live campaigns, not only theory.")
add("bba", "supply-chain-manager", "Ops internships then years in planning", "Warehouse and planning years matter.")
add("bba", "content-strategist", "Content internships + portfolio", "Writing and social portfolios open agency doors.")
add("bba", "hr-manager", "HR internships / MBA HR", "People operations.")
add("bba", "banker", "Bank exams", "Any graduate.")
add("bms", "mba", "CAT", "Treat like BBA.")
add("bms", "marketing-manager", "Internships", "Campus marketing.")
add("bms", "civil-servant", "UPSC", "Eligible.")

add("ca-foundation", "ca-inter", "Clear Foundation, register Intermediate", "Plan articleship seats early.")
add("ca-inter", "ca-final", "Articleship + Final exam", "Training years are full-time work plus study.")
add("ca-final", "chartered-accountant", "ICAI membership", "Exams + training + membership.")
add("ca-inter", "investment-analyst", "Articleship in transaction teams", "Some move to markets before Final.")
add("chartered-accountant", "investment-analyst", "Shift into markets, PE, or FP&A", "CA is respected beyond audit.")
add("chartered-accountant", "entrepreneur", "Practice or a business", "Many CAs run firms.")
add("cs-executive", "cs-professional", "Clear Executive, register Professional", "Then training.")
add("cs-professional", "company-secretary", "ICSI membership + training", "Governance professional.")
add("cma-inter", "cma-final", "Clear Intermediate", "Then Final and training.")
add("cma-final", "cost-accountant", "ICMAI membership", "CMA credential.")

add("mba", "investment-analyst", "MBA finance / consulting placements", "Summer internship converts.")
add("mba", "entrepreneur", "Build on industry knowledge", "Networks help; not required to found.")
add("mba", "civil-servant", "UPSC within age limits", "A backup some keep open.")
add("mba", "product-manager", "Product / consulting placements", "A common MBA convert role.")
add("mba", "marketing-manager", "Marketing placements", "FMCG and tech brand.")
add("mba", "digital-marketing-manager", "Digital / growth placements", "MBA marketing into performance and brand digital.")
add("mba", "supply-chain-manager", "Operations / supply-chain placements", "A common MBA ops convert.")
add("mba", "sustainability-manager", "ESG / strategy placements", "MBA with environment or ops electives.")
add("mba", "healthcare-administrator", "Healthcare / hospital management track", "When the MBA or prior degree is health-facing.")
add("mba", "hr-manager", "HR placements", "Business HR.")
add("mba", "banker", "Banking / markets placements", "Besides PO exams.")
add("mtech", "software-engineer", "CSE/ECE M.Tech hiring", "Research labs and specialist software.")
add("mtech", "cloud-architect", "CSE/IT M.Tech + cloud systems", "Specialist hiring when the thesis or work is systems-heavy.")
add("cloud-engineer", "cloud-architect", "Years designing larger systems", "Natural progression from operating cloud into owning reference architectures.")
add("devops-engineer", "cloud-architect", "Platform ownership + design reviews", "DevOps/platform engineers often grow into cloud architecture.")
add("software-engineer", "cloud-architect", "Systems design + cloud depth", "A common mid-career move when you own infrastructure choices.")
add("software-engineer", "product-manager", "Product years or MBA + shipped features", "Common mid-career move from engineering into PM.")
add("software-engineer", "prompt-engineer", "GenAI features inside products", "Many prompt roles grow out of software teams shipping LLM UX.")
add("full-stack-developer", "product-manager", "Shipped product work + stakeholder practice", "Full-stack builders often grow into PM.")
add("full-stack-developer", "prompt-engineer", "LLM-backed product features", "When you own the GenAI UX and evaluation, not only the UI.")
add("ml-engineer", "prompt-engineer", "Evaluation / LLM-app layer", "ML engineers often own prompt systems alongside model serving.")
add("data-scientist", "prompt-engineer", "LLM evaluation + experiment design", "Stats and experiment habits transfer well to prompt regression.")
add("content-strategist", "prompt-engineer", "AI content systems + brand voice", "Writers who systematise prompts for brand and product copy.")
add("business-analyst", "product-manager", "BA years then product ownership", "Requirements depth into owning the roadmap.")
add("content-strategist", "marketing-manager", "Brand / growth years", "Content into marketing leadership.")
add("chef", "hotel-manager", "Kitchen leadership then ops", "Culinary track into hotel management is possible but not the only path.")
add("mtech", "data-scientist", "Thesis in ML / data", "Publications help.")
add("mtech", "prompt-engineer", "If GenAI / NLP thesis or projects", "Specialist hiring when the work is LLM applications.")
add("bca", "prompt-engineer", "LLM app portfolio", "Compete via demos and evaluation notes, not the degree title alone.")
add("mca", "prompt-engineer", "GenAI electives + demos", "Postgraduate computing plus shipped prompt workflows.")
add("bsc-cs", "prompt-engineer", "LLM demos + clear writing", "A common adjacent path when you can evaluate outputs, not only call an API.")
add("btech-it", "prompt-engineer", "GenAI product / services projects", "IT programmes feeding services GenAI practices.")
add("ba-eng", "prompt-engineer", "Writing craft + LLM tooling", "Strong writers can enter prompt work with product-side partners.")
add("bjmc", "prompt-engineer", "Editorial systems + AI tooling", "Media grads who build repeatable AI content workflows.")
add("mtech", "civil-engineer", "If the M.Tech is civil", "Design consultancies and PSU.")
add("mtech", "mechanical-engineer", "If mechanical M.Tech", "R&D and advanced manufacturing.")
add("mtech", "electrical-engineer", "If electrical M.Tech", "Power and PSU.")
add("mtech", "electronics-engineer", "If ECE M.Tech", "VLSI and embedded R&D.")
add("mtech", "research-scientist", "Lab roles / Ph.D.", "Engineering research.")
add("mtech", "phd", "Doctoral admission", "After M.Tech.")

# Arts onward
for bid in BA_IDS:
    add(bid, "llb3", "3-year LL.B.", "Classic arts-to-law conversion.")
    add(bid, "bed", "B.Ed", "School teaching in the subject.")
    add(bid, "civil-servant", "UPSC CSE", "Popular optionals in humanities.")
    add(bid, "ma", "CUET-PG / university", "Master’s in the same or allied subject.")
    add(bid, "mba", "CAT", "Quant prep needs extra work for many arts students.")
    add(bid, "banker", "IBPS / SBI", "Any graduate.")
    add(bid, "journalist", "Internships and clips", "Especially English, pol sci, history.")
    add(bid, "cds-ima", "CDS + SSB", "Graduate defence entry.")

add("ba-eng", "content-strategist", "Writing portfolio", "Brand and digital content.")
add("ba-eng", "teacher", "B.Ed then TET", "English teacher.")
add("ba-hist", "teacher", "B.Ed then TET", "History teacher.")
add("ba-pol", "journalist", "Political reporting internships", "Natural beat.")
add("ba-eco", "economist", "M.A. Economics then IES/research", "Honours is not enough alone for economist titles.")
add("ba-eco", "investment-analyst", "Internships + modelling", "If you have maths/stats papers.")
add("ba-eco", "data-analyst", "Excel/SQL + economics intuition", "Business analyst adjacent.")
add("ba-eco", "statistician", "If the programme is quantitative", "Further stats master’s helps.")
add("ba-psy", "psychologist", "M.A./M.Sc Psychology + practicum / RCI path", "Master’s expected for practice.")
add("ba-psy", "hr-manager", "HR internships / MBA HR", "Organisational psychology adjacent.")
add("ba-soc", "social-worker", "MSW preferred", "Development sector.")
add("bsw", "social-worker", "Field work + MSW later", "Begin NGO/hospital social work.")
add("bsw", "msw", "MSW admission", "Standard upgrade.")
add("bjmc", "journalist", "Newsroom internships", "Clip file from year one.")
add("bjmc", "content-strategist", "Digital media internships", "Brand and social.")
add("ma", "professor", "NET + Ph.D.", "College teaching.")
add("ma", "teacher", "B.Ed + TET if school", "School teaching still wants B.Ed in many states.")
add("ma", "civil-servant", "UPSC", "Postgraduates remain eligible within age limits.")
add("ma", "phd", "Ph.D. admission", "Research.")
add("msw", "social-worker", "NGOs / hospitals / CSR", "Professional social work.")
add("msw", "civil-servant", "UPSC", "Eligible.")

add("llb5", "lawyer", "State bar enrolment + apprenticeship", "Moots and internships matter.")
add("llb5", "civil-servant", "UPSC / PSC", "Law is a strong optional.")
add("llb5", "inhouse-counsel", "Firm years or campus in-house", "Corporate legal.")
add("llb5", "mba", "CAT", "Compliance and management.")
add("llb3", "lawyer", "Bar enrolment", "Same profession as five-year degree.")
add("llb3", "civil-servant", "UPSC / judiciary / PSC", "Judiciary exams are law-specific.")
add("llb3", "inhouse-counsel", "Corporate internships", "In-house path.")
add("llm", "lawyer", "Specialist practice or academia", "LL.M. deepens; enrolment still needs LL.B.")
add("llm", "professor", "NET + teaching", "Law faculty.")
add("llm", "inhouse-counsel", "Specialist counsel", "Policy and corporate.")

add("bed", "teacher", "CTET / TET + recruitment", "Professional teaching credential.")
add("bed", "special-educator", "If B.Ed is in special education / extra RCI diploma", "Inclusive education.")
add("bed", "med", "M.Ed", "Education leadership.")
add("bel-ed", "teacher", "TET + primary recruitments", "Elementary teaching.")
add("med", "professor", "Teacher-education faculty", "With NET/Ph.D. as required.")
add("med", "teacher", "Senior school / leadership", "M.Ed plus experience.")
add("bp-ed", "teacher", "PE teacher recruitments", "School physical education.")
add("bp-ed", "special-educator", "Not automatic — add special-ed credentials if that is the goal", "PE and special ed are different qualifications.")

add("nda", "defence-officer", "Academy passing-out and commissioning", "Branch depends on merit, preference, medicals.")
add("cds-ima", "defence-officer", "Commission after academy", "IMA / OTA / INA / AFA as allotted.")
add("bhm", "hotel-manager", "Campus hotel hiring + operations years", "Management trainee programmes.")
add("bhm", "chef", "Culinary track inside BHM", "If you specialise in food production.")
add("bhm", "mba", "CAT later", "Hospitality to general management.")
add("bhm", "supply-chain-manager", "Procurement / F&B supply years", "Hospitality procurement can transfer to broader SCM.")
add("mph", "civil-servant", "UPSC / health administration", "Public health plus administration.")
add("mph", "research-scientist", "If you continue epidemiology research", "Often with a prior health degree.")
add("mph", "healthcare-administrator", "Hospital / public-health admin roles", "MPH into programme and facility administration.")
add("bsc-nursing", "healthcare-administrator", "Ward leadership then admin", "Many nurse leaders move into hospital administration.")
add("bpharm", "healthcare-administrator", "Hospital pharmacy / ops years", "Pharmacy ops into broader facility management.")
add("bsc-cs", "digital-marketing-manager", "Analytics + campaign projects", "Data-literate marketers are hireable from CS backgrounds.")
add("content-strategist", "digital-marketing-manager", "Years owning channels and budgets", "Content into digital marketing leadership.")
add("mechanical-engineer", "supply-chain-manager", "Plant / planning years", "Core engineers often move into supply chain.")
add("mechanical-engineer", "ev-engineer", "EV / EV-adjacent projects", "When the work is vehicle electrification.")
add("mechanical-engineer", "robotics-automation-engineer", "Shop-floor automation projects", "Mechanical engineers often move into robot cells and plant automation.")
add("mechanical-engineer", "sustainability-manager", "Energy / EHS years then ESG", "Plant energy roles often grow into sustainability.")
add("electrical-engineer", "robotics-automation-engineer", "Drives / PLC / industrial control years", "Plant electrical work often grows into full automation ownership.")
add("electronics-engineer", "robotics-automation-engineer", "Controls / sensors / robot electronics", "ECE core work overlaps heavily with automation cells.")
add("embedded-engineer", "robotics-automation-engineer", "MCU/RTOS into robot controllers", "Embedded engineers often grow into industrial robotics and cell control.")
add("diploma-eng", "robotics-automation-engineer", "Technician / junior automation roles", "Polytechnic + PLC training; design roles still prefer B.Tech.")
add("mtech", "robotics-automation-engineer", "If robotics / mechatronics / control M.Tech", "Specialist hiring when the thesis is automation-heavy.")
add("civil-engineer", "sustainability-manager", "ESG / green-building years", "Infrastructure and site roles often grow into corporate sustainability.")
add("chemical-engineer", "sustainability-manager", "EHS / ESG project years", "Process industries need carbon and compliance owners.")
add("nurse", "healthcare-administrator", "Clinical leadership then admin", "A common hospital career progression.")
add("digital-marketing-manager", "marketing-manager", "Broader brand ownership", "Digital leads often grow into full marketing leadership.")

# Deduplicate edges by from-to
uniq = {}
for e in edges:
    uniq[(e["from"], e["to"])] = e
edges = list(uniq.values())

# Validate references
ids = {n["id"] for n in nodes}
missing = [e for e in edges if e["from"] not in ids or e["to"] not in ids]
if missing:
    raise SystemExit(f"Unknown edge endpoints: {missing[:8]}")

dup_ids = [i for i, c in __import__("collections").Counter(n["id"] for n in nodes).items() if c > 1]
if dup_ids:
    raise SystemExit(f"Duplicate ids: {dup_ids}")

out = Path(__file__).resolve().parents[1] / "Seed" / "catalog.json"
out.parent.mkdir(parents=True, exist_ok=True)
payload = {
    "nodes": nodes,
    "edges": edges,
    "meta": {"nodeCount": len(nodes), "edgeCount": len(edges)},
}
out.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
print(f"Wrote {out} ({len(nodes)} nodes, {len(edges)} edges)")
