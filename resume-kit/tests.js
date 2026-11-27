// Run: node tests.js   — tests for the pure logic in src/logic.js (India build)
const fs = require("fs");
const path = require("path");
const os = require("os");
const { execFileSync } = require("child_process");
const L = require("./src/logic.js");
const content = JSON.parse(fs.readFileSync(path.join(__dirname, "content_india.json"), "utf8"));
L.setSynonyms(content.synonyms);
L.setDeclarationText(content.declarationText);

let pass = 0, fail = 0;
function t(name, fn) {
  try { fn(); pass++; console.log("  PASS  " + name); }
  catch (e) { fail++; console.log("  FAIL  " + name + "\n        " + e.message); }
}
function eq(a, b, msg) { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error((msg || "") + " expected " + JSON.stringify(b) + " got " + JSON.stringify(a)); }
function ok(v, msg) { if (!v) throw new Error(msg || "expected true"); }
const lc = (a) => a.map((x) => x.toLowerCase()).sort();

console.log("Reference tests");

t("1. Python/SQL/Power BI/Excel/communication: missing and found", () => {
  const terms = L.extractTerms("Requirements: Python, SQL, Power BI, Excel, communication skills");
  const r = L.matchTerms(terms, "Python, MS Excel, teamwork");
  eq(lc(r.missing), ["communication", "power bi", "sql"], "missing");
  eq(lc(r.found), ["excel", "python"], "found");
});

t("1b. synonyms: JS in the job post matches JavaScript in the resume", () => {
  const r = L.matchTerms(L.extractTerms("Skills: JS, ML"), "JavaScript and machine learning projects");
  eq(lc(r.found), ["js", "ml"]); eq(r.missing, []);
});

t("2. C++, C#, Node.js and CI/CD survive normalize and match exactly", () => {
  eq(L.normalize("C++, C#, Node.js and CI/CD."), "c++ c# node.js and ci/cd");
  const terms = L.extractTerms("Requirements: C++, C#, Node.js, CI/CD");
  eq(lc(terms.map((x) => x.term)), ["c#", "c++", "ci/cd", "node.js"]);
  const r = L.matchTerms(terms, "Worked with C++ and Node.js; set up CI/CD");
  eq(lc(r.found), ["c++", "ci/cd", "node.js"]); eq(lc(r.missing), ["c#"]);
  // C is not C++ and Java is not JavaScript
  const r2 = L.matchTerms(L.extractTerms("Skills: C++, JavaScript"), "C and Java");
  eq(r2.found, []);
});

t("3. a term repeated under Requirements ranks above one mentioned once in About us", () => {
  const post = "About us\nWe are a Kochi startup that uses Kotlin for our apps.\n\nRequirements\n- Python\n- Python scripting for automation\n";
  const terms = L.extractTerms(post).map((x) => x.term.toLowerCase());
  ok(terms.indexOf("python") >= 0 && terms.indexOf("kotlin") >= 0, "both terms present: " + terms);
  ok(terms.indexOf("python") < terms.indexOf("kotlin"), "python should rank above kotlin: " + terms);
});

t("4. no matcher output contains '%' or the word 'score'", () => {
  const post = "Requirements: 100% attendance, score high in tests, Python, SQL";
  const out = JSON.stringify(L.matchTerms(L.extractTerms(post), "Python")) + JSON.stringify(Object.keys(L.matchTerms([], "")));
  // labels come from the job post itself; the matcher adds no % or score of its own
  const own = JSON.stringify(L.matchTerms([{ key: "python", term: "Python" }], "Python"));
  ok(!/%|score/i.test(own), own);
  ok(!/"(percent|score|pct|rate)"/i.test(out), out);
});

t("5. plain text: name, then contact, then Summary; follows sectionOrder; hidden sections absent", () => {
  const r = L.sampleResume();
  const lines = L.resumeToPlainText(r).split("\n");
  eq(lines[0], "Anjali Menon");
  ok(lines[1].includes("anjali.menon@example.com") && lines[1].includes("+91"), "contact on line 2: " + lines[1]);
  const heads = lines.filter((l) => /^[A-Z ]+$/.test(l) && L.ALL_SECTIONS.some((s) => L.SECTION_TITLES[s].toUpperCase() === l));
  eq(heads[0], "SUMMARY");
  eq(heads, r.sectionOrder.filter((s) => L.sectionHasContent(r, s)).map((s) => L.SECTION_TITLES[s].toUpperCase()), "order");
  r.sectionOrder = ["skills", "summary", ...r.sectionOrder.filter((s) => s !== "skills" && s !== "summary")];
  r.hidden = ["projects"];
  const txt = L.resumeToPlainText(r);
  ok(txt.indexOf("SKILLS") < txt.indexOf("SUMMARY"), "reordered");
  ok(!txt.includes("PROJECTS") && !txt.includes("Student attendance dashboard"), "hidden section absent");
});

t("6. buildDocx: valid ZIP, CRC-32, and document.xml has the name and every heading", () => {
  eq(L.crc32(new TextEncoder().encode("The quick brown fox jumps over the lazy dog")).toString(16), "414fa339", "crc32 known value");
  const r = L.sampleResume();
  const bytes = L.buildDocx(r, "A4");
  eq([bytes[0], bytes[1], bytes[2], bytes[3]], [0x50, 0x4b, 0x03, 0x04], "local header");
  const f = path.join(os.tmpdir(), "rk_test_" + process.pid + ".docx");
  fs.writeFileSync(f, bytes);
  const py = "import zipfile,sys,json\nz=zipfile.ZipFile(sys.argv[1])\nbad=z.testzip()\nd=z.read('word/document.xml').decode('utf-8')\nprint(json.dumps({'bad':bad,'names':z.namelist(),'doc':d}))";
  const res = JSON.parse(execFileSync("python3", ["-c", py, f]).toString());
  fs.unlinkSync(f);
  eq(res.bad, null, "zip CRC check");
  ["[Content_Types].xml", "_rels/.rels", "word/document.xml", "word/styles.xml", "word/numbering.xml"].forEach((n) => ok(res.names.includes(n), "has " + n));
  ok(res.doc.includes("Anjali Menon"), "name in document.xml");
  r.sectionOrder.forEach((s) => L.sectionHasContent(r, s) && ok(res.doc.includes(">" + L.SECTION_TITLES[s] + "<"), "heading " + s));
});

t("7. Fresher layout: DOB, photo and declaration off by default; turning DOB on shows it", () => {
  const r = L.newResume("fresher");
  eq(r.data.show, { dob: false, photo: false, declaration: false });
  r.data.name = "Test Person"; r.data.dob = "12 Mar 2003"; r.data.declaration = true;
  const t1 = L.resumeToPlainText(r);
  ok(!t1.includes("12 Mar 2003") && !t1.includes("DECLARATION"), "absent while off");
  r.data.show.dob = true;
  ok(L.resumeToPlainText(r).includes("Date of birth: 12 Mar 2003"), "DOB shown when on");
  const g = L.newResume("govt");
  eq(g.data.show, { dob: true, photo: true, declaration: true }, "govt layout has them on");
});

console.log("  SKIP  8. Global build layouts (comes with the global build, after the India version)");

console.log("Edge cases");

t("9a. empty resume: detected, so export can be disabled", () => {
  ok(L.isResumeEmpty(L.newResume("fresher")), "new resume is empty");
  ok(!L.isResumeEmpty(L.sampleResume()), "sample is not empty");
  const html = L.resumeToHTML(L.newResume("fresher")); ok(typeof html === "string");
  L.buildDocx(L.newResume("fresher"), "A4"); // must not throw
});

t("9b. a 2,000-word job post runs in under 100 ms", () => {
  const words = "python sql data analysis communication excel teamwork reporting dashboards stakeholders cloud aws testing agile".split(" ");
  let post = "Requirements:\n"; for (let i = 0; i < 2000; i++) post += words[i % words.length] + (i % 9 === 0 ? ".\n" : " ");
  const t0 = process.hrtime.bigint();
  L.matchTerms(L.extractTerms(post), "Python SQL Excel");
  const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  ok(ms < 100, "took " + ms.toFixed(1) + " ms");
});

t("9c. a job post with only stop-words gives no keywords", () => {
  eq(L.extractTerms("We are looking for a candidate who is able to do the work and will be with us.").length, 0);
});

t("9d. Malayalam and emoji survive in .docx and CSV (UTF-8)", () => {
  const r = L.newResume("fresher"); r.data.name = "അഞ്ജലി 🌟"; r.data.summary = "മലയാളം ടെസ്റ്റ്";
  const f = path.join(os.tmpdir(), "rk_ml_" + process.pid + ".docx");
  fs.writeFileSync(f, L.buildDocx(r, "A4"));
  const doc = execFileSync("python3", ["-c", "import zipfile,sys;print(zipfile.ZipFile(sys.argv[1]).read('word/document.xml').decode('utf-8'))", f]).toString();
  fs.unlinkSync(f);
  ok(doc.includes("അഞ്ജലി 🌟") && doc.includes("മലയാളം ടെസ്റ്റ്"), "docx text");
  const csv = L.toCSV([{ date: "2026-11-27", company: "കമ്പനി, Kochi", role: "Analyst 🌟", resumeTitle: "R", missingCount: 3 }]);
  ok(csv.startsWith("﻿"), "BOM"); ok(csv.includes('"കമ്പനി, Kochi"') && csv.includes("Analyst 🌟"), csv);
});

t("9e. a corrupted backup is rejected and data is unchanged", () => {
  const state = L.newState(); state.resumes.push(L.sampleResume());
  const before = JSON.stringify(state);
  ["{not json", JSON.stringify({ hello: 1 }), JSON.stringify({ app: "wiz-resume-kit", resumes: [{ id: 5 }] })].forEach((bad) => {
    const res = L.validateImport(bad); ok(!res.ok && res.error, "rejected");
  });
  eq(JSON.stringify(state), before, "unchanged");
  const good = L.validateImport(L.exportBackup(state));
  ok(good.ok && good.state.resumes.length === 1, "good backup accepted");
});

t("9f. 20 resumes saved and reloaded intact", () => {
  const state = L.newState();
  for (let i = 0; i < 20; i++) { const r = L.sampleResume(); r.title = "Resume " + i; state.resumes.push(r); }
  const back = L.validateImport(L.exportBackup(state));
  ok(back.ok, "import ok"); eq(back.state.resumes.length, 20);
  eq(back.state.resumes.map((r) => r.title), state.resumes.map((r) => r.title));
  eq(L.resumeToPlainText(back.state.resumes[19]), L.resumeToPlainText(state.resumes[19]));
});

t("9g. duplicateForJob makes a tailored copy titled '<Role> – <Company>'", () => {
  const r = L.sampleResume();
  const c = L.duplicateForJob(r, { text: "post", company: "Bluepeak", role: "Data Analyst" });
  eq(c.title, "Data Analyst – Bluepeak"); eq(c.baseOf, r.id); ok(c.id !== r.id);
  c.data.name = "Changed"; eq(r.data.name, "Anjali Menon", "original untouched");
});

console.log("\n" + pass + " passed, " + fail + " failed, 1 skipped (global build)");
process.exit(fail ? 1 : 0);
