/* ============================================================
   APP — screens, saving, dialogs, export. Uses LOGIC, CONFIG, CONTENT.
   ============================================================ */
(function () {
  "use strict";
  const L = LOGIC;
  L.setSynonyms(CONTENT.synonyms);
  L.setDeclarationText(CONTENT.declarationText);

  const $ = (sel, root) => (root || document).querySelector(sel);
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const DAY = 86400000;

  // ---------- storage ----------
  let storageOK = true;
  let state = load();
  function load() {
    try {
      const raw = localStorage.getItem(CONFIG.storageKey);
      if (!raw) return L.newState();
      const res = L.validateImport(Object.assign(JSON.parse(raw), { app: "wiz-resume-kit" }));
      return res.ok ? res.state : L.newState();
    } catch (e) { storageOK = false; return L.newState(); }
  }
  let saveTimer = null;
  function save(now) {
    clearTimeout(saveTimer);
    const run = () => { try { localStorage.setItem(CONFIG.storageKey, JSON.stringify(state)); storageOK = true; } catch (e) { storageOK = false; renderBanner(); } };
    if (now) run(); else saveTimer = setTimeout(run, 250);
  }
  try { localStorage.setItem("__rk_test", "1"); localStorage.removeItem("__rk_test"); } catch (e) { storageOK = false; }

  // ---------- ui state (not saved) ----------
  const ui = { tab: "resumes", open: {}, examples: {}, tailor: { text: "", company: "", role: "", result: null }, guide: "android", menu: null };

  const cur = () => state.resumes.find((r) => r.id === state.settings.currentId) || null;
  function touch(r) { r.updatedAt = Date.now(); save(); }
  function setCurrent(id) { state.settings.currentId = id; save(); }

  // ---------- small UI helpers ----------
  function toast(msg) {
    const t = $("#toast"); t.textContent = msg; t.classList.add("on");
    clearTimeout(toast.tm); toast.tm = setTimeout(() => t.classList.remove("on"), 2400);
  }
  function sheet(title, html, onMount) {
    closeSheet();
    const o = document.createElement("div");
    o.className = "overlay"; o.id = "overlay";
    o.innerHTML = '<div class="sheet" role="dialog" aria-modal="true" aria-labelledby="sheetTitle"><div class="sheet-head"><h3 id="sheetTitle">' + esc(title) +
      '</h3><button class="icon-btn" data-act="close-sheet" aria-label="Close">' + ICON.x + "</button></div>" + html + "</div>";
    o.addEventListener("click", (e) => { if (e.target === o) closeSheet(); });
    document.body.appendChild(o);
    const first = o.querySelector("input, textarea, select, button:not([data-act=close-sheet])");
    if (first) first.focus();
    if (onMount) onMount(o);
    return o;
  }
  function closeSheet() { const o = $("#overlay"); if (o) o.remove(); }
  function confirmDialog(title, text, okLabel, onOk, danger) {
    const o = sheet(title, '<p>' + esc(text) + '</p><div class="row"><button class="btn ghost grow" data-act="close-sheet">Cancel</button><button class="btn grow ' + (danger ? "danger" : "primary") + '" id="dlgOk">' + esc(okLabel) + "</button></div>");
    $("#dlgOk", o).onclick = () => { closeSheet(); onOk(); };
  }
  function promptDialog(title, label, value, onOk) {
    const o = sheet(title, '<label class="f" for="dlgIn">' + esc(label) + '</label><input class="i" id="dlgIn" value="' + esc(value) + '"><div class="row" style="margin-top:12px"><button class="btn ghost grow" data-act="close-sheet">Cancel</button><button class="btn primary grow" id="dlgOk">Save</button></div>');
    const go = () => { const v = $("#dlgIn", o).value.trim(); if (!v) return; closeSheet(); onOk(v); };
    $("#dlgOk", o).onclick = go; $("#dlgIn", o).onkeydown = (e) => { if (e.key === "Enter") go(); };
  }
  function download(name, data, type) {
    const blob = data instanceof Blob ? data : new Blob([data], { type });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }
  async function copyText(text, msg) {
    try { await navigator.clipboard.writeText(text); toast(msg || "Copied"); }
    catch (e) {
      const ta = document.createElement("textarea"); ta.value = text; document.body.appendChild(ta); ta.select();
      try { document.execCommand("copy"); toast(msg || "Copied"); } catch (e2) { toast("Couldn't copy. Select the text and copy it."); }
      ta.remove();
    }
  }
  const fmtDate = (ts) => new Date(ts).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  const ago = (ts) => { const d = Math.floor((Date.now() - ts) / DAY); return d <= 0 ? "today" : d === 1 ? "yesterday" : d + " days ago"; };

  // ---------- icons ----------
  const svg = (p) => '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + p + "</svg>";
  const ICON = {
    resumes: svg('<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h4"/>'),
    build: svg('<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>'),
    tailor: svg('<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3M8 11h6M11 8v6"/>'),
    check: svg('<path d="M9 11l3 3 8-8"/><path d="M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9"/>'),
    export: svg('<path d="M12 3v12M7 10l5 5 5-5"/><path d="M5 21h14"/>'),
    more: svg('<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>'),
    x: svg('<path d="M18 6 6 18M6 6l12 12"/>'),
    up: svg('<path d="m18 15-6-6-6 6"/>'),
    down: svg('<path d="m6 9 6 6 6-6"/>'),
    trash: svg('<path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/>'),
    plus: svg('<path d="M12 5v14M5 12h14"/>'),
    eye: svg('<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>'),
    copy: svg('<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/>'),
  };
  const LOGO = '<svg viewBox="0 0 32 32" width="24" height="24" aria-hidden="true"><path d="M9 4h10l6 6v16a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" fill="#1F4D3A"/><path d="M11 14h10M11 18h10M11 22h6" stroke="#fff" stroke-width="2" stroke-linecap="round"/><circle cx="24" cy="24" r="6" fill="#D98E04"/><path d="m21.5 24 1.8 1.8 3.2-3.4" stroke="#fff" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  // ---------- shell ----------
  const TABS = [["resumes", "Resumes"], ["build", "Build"], ["tailor", "Tailor"], ["check", "Check"], ["export", "Export"]];
  function shell() {
    document.body.insertAdjacentHTML("afterbegin",
      '<header class="top"><div class="logo">' + LOGO + '</div><div class="t"><b>' + esc(CONFIG.productName) + '</b><span id="curName"></span></div>' +
      '<button class="icon-btn" data-act="menu" aria-label="More: settings, backup and help">' + ICON.more + "</button></header>" +
      '<div id="banner"></div><main id="view" tabindex="-1"></main>' +
      '<nav class="tabs" aria-label="Main">' + TABS.map(([id, label]) => '<button data-tab="' + id + '">' + ICON[id] + "<span>" + label + "</span></button>").join("") + "</nav>" +
      '<div id="printArea" class="rv"></div><div id="measure" class="rv rv-measure" aria-hidden="true"></div><div class="toast" id="toast" role="status" aria-live="polite"></div>');
  }
  function renderBanner() {
    const b = $("#banner"); let h = "";
    if (!storageOK) h += '<div class="banner warn" role="alert">Your resume can\'t be saved here. Open this in Chrome or Safari so your resume is saved.</div>';
    else if (state.resumes.some((r) => !r.title.startsWith("Sample")) && ui.tab === "resumes") {
      const last = state.lastBackupAt;
      const oldest = Math.min(...state.resumes.map((r) => r.updatedAt || Date.now()));
      if ((last && Date.now() - last > CONFIG.backupReminderDays * DAY) || (!last && Date.now() - oldest > CONFIG.backupReminderDays * DAY))
        h += '<div class="banner info">' + (last ? "Last backup " + ago(last) + "." : "You haven't saved a backup yet.") + ' <button class="linkish" data-act="backup">Back up now</button></div>';
    }
    b.innerHTML = h;
  }
  function render() {
    document.querySelectorAll("nav.tabs button").forEach((b) => { b.classList.toggle("on", b.dataset.tab === ui.tab); b.setAttribute("aria-current", b.dataset.tab === ui.tab ? "page" : "false"); });
    const r = cur();
    $("#curName").textContent = r ? r.title : "Clean, readable resumes";
    renderBanner();
    const v = $("#view");
    v.innerHTML = ({ resumes: viewResumes, build: viewBuild, tailor: viewTailor, check: viewCheck, export: viewExport })[ui.tab]();
    if (ui.tab === "check") fillCheck();
  }
  function go(tab) { ui.tab = tab; render(); window.scrollTo(0, 0); }

  // ---------- Resumes ----------
  function viewResumes() {
    if (!state.resumes.length) {
      return '<h2 class="view-title">Welcome</h2><div class="card stack">' +
        "<h3>A clean, one-column resume in three steps</h3>" +
        '<div class="steps3"><div><span>1</span>Pick a layout</div><div><span>2</span>Fill in</div><div><span>3</span>Export</div></div>' +
        '<p class="promise">No account. No subscription. Nothing uploaded.</p>' +
        '<button class="btn primary block" data-act="new">' + ICON.plus + "New resume</button>" +
        '<button class="btn block" data-act="sample">Try with sample data</button></div>';
    }
    const items = state.resumes.slice().sort((a, b) => b.updatedAt - a.updatedAt).map((r) => {
      const tailored = !!r.baseOf;
      return '<div class="card"><div class="rlist"><div class="item"><div class="meta"><b>' + esc(r.title) + '</b><span class="small muted">' +
        esc(L.LAYOUTS[r.layout] ? L.LAYOUTS[r.layout].name : "") + " · edited " + ago(r.updatedAt) + "</span> " +
        (tailored ? '<span class="badge amber">Tailored</span>' : "") + (r.id === state.settings.currentId ? ' <span class="badge">Open</span>' : "") +
        '</div></div><div class="row" style="margin-top:10px"><button class="btn sm primary" data-act="open" data-id="' + r.id + '">Open</button>' +
        '<button class="btn sm ghost" data-act="dup" data-id="' + r.id + '">Duplicate</button><button class="btn sm ghost" data-act="rename" data-id="' + r.id + '">Rename</button>' +
        '<button class="btn sm danger" data-act="del" data-id="' + r.id + '">Delete</button></div></div></div>';
    }).join("");
    return '<h2 class="view-title">Your resumes</h2><p class="view-sub">Keep one base resume, and save a tailored copy for each job.</p>' +
      '<button class="btn primary block" data-act="new" style="margin-bottom:12px">' + ICON.plus + "New resume</button>" + items;
  }
  function layoutPicker() {
    const cards = Object.keys(L.LAYOUTS).map((k) => '<button class="layout-card" data-act="pick-layout" data-layout="' + k + '"><b>' + esc(L.LAYOUTS[k].name) + '</b><span class="small muted">' + esc(CONTENT.layoutBlurbs[k] || "") + "</span></button>").join("");
    sheet("Pick a layout", '<p class="small muted">You can reorder or hide sections later.</p>' + cards);
  }
  function addResume(r) {
    if (state.resumes.length >= CONFIG.maxResumes) { toast("You can keep up to " + CONFIG.maxResumes + " resumes. Delete one first."); return false; }
    state.resumes.push(r); setCurrent(r.id); save(true); return true;
  }

  // ---------- Build ----------
  function viewBuild() {
    const r = cur();
    if (!r) return emptyPick("Build");
    const d = r.data;
    const gov = d.show.dob || d.show.photo || d.show.declaration || L.LAYOUTS[r.layout].govt;
    let h = '<h2 class="view-title">Build</h2><p class="view-sub">' + esc(r.title) + ' · changes save automatically.</p>' +
      '<div class="row" style="margin-bottom:12px"><button class="btn sm" data-act="preview">' + ICON.eye + "Preview</button></div>";
    // personal
    h += card("personal", "Your details", "Name, contact and headline", false, null,
      tip("personal") +
      '<label class="f" for="f_name">Full name</label><input class="i" id="f_name" data-path="data.name" value="' + esc(d.name) + '" autocomplete="name">' +
      '<div class="grid2"><div><label class="f" for="f_phone">Phone</label><input class="i" id="f_phone" data-path="data.phone" value="' + esc(d.phone) + '" inputmode="tel" autocomplete="tel"></div>' +
      '<div><label class="f" for="f_city">City</label><input class="i" id="f_city" data-path="data.city" value="' + esc(d.city) + '"></div></div>' +
      '<label class="f" for="f_email">Email</label><input class="i" id="f_email" data-path="data.email" value="' + esc(d.email) + '" inputmode="email" autocomplete="email">' +
      '<label class="f" for="f_links">Links (LinkedIn, GitHub, portfolio), one per line</label><textarea class="i" id="f_links" data-lines="data.links" rows="2">' + esc(d.links.join("\n")) + "</textarea>" +
      '<label class="f" for="f_headline">Headline</label>' + tip("headline") + '<input class="i" id="f_headline" data-path="data.headline" value="' + esc(d.headline) + '">' + exampleBtn("headline", "data.headline"));
    // government-form extras
    h += card("extras", "Government-form extras", gov ? "Some are switched on" : "Off: not needed for private jobs", false, null,
      '<p class="tip">' + esc(CONTENT.govtNote) + "</p>" +
      sw("show.dob", "Date of birth", d.show.dob) + (d.show.dob ? '<input class="i" data-path="data.dob" value="' + esc(d.dob) + '" placeholder="e.g. 12 Mar 2003" aria-label="Date of birth">' : "") +
      sw("show.photo", "Photo", d.show.photo) + (d.show.photo ? '<div class="row" style="margin:6px 0">' + (d.photo ? '<img src="' + esc(d.photo) + '" alt="Your photo" style="width:64px;border-radius:8px">' : "") +
        '<label class="btn sm ghost">Choose photo<input type="file" accept="image/*" data-act="photo" class="sr"></label>' + (d.photo ? '<button class="btn sm danger" data-act="photo-del">Remove</button>' : "") + "</div>" : "") +
      sw("show.declaration", "Declaration at the end", d.show.declaration) + (d.show.declaration ? '<p class="tip">"' + esc(CONTENT.declarationText) + '"</p>' : ""));
    // sections in order
    r.sectionOrder.forEach((s, i) => { h += sectionCard(r, s, i); });
    const missing = L.ALL_SECTIONS.filter((s) => !r.sectionOrder.includes(s));
    if (missing.length) h += '<div class="card"><label class="f" for="addSec">Add a section</label><div class="row"><select class="i grow" id="addSec">' + missing.map((s) => '<option value="' + s + '">' + L.SECTION_TITLES[s] + "</option>").join("") + '</select><button class="btn" data-act="add-section">Add</button></div></div>';
    return h;
  }
  function sw(key, label, on) { return '<label class="switch"><span>' + esc(label) + '</span><input type="checkbox" data-switch="' + key + '"' + (on ? " checked" : "") + "></label>"; }
  function tip(k) { return CONTENT.tips[k] ? '<p class="tip">' + esc(CONTENT.tips[k]) + "</p>" : ""; }
  function exampleBtn(key, target) {
    if (!CONTENT.examples[key]) return "";
    const open = ui.examples[key + "|" + target];
    return '<button class="linkish" data-act="examples" data-key="' + key + '" data-target="' + target + '" aria-expanded="' + !!open + '">' + (open ? "Hide examples" : "See an example") + "</button>" +
      (open ? '<div class="ex-box">' + CONTENT.examples[key].map((x) => '<div class="ex"><span class="grow">' + esc(x) + '</span><button class="btn sm ghost" data-act="use-example" data-target="' + target + '" data-text="' + esc(x) + '">Use</button></div>').join("") + '<p class="small muted" style="margin:6px 0 0">Change it to your own words and numbers.</p></div>' : "");
  }
  function card(id, title, sub, reorder, idx, body, hidden) {
    const open = ui.open[id] !== undefined ? ui.open[id] : id === "personal";
    return '<div class="card sec' + (hidden ? " hiddensec" : "") + '"><div class="sec-head"><button class="name" data-act="toggle-card" data-id="' + id + '" aria-expanded="' + open + '">' + esc(title) + "<small>" + esc(sub) + "</small></button>" +
      (reorder ? '<label class="showbox"><input type="checkbox" aria-label="Show ' + esc(title) + ' on the resume" data-act="sec-show" data-sec="' + id + '"' + (hidden ? "" : " checked") + '><span aria-hidden="true">' + (hidden ? "Hidden" : "Shown") + "</span></label>" +
        '<button class="icon-btn" data-act="sec-up" data-sec="' + id + '" aria-label="Move ' + esc(title) + ' up"' + (idx === 0 ? " disabled" : "") + ">" + ICON.up + "</button>" +
        '<button class="icon-btn" data-act="sec-down" data-sec="' + id + '" aria-label="Move ' + esc(title) + ' down">' + ICON.down + "</button>" : "") +
      "</div>" + (open ? '<div class="sec-body">' + body + "</div>" : "") + "</div>";
  }
  function sectionCard(r, s, i) {
    const d = r.data, hidden = r.hidden.includes(s);
    const count = (a) => (a.length ? a.length + (a.length === 1 ? " entry" : " entries") : "Empty");
    let body = tip(s), sub = hidden ? "Hidden from the resume" : "";
    if (s === "summary") {
      if (r.layout === "careerBreak") body += tip("breakNote");
      body += '<label class="f sr" for="f_summary">Summary</label><textarea class="i" id="f_summary" data-path="data.summary" rows="4">' + esc(d.summary) + "</textarea>" + exampleBtn("summary", "data.summary");
      sub = sub || (d.summary.trim() ? d.summary.trim().split(/\s+/).length + " words" : "Empty");
    } else if (s === "education") {
      body += d.education.map((e, k) => entry("Education " + (k + 1), "education", k,
        field("Degree", "education." + k + ".degree", e.degree, "B.Tech, B.Com, BSc…") + field("Field / branch", "education." + k + ".field", e.field, "Computer Science") +
        field("College / school", "education." + k + ".school", e.school) + field("City", "education." + k + ".city", e.city) +
        '<div class="grid2">' + field("From", "education." + k + ".start", e.start, "Aug 2021") + field("To", "education." + k + ".end", e.end, "May 2025") + "</div>" +
        '<div class="grid3">' + field("CGPA", "education." + k + ".cgpa", e.cgpa, "8.4") +
        '<div><label class="f" for="sc' + k + '">Out of</label><select class="i" id="sc' + k + '" data-path="data.education.' + k + '.scale">' + ["10", "4", ""].map((v) => '<option value="' + v + '"' + ((e.scale || "") === v ? " selected" : "") + ">" + (v || "—") + "</option>").join("") + "</select></div>" +
        field("Class 12", "education." + k + ".twelfth", e.twelfth, "92%") + field("Class 10", "education." + k + ".tenth", e.tenth, "95%") + "</div>")).join("") +
        '<button class="btn sm" data-act="add-entry" data-list="education" style="margin-top:12px">' + ICON.plus + "Add education</button>";
      sub = sub || count(d.education);
    } else if (s === "skills") {
      body += listField("Technical skills", "skills.technical", d.skills.technical, "Python, SQL, Power BI") + listField("Tools", "skills.tools", d.skills.tools, "MS Excel, Git, Tally") + listField("Soft skills", "skills.soft", d.skills.soft, "Teamwork, Presentation") +
        '<p class="small muted">Separate with commas.</p>';
      const n = d.skills.technical.length + d.skills.tools.length + d.skills.soft.length; sub = sub || (n ? n + " skills" : "Empty");
    } else if (s === "projects") {
      body += d.projects.map((p, k) => entry("Project " + (k + 1), "projects", k,
        field("Project title", "projects." + k + ".title", p.title) + field("Tools / tech used", "projects." + k + ".tech", p.tech, "Python, Flask") + bullets("projects", k, p.bullets))).join("") +
        '<button class="btn sm" data-act="add-entry" data-list="projects" style="margin-top:12px">' + ICON.plus + "Add project</button>";
      sub = sub || count(d.projects);
    } else if (s === "internships" || s === "experience") {
      body += d[s].map((x, k) => entry((s === "internships" ? "Internship " : "Job ") + (k + 1), s, k,
        field(s === "internships" ? "Role" : "Job title", s + "." + k + ".role", x.role) + field("Company / organisation", s + "." + k + ".org", x.org) + field("City", s + "." + k + ".city", x.city) +
        '<div class="grid2">' + field("From", s + "." + k + ".start", x.start, "Jun 2024") + field("To", s + "." + k + ".end", x.end, "Jul 2024 or Present") + "</div>" + bullets(s, k, x.bullets))).join("") +
        '<button class="btn sm" data-act="add-entry" data-list="' + s + '" style="margin-top:12px">' + ICON.plus + (s === "internships" ? "Add internship" : "Add job") + "</button>";
      sub = sub || count(d[s]);
    } else if (s === "languages") {
      body += listField("Languages known", "languages", d.languages, "English, Malayalam, Hindi");
      sub = sub || (d.languages.length ? d.languages.join(", ") : "Empty");
    } else {
      body += '<label class="f" for="f_' + s + '">One per line</label><textarea class="i" id="f_' + s + '" data-lines="data.' + s + '" rows="3">' + esc(d[s].join("\n")) + "</textarea>" + exampleBtn(s, "lines:data." + s);
      const n = d[s].filter((x) => x.trim()).length; sub = sub || (n ? n + (n === 1 ? " line" : " lines") : "Empty");
    }
    return card(s, L.SECTION_TITLES[s], sub, true, i, body, hidden);
  }
  function field(label, path, value, ph) {
    const id = "f_" + path.replace(/\./g, "_");
    return '<div><label class="f" for="' + id + '">' + esc(label) + '</label><input class="i" id="' + id + '" data-path="data.' + path + '" value="' + esc(value || "") + '"' + (ph ? ' placeholder="' + esc(ph) + '"' : "") + "></div>";
  }
  function listField(label, path, arr, ph) {
    const id = "f_" + path.replace(/\./g, "_");
    return '<label class="f" for="' + id + '">' + esc(label) + '</label><input class="i" id="' + id + '" data-list="data.' + path + '" value="' + esc(arr.join(", ")) + '" placeholder="' + esc(ph) + '">';
  }
  function entry(title, list, k, inner) {
    return '<div class="entry"><div class="entry-head"><b>' + esc(title) + '</b><span><button class="icon-btn" data-act="entry-up" data-list="' + list + '" data-k="' + k + '" aria-label="Move up"' + (k === 0 ? " disabled" : "") + ">" + ICON.up + '</button><button class="icon-btn" data-act="entry-del" data-list="' + list + '" data-k="' + k + '" aria-label="Delete ' + esc(title) + '">' + ICON.trash + "</button></span></div>" + inner + "</div>";
  }
  function bullets(list, k, arr) {
    const n = arr.filter((b) => b.trim()).length;
    return '<label class="f">Bullet points</label>' + arr.map((b, j) =>
      '<div class="bul"><label class="sr" for="b_' + list + k + "_" + j + '">Bullet ' + (j + 1) + '</label><textarea class="i grow" id="b_' + list + k + "_" + j + '" data-path="data.' + list + "." + k + ".bullets." + j + '" rows="2">' + esc(b) + "</textarea>" +
      '<div class="tools"><button class="icon-btn" data-act="bul-up" data-list="' + list + '" data-k="' + k + '" data-j="' + j + '" aria-label="Move bullet up"' + (j === 0 ? " disabled" : "") + ">" + ICON.up + '</button><button class="icon-btn" data-act="bul-del" data-list="' + list + '" data-k="' + k + '" data-j="' + j + '" aria-label="Delete bullet">' + ICON.trash + "</button></div></div>").join("") +
      '<div class="row" style="margin-top:8px"><button class="btn sm ghost" data-act="bul-add" data-list="' + list + '" data-k="' + k + '">' + ICON.plus + "Add bullet</button>" + exampleBtn(list, "bullet:" + list + "." + k) + "</div>" +
      (n && (n < 3 || n > 5) ? '<p class="hint">3–5 bullets usually read best. You have ' + n + ".</p>" : "");
  }
  function emptyPick(where) {
    return '<h2 class="view-title">' + where + '</h2><div class="card stack"><p>Open a resume first, or start a new one.</p><button class="btn primary block" data-act="new">' + ICON.plus + 'New resume</button><button class="btn block" data-act="go" data-tab="resumes">See your resumes</button></div>';
  }

  // path helpers
  function getAt(obj, path) { return path.split(".").reduce((o, k) => (o == null ? o : o[k]), obj); }
  function setAt(obj, path, val) { const ks = path.split("."), last = ks.pop(); const o = ks.reduce((a, k) => a[k], obj); o[last] = val; }
  const NEW_ENTRY = {
    education: () => ({ degree: "", field: "", school: "", city: "", start: "", end: "", cgpa: "", scale: "10", tenth: "", twelfth: "" }),
    projects: () => ({ title: "", tech: "", bullets: ["", "", ""] }),
    internships: () => ({ role: "", org: "", city: "", start: "", end: "", bullets: ["", "", ""] }),
    experience: () => ({ role: "", org: "", city: "", start: "", end: "", bullets: ["", "", ""] }),
  };

  // ---------- Preview ----------
  function preview() {
    const r = cur(); if (!r) return;
    const o = sheet("Preview", '<p class="small muted">This is exactly what prints. Use Export to save the PDF.</p><div class="paper-wrap" id="pw"><div class="paper rv" id="paper">' + L.resumeToHTML(r) + "</div></div>");
    const pw = $("#pw", o), p = $("#paper", o);
    const fit = () => { const s = (pw.clientWidth - 20) / 794; p.style.transform = "scale(" + s + ")"; pw.style.height = p.offsetHeight * s + 20 + "px"; };
    fit(); setTimeout(fit, 50);
  }

  // ---------- Tailor ----------
  function viewTailor() {
    if (!state.resumes.length) return emptyPick("Tailor");
    const r = cur() || state.resumes[0];
    const T = ui.tailor;
    let h = '<h2 class="view-title">Tailor for a job</h2><p class="view-sub">Paste a job post and see which of its words your resume doesn\'t use yet.</p><div class="card">' +
      '<label class="f" for="tRes">Resume</label><select class="i" id="tRes">' + state.resumes.map((x) => '<option value="' + x.id + '"' + (x.id === r.id ? " selected" : "") + ">" + esc(x.title) + "</option>").join("") + "</select>" +
      '<div class="row" style="justify-content:space-between;margin-top:10px"><label class="f" for="tText" style="margin:0">Job post</label><button class="btn sm ghost" data-act="paste">Paste</button></div>' +
      '<textarea class="i" id="tText" rows="7" placeholder="Paste the full job post here, including the requirements.">' + esc(T.text) + "</textarea>" +
      '<div class="grid2"><div><label class="f" for="tCo">Company (optional)</label><input class="i" id="tCo" value="' + esc(T.company) + '"></div><div><label class="f" for="tRole">Role (optional)</label><input class="i" id="tRole" value="' + esc(T.role) + '"></div></div>' +
      '<button class="btn primary block" data-act="tailor-run" style="margin-top:12px">Find missing words</button></div>';
    if (T.result) {
      const { found, missing, none } = T.result;
      if (none) h += '<div class="card"><h3>No clear keywords found</h3><p class="muted">Paste the full job post, especially the requirements or skills part.</p></div>';
      else {
        h += '<div class="card"><h3>Missing words to consider</h3><p class="small" style="margin:0 0 8px"><b>Only add words that are true for you.</b> Tap a word to add it to Skills or copy it.</p>' +
          (missing.length ? '<div class="chips">' + missing.map((w) => '<button class="chip missing" data-act="chip" data-word="' + esc(w) + '"><span class="tag">Missing</span>' + esc(w) + "</button>").join("") + "</div>" : '<p class="muted">None: your resume already uses the main words from this post.</p>') +
          '</div><div class="card"><h3>Already in your resume</h3>' + (found.length ? '<div class="chips">' + found.map((w) => '<span class="chip found"><span class="tag">Found</span>' + esc(w) + "</span>").join("") + "</div>" : '<p class="muted">None yet.</p>') +
          '</div><div class="card"><p class="small muted" style="margin-top:0">Saving a tailored copy keeps your base resume as it is, so you can change this copy for this job.</p><button class="btn primary block" data-act="tailor-save">Save as tailored copy</button></div>';
      }
    }
    return h;
  }
  function runTailor() {
    const T = ui.tailor;
    T.text = $("#tText").value; T.company = $("#tCo").value; T.role = $("#tRole").value;
    const r = state.resumes.find((x) => x.id === $("#tRes").value);
    if (!T.text.trim()) { toast("Paste a job post first."); return; }
    const terms = L.extractTerms(T.text);
    T.resumeId = r.id;
    T.result = terms.length ? Object.assign(L.matchTerms(terms, L.resumeToPlainText(r)), { none: false }) : { found: [], missing: [], none: true };
    render();
  }

  // ---------- Check ----------
  function viewCheck() {
    const r = cur(); if (!r) return emptyPick("Check");
    return '<h2 class="view-title">Check</h2><p class="view-sub">A quick look before you send it.</p><div class="card" id="checks"></div>' +
      '<div class="card"><h3>Copy-paste test</h3><p class="small">This is the text your resume should give, in this order. After you save the PDF, open it, select all, copy, and paste into Notes. If the order is jumbled, use a different PDF viewer or browser.</p>' +
      '<pre class="plain" id="plainOut"></pre><button class="btn sm" data-act="copy-plain">' + ICON.copy + "Copy this text</button></div>";
  }
  function fillCheck() {
    const r = cur(); if (!r) return;
    const d = r.data, N = CONTENT.checklistNotes, items = [];
    // one page: measure the print layout (A4 182mm wide, 273mm tall inside margins)
    const m = $("#measure"); m.innerHTML = L.resumeToHTML(r);
    const pagePx = 273 * 96 / 25.4, pages = m.scrollHeight / pagePx; m.innerHTML = "";
    items.push(pages <= 1.01 ? ["ok", "Fits on one page", N.onePage] : ["fix", "Longer than one page (about " + Math.ceil(pages) + " pages)", N.onePage]);
    items.push(d.phone.trim() && d.email.trim() ? ["ok", "Phone and email as plain text", N.contact] : ["fix", "Add your phone and email", N.contact]);
    items.push(["ok", "Standard section headings", N.headings]);
    items.push(d.show.photo ? ["info", "Photo is switched on (only for forms that ask)", N.photo] : ["ok", "No photo", N.photo]);
    const bc = L.bulletCounts(r), off = bc.filter((x) => x.n < 3 || x.n > 5);
    items.push(!bc.length ? ["info", "No projects or jobs yet", N.bullets] : off.length ? ["fix", "Bullets: " + off.map((x) => x.what + " has " + x.n).join("; "), N.bullets] : ["ok", "3–5 bullets each", N.bullets]);
    const ds = L.dateStyles(r);
    items.push(ds.length <= 1 ? ["ok", "Dates written the same way", N.dates] : ["fix", "Dates are written in " + ds.length + " different ways (" + ds.join(", ") + ")", N.dates]);
    items.push(["info", "Name the file " + L.suggestedFileName(r), N.fileName]);
    const label = { ok: "Done", fix: "Fix", info: "Note" };
    $("#checks").innerHTML = "<h3>Checklist</h3>" + items.map(([st, t, note]) => '<div class="check"><span class="st ' + st + '">' + label[st] + "</span><div><b>" + esc(t) + '</b><span class="small muted">' + esc(note || "") + "</span></div></div>").join("");
    $("#plainOut").textContent = L.resumeToPlainText(r) || "(Your resume is empty.)";
  }

  // ---------- Export ----------
  const GUIDES = {
    android: ["Tap Save as PDF below.", "In the print screen, set the printer at the top to Save as PDF.", "Tap the PDF button and choose where to save.", "Open the PDF and check it's one page."],
    iphone: ["Tap Save as PDF below.", "In the print screen, tap Share (or pinch out on the preview).", "Choose Save to Files.", "Open the PDF from Files and check it's one page."],
    computer: ["Click Save as PDF below.", "Set Destination to Save as PDF.", "Open More settings and turn off Headers and footers.", "Click Save."],
  };
  function viewExport() {
    const r = cur(); if (!r) return emptyPick("Export");
    const empty = L.isResumeEmpty(r), fname = L.suggestedFileName(r);
    return '<h2 class="view-title">Export</h2><p class="view-sub">' + esc(r.title) + "</p>" +
      (empty ? '<div class="banner info" style="margin:0 0 12px">Your resume is empty. Fill in a few sections in Build first.</div>' : "") +
      '<div class="card"><h3>Save as PDF</h3><div class="seg" role="tablist">' + [["android", "Android"], ["iphone", "iPhone"], ["computer", "Computer"]].map(([k, l]) => '<button role="tab" aria-selected="' + (ui.guide === k) + '" class="' + (ui.guide === k ? "on" : "") + '" data-act="guide" data-g="' + k + '">' + l + "</button>").join("") + "</div>" +
      '<ol class="guide">' + GUIDES[ui.guide].map((s) => "<li>" + esc(s) + "</li>").join("") + "</ol>" +
      '<button class="btn primary block" data-act="pdf" style="margin-top:12px"' + (empty ? " disabled" : "") + ">Save as PDF</button>" +
      '<p class="small muted">The PDF keeps real text, so software and people can read and copy it.</p></div>' +
      '<div class="card"><h3>Word file</h3><p class="small muted">Some job portals and HR teams ask for Word. Opens in Word, Google Docs and LibreOffice.</p><button class="btn block" data-act="docx"' + (empty ? " disabled" : "") + ">Download Word (.docx)</button></div>" +
      '<div class="card"><h3>Plain text</h3><p class="small muted">For online application forms that ask you to paste your resume.</p><button class="btn block" data-act="copy-plain"' + (empty ? " disabled" : "") + ">Copy as text</button></div>" +
      '<div class="card"><h3>File name</h3><div class="row"><code class="grow" style="word-break:break-all">' + esc(fname) + '</code><button class="btn sm ghost" data-act="copy-fname">' + ICON.copy + "Copy</button></div></div>";
  }
  function printPDF() {
    const r = cur(); if (!r || L.isResumeEmpty(r)) return;
    $("#printArea").innerHTML = L.resumeToHTML(r);
    const old = document.title; document.title = L.suggestedFileName(r).replace(/\.pdf$/, "");
    const restore = () => { document.title = old; window.removeEventListener("afterprint", restore); };
    window.addEventListener("afterprint", restore);
    window.print();
    setTimeout(restore, 3000);
  }

  // ---------- More menu ----------
  function moreMenu() {
    const links = [["jobTracker", "Track every application: Job Hunt Tracker"], ["ctc", "Got an offer? Check your real in-hand salary: Offer Check"], ["star", "Got a call? STAR interview workbook"]]
      .filter(([k]) => CONFIG.crossSell[k]).map(([k, t]) => '<a class="menu-item" href="' + esc(CONFIG.crossSell[k]) + '" target="_blank" rel="noopener">' + esc(t) + "</a>").join("");
    sheet("More", '<button class="menu-item" data-act="backup-menu">Backup &amp; restore</button><button class="menu-item" data-act="howto">How to use</button>' + links +
      '<p class="small muted" style="margin-top:16px">A tool for a clean, readable, tailored resume. It doesn\'t guarantee interviews. No account, no subscription, nothing uploaded: your data stays on this device. Made by Wiz DesignStore. v' + esc(CONFIG.version) + "</p>");
  }
  function backupMenu() {
    const last = state.lastBackupAt ? "Last backup: " + ago(state.lastBackupAt) + " (" + fmtDate(state.lastBackupAt) + ")." : "No backup yet.";
    sheet("Backup & restore", '<p class="small">Your resumes live only in this browser on this device. Clearing browser data deletes them, so download a backup now and then.</p><p class="small"><b>' + esc(last) + "</b></p>" +
      '<button class="btn primary block" data-act="backup">Download backup (.json)</button>' +
      '<label class="btn block" style="margin-top:10px">Restore from backup<input type="file" accept=".json,application/json" data-act="restore" class="sr"></label>' +
      '<button class="btn block" data-act="csv" style="margin-top:10px">Export jobs you tailored for (.csv)</button>' +
      '<hr style="border:0;border-top:1px solid var(--line);margin:18px 0"><button class="btn danger block" data-act="reset">Reset all data</button>');
  }
  function doBackup() {
    state.lastBackupAt = Date.now(); save(true);
    download("ResumeKit_backup_" + new Date().toISOString().slice(0, 10) + ".json", L.exportBackup(state), "application/json");
    toast("Backup downloaded"); closeSheet(); render();
  }
  function resetDialog() {
    const o = sheet("Reset all data", '<p>This deletes every resume and setting in this browser. Download a backup first if you might need them.</p><label class="f" for="rst">Type RESET to confirm</label><input class="i" id="rst" autocomplete="off"><div class="row" style="margin-top:12px"><button class="btn ghost grow" data-act="close-sheet">Cancel</button><button class="btn danger grow" id="rstOk" disabled>Delete everything</button></div>');
    const inp = $("#rst", o), b = $("#rstOk", o);
    inp.oninput = () => { b.disabled = inp.value.trim() !== "RESET"; };
    b.onclick = () => { state = L.newState(); save(true); closeSheet(); ui.tab = "resumes"; ui.tailor = { text: "", company: "", role: "", result: null }; render(); toast("All data deleted"); };
  }
  function howTo() {
    sheet("How to use", '<ol class="guide">' + CONTENT.howToUse.map((s) => "<li>" + esc(s) + "</li>").join("") + "</ol>" + (CONTENT.videoUrl ? '<p><a href="' + esc(CONTENT.videoUrl) + '" target="_blank" rel="noopener">Watch the 1-minute video</a></p>' : "") +
      '<p class="small muted">Open this in Chrome or Safari, not inside Instagram or WhatsApp. Tap your browser menu and choose Add to Home Screen so it opens like an app.</p>');
  }

  // ---------- photo ----------
  function readPhoto(file) {
    const r = cur(); if (!r || !file) return;
    const img = new Image(), url = URL.createObjectURL(file);
    img.onload = () => {
      const w = Math.min(300, img.width), h = Math.round(img.height * w / img.width);
      const c = document.createElement("canvas"); c.width = w; c.height = h; c.getContext("2d").drawImage(img, 0, 0, w, h);
      r.data.photo = c.toDataURL("image/jpeg", 0.85); URL.revokeObjectURL(url); touch(r); save(true); render();
      if (JSON.stringify(state).length > 4e6) toast("Storage is nearly full. Use a smaller photo or delete old resumes.");
    };
    img.onerror = () => toast("Couldn't read that image.");
    img.src = url;
  }

  // ---------- events ----------
  document.addEventListener("click", async (e) => {
    const tab = e.target.closest("nav.tabs button"); if (tab) { go(tab.dataset.tab); return; }
    const b = e.target.closest("[data-act]"); if (!b || b.tagName === "INPUT") return;
    const act = b.dataset.act, r = cur();
    const find = (id) => state.resumes.find((x) => x.id === id);
    switch (act) {
      case "close-sheet": closeSheet(); break;
      case "menu": moreMenu(); break;
      case "go": go(b.dataset.tab); break;
      case "new": layoutPicker(); break;
      case "pick-layout": closeSheet(); if (addResume(L.newResume(b.dataset.layout))) { ui.open = { personal: true }; go("build"); } break;
      case "sample": { const s = L.sampleResume(); if (addResume(s)) { toast("Sample resume added"); go("build"); } break; }
      case "open": setCurrent(b.dataset.id); go("build"); break;
      case "dup": { const x = find(b.dataset.id); const c = L.clone(x); c.id = L.newId(); c.title = x.title + " (copy)"; c.updatedAt = Date.now(); if (addResume(c)) { toast("Copy made"); render(); } break; }
      case "rename": { const x = find(b.dataset.id); promptDialog("Rename resume", "Name", x.title, (v) => { x.title = v; touch(x); render(); }); break; }
      case "del": { const x = find(b.dataset.id); confirmDialog("Delete this resume?", "\"" + x.title + "\" will be deleted from this device.", "Delete", () => {
        state.resumes = state.resumes.filter((y) => y.id !== x.id); if (state.settings.currentId === x.id) state.settings.currentId = state.resumes[0] ? state.resumes[0].id : null; save(true); render(); toast("Resume deleted"); }, true); break; }
      case "toggle-card": ui.open[b.dataset.id] = b.getAttribute("aria-expanded") !== "true"; render(); break;
      case "sec-up": case "sec-down": { const o = r.sectionOrder, i = o.indexOf(b.dataset.sec), j = act === "sec-up" ? i - 1 : i + 1; if (j < 0 || j >= o.length) break; [o[i], o[j]] = [o[j], o[i]]; touch(r); render(); break; }
      case "add-section": { const s = $("#addSec").value; r.sectionOrder.push(s); ui.open[s] = true; touch(r); render(); break; }
      case "add-entry": { const l = b.dataset.list; r.data[l].push(NEW_ENTRY[l]()); touch(r); render(); break; }
      case "entry-del": { const l = b.dataset.list, k = +b.dataset.k; confirmDialog("Delete this entry?", "It will be removed from this resume.", "Delete", () => { r.data[l].splice(k, 1); touch(r); render(); }, true); break; }
      case "entry-up": { const a = r.data[b.dataset.list], k = +b.dataset.k; if (k > 0) { [a[k - 1], a[k]] = [a[k], a[k - 1]]; touch(r); render(); } break; }
      case "bul-add": r.data[b.dataset.list][+b.dataset.k].bullets.push(""); touch(r); render(); break;
      case "bul-del": r.data[b.dataset.list][+b.dataset.k].bullets.splice(+b.dataset.j, 1); touch(r); render(); break;
      case "bul-up": { const a = r.data[b.dataset.list][+b.dataset.k].bullets, j = +b.dataset.j; if (j > 0) { [a[j - 1], a[j]] = [a[j], a[j - 1]]; touch(r); render(); } break; }
      case "examples": { const key = b.dataset.key + "|" + b.dataset.target; ui.examples[key] = !ui.examples[key]; render(); break; }
      case "use-example": {
        const t = b.dataset.target, text = b.dataset.text;
        if (t.startsWith("bullet:")) { const [l, k] = t.slice(7).split("."); const bl = r.data[l][+k].bullets; const empty = bl.findIndex((x) => !x.trim()); if (empty >= 0) bl[empty] = text; else bl.push(text); }
        else if (t.startsWith("lines:")) { const a = getAt(r, t.slice(6)); const empty = a.findIndex((x) => !x.trim()); if (empty >= 0) a[empty] = text; else a.push(text); }
        else setAt(r, t, text);
        touch(r); render(); toast("Added. Now change it to your own words."); break;
      }
      case "photo-del": r.data.photo = null; touch(r); render(); break;
      case "preview": preview(); break;
      case "paste": try { $("#tText").value = await navigator.clipboard.readText(); } catch (err) { toast("Long-press the box and choose Paste."); } break;
      case "tailor-run": runTailor(); break;
      case "chip": chipMenu(b.dataset.word); break;
      case "tailor-save": {
        const T = ui.tailor, base = state.resumes.find((x) => x.id === T.resumeId); if (!base) break;
        const c = L.duplicateForJob(base, { text: T.text, company: T.company, role: T.role });
        if (!addResume(c)) break;
        state.tailorLog.push({ resumeId: c.id, resumeTitle: c.title, company: T.company.trim(), role: T.role.trim(), date: new Date().toISOString().slice(0, 10), missingCount: T.result.missing.length });
        save(true); toast("Tailored copy saved: " + c.title); ui.tailor.result = null; go("build"); break;
      }
      case "copy-plain": copyText(L.resumeToPlainText(r), "Resume text copied"); break;
      case "copy-fname": copyText(L.suggestedFileName(r), "File name copied"); break;
      case "guide": ui.guide = b.dataset.g; render(); break;
      case "pdf": printPDF(); break;
      case "docx": download(L.suggestedFileName(r).replace(/\.pdf$/, ".docx"), new Blob([L.buildDocx(r, CONFIG.paper)], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" })); toast("Word file downloaded"); break;
      case "backup-menu": backupMenu(); break;
      case "backup": doBackup(); break;
      case "csv": download("ResumeKit_jobs_tailored.csv", L.toCSV(state.tailorLog), "text/csv;charset=utf-8"); toast("CSV downloaded"); break;
      case "reset": resetDialog(); break;
      case "howto": howTo(); break;
    }
  });
  function chipMenu(word) {
    const r = state.resumes.find((x) => x.id === ui.tailor.resumeId); if (!r) return;
    const o = sheet('"' + word + '"', '<p class="small">Add this only if it\'s true for you. It\'s added to the Technical skills of "' + esc(r.title) + '".</p><div class="row"><button class="btn primary grow" id="chipAdd">Add to Skills</button><button class="btn grow" id="chipCopy">Copy</button></div>');
    $("#chipAdd", o).onclick = () => {
      if (!r.data.skills.technical.some((s) => s.toLowerCase() === word.toLowerCase())) r.data.skills.technical.push(word);
      touch(r); closeSheet();
      const T = ui.tailor; T.result = Object.assign(L.matchTerms(L.extractTerms(T.text), L.resumeToPlainText(r)), { none: false });
      render(); toast("Added to Skills");
    };
    $("#chipCopy", o).onclick = () => { copyText(word); closeSheet(); };
  }
  document.addEventListener("input", (e) => {
    const t = e.target, r = cur(); if (!r) return;
    if (t.dataset.path) { setAt(r, t.dataset.path, t.value); touch(r); if (t.dataset.path === "data.name") $("#curName").textContent = r.title; }
    else if (t.dataset.list) { setAt(r, t.dataset.list, t.value.split(",").map((s) => s.trim()).filter(Boolean)); touch(r); }
    else if (t.dataset.lines) { setAt(r, t.dataset.lines, t.value.split("\n")); touch(r); }
  });
  document.addEventListener("change", (e) => {
    const t = e.target, r = cur();
    if (t.id === "tRes") { ui.tailor.result = null; setCurrent(t.value); render(); return; }
    if (t.dataset.act === "restore") {
      const f = t.files[0]; if (!f) return;
      if (f.size > 20e6) { toast("That file is too big. Nothing was changed."); return; }
      f.text().then((txt) => {
        const res = L.validateImport(txt);
        if (!res.ok) { toast(res.error); return; }
        confirmDialog("Replace your data?", "This replaces the " + state.resumes.length + " resume(s) here with the " + res.state.resumes.length + " in the backup.", "Restore", () => { state = res.state; save(true); ui.tab = "resumes"; render(); toast("Backup restored"); });
      });
      return;
    }
    if (!r) return;
    if (t.dataset.act === "photo") { readPhoto(t.files[0]); return; }
    if (t.dataset.switch) { r.data.show[t.dataset.switch.split(".")[1]] = t.checked; if (t.dataset.switch === "show.declaration") r.data.declaration = t.checked; touch(r); render(); return; }
    if (t.dataset.act === "sec-show") { const s = t.dataset.sec; r.hidden = t.checked ? r.hidden.filter((x) => x !== s) : r.hidden.concat(s); touch(r); render(); return; }
    if (t.tagName === "SELECT" && t.dataset.path) { setAt(r, t.dataset.path, t.value); touch(r); }
  });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeSheet(); });
  window.addEventListener("beforeunload", () => save(true));

  // ---------- start ----------
  shell();
  if (!cur() && state.resumes.length) state.settings.currentId = state.resumes[0].id;
  render();
  window.__RK = { get state() { return state; }, go, L };   // for testing
})();
