// Run: node build.js   → dist/Resume_Kit_India.html (one self-contained offline file)
const fs = require("fs");
const path = require("path");
const src = (f) => fs.readFileSync(path.join(__dirname, "src", f), "utf8");

const BUILDS = {
  IN: {
    file: "Resume_Kit_India.html",
    content: "content_india.json",
    config: {
      productName: "ATS Resume Kit",
      region: "IN",
      paper: "A4",
      maxResumes: 20,
      backupReminderDays: 7,
      storageKey: "wiz_resumekit_v1",
      version: "1.0.0",
      crossSell: {
        jobTracker: "https://wizdesigns.vercel.app/job-hunt-tracker.html",
        ctc: "https://wizdesigns.vercel.app/offer-check.html",
        star: "",
        bundle: "",
      },
    },
  },
};

for (const [region, b] of Object.entries(BUILDS)) {
  const content = JSON.parse(fs.readFileSync(path.join(__dirname, b.content), "utf8"));
  delete content._readme;
  const html = src("index.html")
    .replace("{{TITLE}}", b.config.productName + " — Wiz Designs")
    .replace("{{STYLE}}", () => src("style.css"))
    .replace("{{CONFIG}}", () => "// Verified on " + new Date().toISOString().slice(0, 10) + ": no external facts used.\nconst CONFIG = " + JSON.stringify(b.config, null, 2) + ";")
    .replace("{{CONTENT}}", () => "const CONTENT = " + JSON.stringify(content) + ";")
    .replace("{{LOGIC}}", () => src("logic.js").replace("if (typeof module !== \"undefined\") module.exports = LOGIC;", ""))
    .replace("{{APP}}", () => src("app.js"));
  fs.mkdirSync(path.join(__dirname, "dist"), { recursive: true });
  const out = path.join(__dirname, "dist", b.file);
  fs.writeFileSync(out, html);
  console.log(region + ": " + out + " (" + (Buffer.byteLength(html) / 1024).toFixed(1) + " KB)");
}
