// Records docs/voice-demo.gif: the voice path of the survey, driven in headless
// Chromium. Run with: node e2e/record-demo.js   (needs Playwright and ffmpeg)
//
// A GIF has no sound and a headless browser has no microphone, so the Web
// Speech API is replaced the same way as in survey.e2e.test.js: what the page
// would say aloud and what the user would say are shown as captions. The
// captions are drawn by this script; everything else on screen is the real page.
const { chromium } = require("playwright");
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const URL = "file://" + path.resolve(__dirname, "..", "index.html");
const OUT = path.resolve(__dirname, "..", "docs", "voice-demo.gif");
const SIZE = { width: 1000, height: 720 };

// What the user says, in order. The page's replies are whatever the app does.
const SCRIPT = [
  "no",                          // Q1, answered by a bare word
  "yes",                         // confirm what was heard
  "repeat",                      // Q2: ask to hear the question again
  "option two",                  // answer by number
  "yes",
  "five or more days a week",    // Q3: answer in the option's own words
  "yes",
  "train", "bus", "done",        // Q4: choose several, one at a time
  "yes",
  "back",                        // go back and change the previous answer
];

function installSpeechStub() {
  const bar = document.createElement("div");
  bar.setAttribute("aria-hidden", "true");
  bar.style.cssText = "position:fixed;left:0;right:0;bottom:0;z-index:9999;padding:14px 22px;font:600 19px/1.4 system-ui,sans-serif;" +
    "color:#fff;background:#14213d;border-top:4px solid #fca311;min-height:84px;display:flex;gap:14px;align-items:center";
  const who = document.createElement("span");
  who.style.cssText = "flex:none;font-size:13px;letter-spacing:.08em;text-transform:uppercase;padding:4px 10px;border-radius:999px";
  const text = document.createElement("span");
  bar.append(who, text);
  const show = (speaker, t) => {
    who.textContent = speaker === "page" ? "Page says" : "User says";
    who.style.background = speaker === "page" ? "#fca311" : "#4cc9f0";
    who.style.color = "#14213d";
    text.textContent = t.length > 150 ? t.slice(0, 147) + "…" : t;
  };
  document.addEventListener("DOMContentLoaded", () => { document.body.append(bar); document.body.style.paddingBottom = "96px"; });

  let timer = null;
  window.__speaking = false;
  window.SpeechRecognition = class { start() { window.__rec = this; } abort() {} };
  window.speechSynthesis.cancel = () => { clearTimeout(timer); window.__speaking = false; };
  window.speechSynthesis.speak = (u) => {
    clearTimeout(timer);
    window.__speaking = true;
    show("page", u.text);
    // Reading time scaled down so the recording stays short.
    timer = setTimeout(() => { window.__speaking = false; if (u.onend) u.onend(); }, Math.min(2600, 900 + u.text.length * 10));
  };
  window.__userSays = (t) => show("user", "“" + t + "”");
  window.__say = (t) => window.__rec.onresult({ results: [[{ transcript: t }]] });
}

(async () => {
  const videoDir = fs.mkdtempSync(path.join(os.tmpdir(), "survey-demo-"));
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: SIZE, recordVideo: { dir: videoDir, size: SIZE } });
  const page = await context.newPage();
  await page.addInitScript(installSpeechStub);
  await page.goto(URL);
  await page.waitForTimeout(1200);
  await page.click("#btn-start-voice");

  const pageFinishedSpeaking = () => page.waitForFunction(() => window.__rec && !window.__speaking, null, { timeout: 15000 });
  for (const line of SCRIPT) {
    await pageFinishedSpeaking();
    await page.waitForTimeout(350);
    await page.evaluate((t) => window.__userSays(t), line);
    await page.waitForTimeout(1000);
    await page.evaluate((t) => window.__say(t), line);
    await page.waitForTimeout(150);
  }
  await pageFinishedSpeaking();
  await page.waitForTimeout(1200);
  await context.close();
  await browser.close();

  const video = path.join(videoDir, fs.readdirSync(videoDir).find((f) => f.endsWith(".webm")));
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", video, "-vf",
    "setpts=0.8*PTS,fps=6,scale=800:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=64[p];[b][p]paletteuse=dither=none:diff_mode=rectangle", OUT]);
  fs.rmSync(videoDir, { recursive: true, force: true });
  console.log("wrote", OUT, (fs.statSync(OUT).size / 1e6).toFixed(1) + " MB");
})();
