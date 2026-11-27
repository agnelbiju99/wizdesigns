/* ============================================================
   LOGIC — pure functions, no DOM. Loaded by the app and by tests.js.
   ============================================================ */
const LOGIC = (function () {
  "use strict";

  // ---------- Layouts (India) ----------
  // Each layout: section order, and which India-only extras are switched on by default.
  const LAYOUTS = {
    fresher:     { name: "Fresher (no experience)", order: ["summary", "education", "skills", "projects", "internships", "certifications", "achievements"], govt: false },
    serviceIT:   { name: "Service-company IT",      order: ["summary", "skills", "projects", "education", "certifications", "internships"], govt: false },
    nonIT:       { name: "Non-IT",                  order: ["summary", "education", "skills", "experience", "certifications", "activities"], govt: false },
    govt:        { name: "Government / PSU style",  order: ["summary", "education", "skills", "projects", "internships", "certifications", "achievements", "languages"], govt: true },
    careerBreak: { name: "Career break",            order: ["summary", "skills", "experience", "courses", "education"], govt: false },
  };
  const ALL_SECTIONS = ["summary", "education", "skills", "projects", "internships", "experience", "certifications", "achievements", "activities", "languages", "courses"];
  const SECTION_TITLES = {
    summary: "Summary", education: "Education", skills: "Skills", projects: "Projects",
    internships: "Internships", experience: "Experience", certifications: "Certifications",
    achievements: "Achievements", activities: "Activities", languages: "Languages", courses: "Courses",
  };

  // ---------- Data model ----------
  let idCounter = 0;
  function newId() { idCounter++; return "r" + Date.now().toString(36) + idCounter.toString(36) + Math.random().toString(36).slice(2, 6); }
  const clone = (o) => JSON.parse(JSON.stringify(o));

  function emptyData() {
    return {
      name: "", headline: "", phone: "", email: "", city: "", links: [],
      summary: "",
      education: [], skills: { technical: [], tools: [], soft: [] },
      projects: [], internships: [], experience: [],
      certifications: [], achievements: [], activities: [], languages: [], courses: [],
      dob: "", photo: null, declaration: false,
      show: { dob: false, photo: false, declaration: false },
    };
  }
  function newResume(layout, title) {
    const L = LAYOUTS[layout] || LAYOUTS.fresher;
    const d = emptyData();
    if (L.govt) d.show = { dob: true, photo: true, declaration: true };
    if (L.govt) d.declaration = true;
    return {
      id: newId(), title: title || L.name, layout: LAYOUTS[layout] ? layout : "fresher",
      baseOf: null, jobPost: null, data: d,
      sectionOrder: L.order.slice(), hidden: [], updatedAt: Date.now(),
    };
  }
  function newState() {
    return { version: 1, settings: { lang: "en", paper: "A4", currentId: null }, resumes: [], tailorLog: [], lastBackupAt: null };
  }

  function isResumeEmpty(r) {
    if (!r || !r.data) return true;
    const d = r.data;
    const any = (a) => Array.isArray(a) && a.some((x) => (typeof x === "string" ? x.trim() : x && Object.values(x).some((v) => (Array.isArray(v) ? v.some((s) => String(s).trim()) : String(v || "").trim()))));
    return !(String(d.name || "").trim() || String(d.summary || "").trim() || any(d.education) || any(d.projects) ||
      any(d.experience) || any(d.internships) || d.skills.technical.length || d.skills.tools.length || d.skills.soft.length);
  }

  // ---------- Text helpers ----------
  const clean = (s) => String(s == null ? "" : s).replace(/\s+/g, " ").trim();
  const nonEmpty = (a) => (a || []).map(clean).filter(Boolean);
  function range(start, end) { const s = clean(start), e = clean(end); return s && e ? s + " – " + e : s || e; }

  function contactParts(d) {
    return [clean(d.phone), clean(d.email), clean(d.city), ...nonEmpty(d.links)].filter(Boolean);
  }
  function eduLines(e) {
    const deg = [clean(e.degree), clean(e.field)].filter(Boolean).join(" in ");
    const where = [clean(e.school), clean(e.city)].filter(Boolean).join(", ");
    const head = [deg, where].filter(Boolean).join(", ");
    const when = range(e.start, e.end);
    const marks = [];
    if (clean(e.cgpa)) marks.push("CGPA: " + clean(e.cgpa) + (clean(e.scale) ? "/" + clean(e.scale) : ""));
    if (clean(e.twelfth)) marks.push("Class 12: " + clean(e.twelfth));
    if (clean(e.tenth)) marks.push("Class 10: " + clean(e.tenth));
    return { head, when, marks: marks.join(" · ") };
  }
  function roleLine(x) {
    const head = [clean(x.role), clean(x.org), clean(x.city)].filter(Boolean).join(", ");
    return { head, when: range(x.start, x.end) };
  }
  function visibleSections(r) {
    return r.sectionOrder.filter((s) => !r.hidden.includes(s));
  }
  function sectionHasContent(r, s) {
    const d = r.data;
    switch (s) {
      case "summary": return !!clean(d.summary);
      case "education": return d.education.some((e) => clean(e.degree) || clean(e.school));
      case "skills": return !!(nonEmpty(d.skills.technical).length || nonEmpty(d.skills.tools).length || nonEmpty(d.skills.soft).length);
      case "projects": return d.projects.some((p) => clean(p.title));
      case "internships": case "experience": return d[s].some((x) => clean(x.role) || clean(x.org));
      default: return nonEmpty(d[s]).length > 0;
    }
  }

  // ---------- Resume → plain text (exact reading order of the printed resume) ----------
  function resumeToPlainText(r) {
    const d = r.data, out = [];
    if (clean(d.name)) out.push(clean(d.name));
    const c = contactParts(d); if (c.length) out.push(c.join(" | "));
    if (d.show.dob && clean(d.dob)) out.push("Date of birth: " + clean(d.dob));
    if (clean(d.headline)) out.push(clean(d.headline));
    for (const s of visibleSections(r)) {
      if (!sectionHasContent(r, s)) continue;
      out.push("", SECTION_TITLES[s].toUpperCase());
      if (s === "summary") out.push(clean(d.summary));
      else if (s === "education") d.education.forEach((e) => {
        const l = eduLines(e); if (!l.head && !l.when) return;
        out.push([l.head, l.when].filter(Boolean).join(" | ")); if (l.marks) out.push(l.marks);
      });
      else if (s === "skills") {
        if (nonEmpty(d.skills.technical).length) out.push("Technical: " + nonEmpty(d.skills.technical).join(", "));
        if (nonEmpty(d.skills.tools).length) out.push("Tools: " + nonEmpty(d.skills.tools).join(", "));
        if (nonEmpty(d.skills.soft).length) out.push("Soft skills: " + nonEmpty(d.skills.soft).join(", "));
      } else if (s === "projects") d.projects.forEach((p) => {
        if (!clean(p.title)) return;
        out.push([clean(p.title), clean(p.tech)].filter(Boolean).join(" | "));
        nonEmpty(p.bullets).forEach((b) => out.push("• " + b));
      });
      else if (s === "internships" || s === "experience") d[s].forEach((x) => {
        const l = roleLine(x); if (!l.head) return;
        out.push([l.head, l.when].filter(Boolean).join(" | "));
        nonEmpty(x.bullets).forEach((b) => out.push("• " + b));
      });
      else if (s === "languages") out.push(nonEmpty(d.languages).join(", "));
      else nonEmpty(d[s]).forEach((b) => out.push("• " + b));
    }
    if (d.show.declaration && d.declaration) {
      out.push("", "DECLARATION", clean(DECLARATION_TEXT));
      out.push("Place: " + clean(d.city) + "    Date:    " + clean(d.name));
    }
    return out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
  }
  let DECLARATION_TEXT = "I hereby declare that the information given above is true to the best of my knowledge.";
  function setDeclarationText(t) { if (t) DECLARATION_TEXT = t; }

  // ---------- Resume → print HTML (same order as plain text) ----------
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
  function resumeToHTML(r) {
    const d = r.data, h = [];
    h.push('<header class="rv-head">');
    if (d.show.photo && d.photo) h.push('<img class="rv-photo" src="' + esc(d.photo) + '" alt="">');
    h.push('<h1 class="rv-name">' + esc(clean(d.name) || "Your Name") + "</h1>");
    const c = contactParts(d); if (c.length) h.push('<p class="rv-contact">' + c.map(esc).join(" | ") + "</p>");
    if (d.show.dob && clean(d.dob)) h.push('<p class="rv-contact">Date of birth: ' + esc(clean(d.dob)) + "</p>");
    if (clean(d.headline)) h.push('<p class="rv-headline">' + esc(clean(d.headline)) + "</p>");
    h.push("</header>");
    const row = (head, when) => '<p class="rv-row"><span class="rv-strong">' + esc(head) + "</span>" + (when ? ' | <span class="rv-when">' + esc(when) + "</span>" : "") + "</p>";
    const bullets = (list) => { const b = nonEmpty(list); return b.length ? '<ul class="rv-ul">' + b.map((x) => "<li>" + esc(x) + "</li>").join("") + "</ul>" : ""; };
    for (const s of visibleSections(r)) {
      if (!sectionHasContent(r, s)) continue;
      h.push('<section class="rv-sec"><h2 class="rv-h2">' + esc(SECTION_TITLES[s]) + "</h2>");
      if (s === "summary") h.push('<p class="rv-p">' + esc(clean(d.summary)) + "</p>");
      else if (s === "education") d.education.forEach((e) => {
        const l = eduLines(e); if (!l.head && !l.when) return;
        h.push(row(l.head, l.when)); if (l.marks) h.push('<p class="rv-p">' + esc(l.marks) + "</p>");
      });
      else if (s === "skills") {
        const line = (k, v) => (nonEmpty(v).length ? '<p class="rv-p"><span class="rv-strong">' + k + ":</span> " + esc(nonEmpty(v).join(", ")) + "</p>" : "");
        h.push(line("Technical", d.skills.technical) + line("Tools", d.skills.tools) + line("Soft skills", d.skills.soft));
      } else if (s === "projects") d.projects.forEach((p) => {
        if (!clean(p.title)) return;
        h.push(row(clean(p.title), clean(p.tech)) + bullets(p.bullets));
      });
      else if (s === "internships" || s === "experience") d[s].forEach((x) => {
        const l = roleLine(x); if (!l.head) return;
        h.push(row(l.head, l.when) + bullets(x.bullets));
      });
      else if (s === "languages") h.push('<p class="rv-p">' + esc(nonEmpty(d.languages).join(", ")) + "</p>");
      else h.push(bullets(d[s]));
      h.push("</section>");
    }
    if (d.show.declaration && d.declaration) {
      h.push('<section class="rv-sec"><h2 class="rv-h2">Declaration</h2><p class="rv-p">' + esc(clean(DECLARATION_TEXT)) + "</p>" +
        '<p class="rv-p">Place: ' + esc(clean(d.city)) + " &nbsp;&nbsp; Date: &nbsp;&nbsp; " + esc(clean(d.name)) + "</p></section>");
    }
    return h.join("");
  }

  // ---------- Keyword matching ----------
  const STOP = new Set(("a about above after again against all also am an and any are as at be because been before being below between both but by can could did do does doing down during each few for from further had has have having he her here hers herself him himself his how i if in into is it its itself just me more most my myself no nor not now of off on once only or other our ours ourselves out over own same she should so some such than that the their theirs them themselves then there these they this those through to too under until up very was we were what when where which while who whom why will with would you your yours yourself yourselves etc via per e.g i.e" +
    " candidate candidates role roles ability able years year experience experienced responsibilities responsibility job jobs work working team company looking seeking required requirement requirements preferred plus strong good excellent knowledge understanding skills skill must should may including include includes include like new opportunity apply position qualification qualifications degree minimum well using use based related relevant other various within across ensure join us we're you'll you're will help across day days time full part benefits salary location offer offers about us who what's what" +
    // common job-post verbs and filler, so "uses Kotlin" becomes "Kotlin"
    " use uses used build builds built develop develops developing create creates creating manage manages handle handles love loves enjoy want need needs needed get make makes provide provides support supports deliver delivers maintain maintains drive drives assist assists perform performs" +
    " proficient proficiency familiar familiarity exposure hands-on hands solid basic sound proven demonstrated ideal ideally great passion passionate eager motivated self-motivated fast-paced dynamic" +
    " startup startups company's apps app product products clients client customers customer's environment environments opportunities growth career" +
    " hiring hire understand prepare prepares office offices discipline disciplines stream streams bachelor bachelor's bachelors graduate graduates graduation any weekly monthly daily needs junior senior fresher freshers trainee").split(/\s+/));
  const REQ_HEAD = /^\s*(requirements?|skills?( required)?|qualifications?|must[- ]haves?|must have|you have|what you('ll| will) need|what we('re| are) looking for|eligibility|desired skills|key skills|technical skills|preferred skills)\b/i;
  const OTHER_HEAD = /^\s*(about( us| the (company|role))?|responsibilities|what you('ll| will) do|benefits|perks|why join|our (company|team)|job description|role overview|location|salary|how to apply)\b/i;

  function normalize(text) {
    return String(text || "").toLowerCase()
      .replace(/[^a-z0-9+#./\-\s]/g, " ")
      .split(/\s+/).map((t) => t.replace(/^[./\-]+|[./\-]+$/g, "")).filter(Boolean).join(" ");
  }
  function stem(t) {
    if (/[+#./]/.test(t) || t.length <= 3) return t;
    if (t.endsWith("ies") && t.length > 4) return t.slice(0, -3) + "y";
    if (t.endsWith("ing") && t.length > 5) return t.slice(0, -3);
    if (t.endsWith("es") && /(ches|shes|xes|sses)$/.test(t)) return t.slice(0, -2);
    if (t.endsWith("s") && !t.endsWith("ss")) return t.slice(0, -1);
    return t;
  }
  const stemSeq = (s) => normalize(s).split(" ").filter(Boolean).map(stem);

  function extractTerms(jobPost, limit = 25) {
    const lines = String(jobPost || "").split(/\r?\n/);
    const counts = new Map();   // key -> { w, display, n }
    let reqMode = false;
    for (const raw of lines) {
      const line = raw.trim(); if (!line) continue;
      if (REQ_HEAD.test(line)) reqMode = true;
      else if (OTHER_HEAD.test(line)) reqMode = false;
      const bonus = reqMode ? 2 : 0;
      // split into phrases at punctuation and the words "and"/"or"
      const phrases = line.replace(/^[\-*•·▪●\d.)\s]+/, "").split(/[,;:|•·()\[\]{}!?]|\s(?:and|or|&|\/\/)\s|\.\s|\.$/i);
      for (const ph of phrases) {
        const origWords = ph.trim().split(/\s+/).filter(Boolean);
        const norm = origWords.map((w) => normalize(w));
        // runs of non-stop words
        let run = [];
        const flush = () => {
          for (let n = 1; n <= 3; n++) {
            for (let i = 0; i + n <= run.length; i++) {
              const seg = run.slice(i, i + n);
              const key = seg.map((x) => stem(x.n)).join(" ");
              if (!key || /^\d+$/.test(key.replace(/\s/g, ""))) continue;
              const e = counts.get(key) || { w: 0, n, display: seg.map((x) => x.o).join(" "), c: 0 };
              e.w += 1 + bonus; e.c += 1; counts.set(key, e);
            }
          }
          run = [];
        };
        norm.forEach((n, i) => {
          if (!n || STOP.has(n) || n.length < 2 && !/[+#]/.test(n)) { flush(); return; }
          run.push({ n, o: origWords[i].replace(/^[^\w+#.]+|[^\w+#]+$/g, "") });
        });
        flush();
      }
    }
    // drop a shorter phrase when a longer phrase containing it has the same count
    const keys = [...counts.keys()];
    const out = [];
    for (const k of keys) {
      const e = counts.get(k);
      const covered = keys.some((k2) => k2 !== k && counts.get(k2).n > e.n && counts.get(k2).c >= e.c && (" " + k2 + " ").includes(" " + k + " "));
      if (!covered) out.push({ key: k, term: e.display, weight: e.w, n: e.n });
    }
    out.sort((a, b) => b.weight - a.weight || b.n - a.n || a.term.localeCompare(b.term));
    return out.slice(0, limit);
  }

  let SYNONYMS = [];
  function setSynonyms(groups) { SYNONYMS = (groups || []).map((g) => g.map((x) => stemSeq(x).join(" "))); }
  function variantsOf(key) {
    const v = new Set([key]);
    for (const g of SYNONYMS) if (g.includes(key)) g.forEach((x) => v.add(x));
    return [...v];
  }
  function matchTerms(terms, resumeText) {
    const hay = " " + stemSeq(resumeText).join(" ") + " ";
    const found = [], missing = [];
    for (const t of terms) {
      const key = t.key || stemSeq(t.term || t).join(" ");
      const label = t.term || t;
      const hit = variantsOf(key).some((v) => v && hay.includes(" " + v + " "));
      (hit ? found : missing).push(label);
    }
    return { found, missing };
  }

  // ---------- CRC-32 + store-only ZIP ----------
  const CRC_TABLE = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  function crc32(bytes) { let c = 0xffffffff; for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
  const utf8 = (s) => new TextEncoder().encode(s);
  function zipStore(files) {
    const parts = [], central = []; let offset = 0;
    const u16 = (v) => [v & 0xff, (v >>> 8) & 0xff];
    const u32 = (v) => [v & 0xff, (v >>> 8) & 0xff, (v >>> 16) & 0xff, (v >>> 24) & 0xff];
    const DOS_TIME = 0, DOS_DATE = ((2026 - 1980) << 9) | (1 << 5) | 1;
    for (const f of files) {
      const name = utf8(f.name), data = typeof f.data === "string" ? utf8(f.data) : f.data, crc = crc32(data);
      const local = [...u32(0x04034b50), ...u16(20), ...u16(0x0800), ...u16(0), ...u16(DOS_TIME), ...u16(DOS_DATE), ...u32(crc), ...u32(data.length), ...u32(data.length), ...u16(name.length), ...u16(0)];
      parts.push(Uint8Array.from(local), name, data);
      central.push(Uint8Array.from([...u32(0x02014b50), ...u16(20), ...u16(20), ...u16(0x0800), ...u16(0), ...u16(DOS_TIME), ...u16(DOS_DATE), ...u32(crc), ...u32(data.length), ...u32(data.length), ...u16(name.length), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(0), ...u32(offset)]), name);
      offset += local.length + name.length + data.length;
    }
    const cdSize = central.reduce((s, p) => s + p.length, 0);
    const end = Uint8Array.from([...u32(0x06054b50), ...u16(0), ...u16(0), ...u16(files.length), ...u16(files.length), ...u32(cdSize), ...u32(offset), ...u16(0)]);
    const all = [...parts, ...central, end], total = all.reduce((s, p) => s + p.length, 0);
    const out = new Uint8Array(total); let p = 0; for (const a of all) { out.set(a, p); p += a.length; }
    return out;
  }

  // ---------- Word (.docx) ----------
  const xesc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch])).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");
  function buildDocx(r, paper) {
    const d = r.data, P = [];
    const run = (t, o = {}) => "<w:r>" + (o.b || o.i ? "<w:rPr>" + (o.b ? "<w:b/>" : "") + (o.i ? "<w:i/>" : "") + "</w:rPr>" : "") + '<w:t xml:space="preserve">' + xesc(t) + "</w:t></w:r>";
    const para = (runs, style, o = {}) => "<w:p>" + (style || o.center ? "<w:pPr>" + (style ? '<w:pStyle w:val="' + style + '"/>' : "") + (o.center ? '<w:jc w:val="center"/>' : "") + "</w:pPr>" : "") + runs + "</w:p>";
    const bullet = (t) => '<w:p><w:pPr><w:pStyle w:val="ListBullet"/><w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr></w:pPr>' + run(t) + "</w:p>";
    const row = (head, when) => para(run(head, { b: true }) + (when ? run(" | " + when) : ""));
    P.push(para(run(clean(d.name) || "Your Name"), "Heading1", { center: true }));
    const c = contactParts(d); if (c.length) P.push(para(run(c.join(" | ")), null, { center: true }));
    if (d.show.dob && clean(d.dob)) P.push(para(run("Date of birth: " + clean(d.dob)), null, { center: true }));
    if (clean(d.headline)) P.push(para(run(clean(d.headline), { i: true }), null, { center: true }));
    for (const s of visibleSections(r)) {
      if (!sectionHasContent(r, s)) continue;
      P.push(para(run(SECTION_TITLES[s]), "Heading2"));
      if (s === "summary") P.push(para(run(clean(d.summary))));
      else if (s === "education") d.education.forEach((e) => { const l = eduLines(e); if (!l.head && !l.when) return; P.push(row(l.head, l.when)); if (l.marks) P.push(para(run(l.marks))); });
      else if (s === "skills") [["Technical", d.skills.technical], ["Tools", d.skills.tools], ["Soft skills", d.skills.soft]].forEach(([k, v]) => { if (nonEmpty(v).length) P.push(para(run(k + ": ", { b: true }) + run(nonEmpty(v).join(", ")))); });
      else if (s === "projects") d.projects.forEach((p) => { if (!clean(p.title)) return; P.push(row(clean(p.title), clean(p.tech))); nonEmpty(p.bullets).forEach((b) => P.push(bullet(b))); });
      else if (s === "internships" || s === "experience") d[s].forEach((x) => { const l = roleLine(x); if (!l.head) return; P.push(row(l.head, l.when)); nonEmpty(x.bullets).forEach((b) => P.push(bullet(b))); });
      else if (s === "languages") P.push(para(run(nonEmpty(d.languages).join(", "))));
      else nonEmpty(d[s]).forEach((b) => P.push(bullet(b)));
    }
    if (d.show.declaration && d.declaration) {
      P.push(para(run("Declaration"), "Heading2"), para(run(clean(DECLARATION_TEXT))), para(run("Place: " + clean(d.city) + "\t\tDate:\t\t" + clean(d.name))));
    }
    const letter = paper === "LETTER";
    const sect = '<w:sectPr><w:pgSz w:w="' + (letter ? 12240 : 11906) + '" w:h="' + (letter ? 15840 : 16838) + '"/><w:pgMar w:top="794" w:right="850" w:bottom="794" w:left="850" w:header="0" w:footer="0" w:gutter="0"/></w:sectPr>';
    const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
    const files = [
      { name: "[Content_Types].xml", data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/></Types>' },
      { name: "_rels/.rels", data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>' },
      { name: "word/_rels/document.xml.rels", data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/></Relationships>' },
      { name: "word/document.xml", data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document ' + W + "><w:body>" + P.join("") + sect + "</w:body></w:document>" },
      { name: "word/styles.xml", data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles ' + W + '><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri" w:eastAsia="Calibri"/><w:sz w:val="21"/><w:szCs w:val="21"/><w:lang w:val="en-IN"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="40" w:line="252" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>' +
        '<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>' +
        '<w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:after="40"/><w:outlineLvl w:val="0"/></w:pPr><w:rPr><w:b/><w:sz w:val="34"/><w:szCs w:val="34"/></w:rPr></w:style>' +
        '<w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:pBdr><w:bottom w:val="single" w:sz="6" w:space="1" w:color="000000"/></w:pBdr><w:spacing w:before="180" w:after="60"/><w:outlineLvl w:val="1"/></w:pPr><w:rPr><w:b/><w:caps/><w:sz w:val="23"/><w:szCs w:val="23"/></w:rPr></w:style>' +
        '<w:style w:type="paragraph" w:styleId="ListBullet"><w:name w:val="List Bullet"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:after="20"/><w:ind w:left="360" w:hanging="240"/></w:pPr></w:style></w:styles>' },
      { name: "word/numbering.xml", data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:numbering ' + W + '><w:abstractNum w:abstractNumId="0"><w:multiLevelType w:val="singleLevel"/><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="bullet"/><w:lvlText w:val="•"/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="360" w:hanging="240"/></w:pPr></w:lvl></w:abstractNum><w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num></w:numbering>' },
    ];
    return zipStore(files);
  }

  // ---------- CSV, backup, tailoring ----------
  function toCSV(log) {
    const q = (v) => { const s = String(v == null ? "" : v); return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
    const rows = [["Date", "Company", "Role", "Resume", "Missing words"]].concat((log || []).map((x) => [x.date, x.company, x.role, x.resumeTitle || "", x.missingCount]));
    return "﻿" + rows.map((r) => r.map(q).join(",")).join("\r\n") + "\r\n";
  }
  function validateImport(text) {
    let obj;
    try { obj = typeof text === "string" ? JSON.parse(text) : text; } catch (e) { return { ok: false, error: "This file isn't a Resume Kit backup, or it is damaged. Nothing was changed." }; }
    const bad = { ok: false, error: "This file isn't a Resume Kit backup, or it is damaged. Nothing was changed." };
    if (!obj || typeof obj !== "object" || obj.app !== "wiz-resume-kit" || !Array.isArray(obj.resumes)) return bad;
    for (const r of obj.resumes) {
      if (!r || typeof r.id !== "string" || !r.data || typeof r.data !== "object" || !Array.isArray(r.sectionOrder)) return bad;
    }
    const state = newState();
    state.settings = Object.assign(state.settings, obj.settings || {});
    state.resumes = obj.resumes.map((r) => upgradeResume(r));
    state.tailorLog = Array.isArray(obj.tailorLog) ? obj.tailorLog : [];
    state.lastBackupAt = obj.lastBackupAt || null;
    return { ok: true, state };
  }
  function exportBackup(state) { return JSON.stringify(Object.assign({ app: "wiz-resume-kit", exportedAt: new Date().toISOString() }, state), null, 1); }
  // fill any fields missing in older saves
  function upgradeResume(r) {
    const d = Object.assign(emptyData(), r.data || {});
    d.skills = Object.assign({ technical: [], tools: [], soft: [] }, d.skills || {});
    d.show = Object.assign({ dob: false, photo: false, declaration: false }, d.show || {});
    return Object.assign({ baseOf: null, jobPost: null, hidden: [], layout: "fresher", title: "Resume" }, r, { data: d, sectionOrder: r.sectionOrder || LAYOUTS.fresher.order.slice() });
  }
  function duplicateForJob(r, jobPost) {
    const c = clone(r);
    c.id = newId(); c.baseOf = r.id; c.updatedAt = Date.now();
    const role = clean(jobPost && jobPost.role), company = clean(jobPost && jobPost.company);
    c.title = role || company ? [role || "Job", company].filter(Boolean).join(" – ") : r.title + " (tailored)";
    c.jobPost = { text: String((jobPost && jobPost.text) || ""), company, role, savedAt: Date.now() };
    return c;
  }
  function suggestedFileName(r) {
    const parts = clean(r.data.name).split(" ").filter(Boolean);
    const first = parts[0] || "My", last = parts.length > 1 ? parts[parts.length - 1] : "";
    return [first, last, "Resume"].filter(Boolean).join("_").replace(/[^\w\-]/g, "") + ".pdf";
  }

  // ---------- Check screen helpers ----------
  function bulletCounts(r) {
    const d = r.data, out = [];
    const vis = visibleSections(r);
    if (vis.includes("projects")) d.projects.forEach((p) => clean(p.title) && out.push({ what: clean(p.title), n: nonEmpty(p.bullets).length }));
    ["internships", "experience"].forEach((s) => vis.includes(s) && d[s].forEach((x) => clean(x.role || x.org) && out.push({ what: clean(x.role || x.org), n: nonEmpty(x.bullets).length })));
    return out;
  }
  function dateStyles(r) {
    const d = r.data, dates = [];
    const vis = visibleSections(r);
    if (vis.includes("education")) d.education.forEach((e) => dates.push(e.start, e.end));
    ["internships", "experience"].forEach((s) => vis.includes(s) && d[s].forEach((x) => dates.push(x.start, x.end)));
    const style = (t) => { t = clean(t); if (!t || /^present$/i.test(t)) return null;
      if (/^\d{4}$/.test(t)) return "YYYY"; if (/^[A-Za-z]{3}\.? \d{4}$/.test(t)) return "Mon YYYY"; if (/^[A-Za-z]{4,} \d{4}$/.test(t)) return "Month YYYY";
      if (/^\d{1,2}[\/\-]\d{4}$/.test(t)) return "MM/YYYY"; return "other"; };
    return [...new Set(dates.map(style).filter(Boolean))];
  }

  // ---------- Sample data (Kerala fresher, fictional) ----------
  function sampleResume() {
    const r = newResume("fresher", "Sample – Anjali (fresher)");
    Object.assign(r.data, {
      name: "Anjali Menon", headline: "B.Tech Computer Science (2025) | Python, SQL, Power BI | Looking for data analyst roles",
      phone: "+91 90000 12345", email: "anjali.menon@example.com", city: "Kochi, Kerala", links: ["linkedin.com/in/anjali-menon-example"],
      summary: "B.Tech Computer Science graduate (2025) with hands-on projects in Python, SQL and Power BI. Built a student attendance dashboard used by my department. Looking for an entry-level data analyst role in Kochi or Bengaluru.",
      education: [
        { degree: "B.Tech", field: "Computer Science and Engineering", school: "Govt. Engineering College", city: "Thrissur", start: "Aug 2021", end: "May 2025", cgpa: "8.4", scale: "10", twelfth: "92%", tenth: "95%" },
      ],
      skills: { technical: ["Python", "SQL", "Power BI", "Pandas"], tools: ["MS Excel", "Git", "Jupyter"], soft: ["Teamwork", "Presentation"] },
      projects: [
        { title: "Student attendance dashboard", tech: "Python, Flask, SQLite", bullets: ["Built a web app that tracks attendance for 3 classes in my department.", "Added a weekly report that flags students below 75% attendance.", "Cut the time teachers spent on attendance registers by about an hour a week."] },
        { title: "Sales dashboard for a local store", tech: "Power BI, MS Excel", bullets: ["Cleaned 12 months of billing data in Excel.", "Built a Power BI dashboard showing monthly sales and top products.", "Presented the findings to the store owner."] },
      ],
      internships: [
        { role: "Data Analyst Intern", org: "Bluepeak Technologies", city: "Kochi", start: "Jun 2024", end: "Jul 2024", bullets: ["Wrote SQL queries to prepare weekly sales reports.", "Checked and fixed errors in 5,000+ customer records.", "Shared a short report on returning customers with the team."] },
      ],
      certifications: ["Google Data Analytics Certificate, Coursera (2024)", "Python for Everybody, Coursera (2023)"],
      achievements: ["Winner, college hackathon (2024), team of 3", "NSS volunteer: helped organise a blood donation camp (2023)"],
      languages: ["English", "Malayalam", "Hindi"],
    });
    return r;
  }

  return {
    LAYOUTS, ALL_SECTIONS, SECTION_TITLES, newId, clone, emptyData, newResume, newState, isResumeEmpty,
    resumeToPlainText, resumeToHTML, setDeclarationText, visibleSections, sectionHasContent,
    normalize, stem, extractTerms, matchTerms, setSynonyms,
    crc32, zipStore, buildDocx, toCSV, validateImport, exportBackup, upgradeResume, duplicateForJob, suggestedFileName,
    bulletCounts, dateStyles, sampleResume,
  };
})();
if (typeof module !== "undefined") module.exports = LOGIC;
