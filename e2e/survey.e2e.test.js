// End-to-end checks in headless Chromium: accessibility (axe-core), keyboard
// focus, the form path and the voice path (Web Speech API stubbed).
// Run with: npm run test:e2e   (needs `npm install` and a Playwright Chromium)
const { test, describe, before, after } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { chromium } = require("playwright");

const URL = "file://" + path.resolve(__dirname, "..", "index.html");
const AXE = require.resolve("axe-core/axe.min.js");
let browser;

before(async () => { browser = await chromium.launch(); });
after(async () => { await browser.close(); });

async function open({ voice = false } = {}) {
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  if (voice) {
    await page.addInitScript(() => {
      window.__spoken = [];
      window.SpeechRecognition = class { start() { window.__rec = this; } abort() {} };
      window.__say = (t) => window.__rec.onresult({ results: [[{ transcript: t }]] });
      window.speechSynthesis.speak = (u) => { window.__spoken.push(u.text); setTimeout(() => u.onend && u.onend(), 0); };
      window.speechSynthesis.cancel = () => {};
    });
  }
  await page.goto(URL);
  page.errors = errors;
  return page;
}

const focused = (page) => page.evaluate(() => document.activeElement.id || document.activeElement.tagName);
const next = (page) => page.click("#btn-next");
const pick = (page, label) => page.getByLabel(label, { exact: true }).check();

async function axeViolations(page) {
  await page.addScriptTag({ path: AXE });
  return page.evaluate(async () => (await axe.run(document, { runOnly: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"] }))
    .violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`));
}

describe("accessibility (axe-core, WCAG 2.1 A/AA + best practice)", () => {
  test("no violations on any screen", async () => {
    const page = await open();
    const report = {};
    report.intro = await axeViolations(page);
    await page.click("#btn-start-manual");
    report.single = await axeViolations(page);
    await pick(page, "Yes"); await next(page);
    await pick(page, "Yes"); await next(page);
    await next(page);
    report.multi = await axeViolations(page);
    for (let i = 0; i < 3; i++) await next(page);
    await pick(page, "Yes"); await next(page);
    report.open = await axeViolations(page);
    for (let i = 0; i < 20 && !(await page.isVisible("#screen-summary")); i++) await next(page);
    report.summary = await axeViolations(page);
    await page.click("#btn-submit-final");
    report.done = await axeViolations(page);
    for (const [screen, v] of Object.entries(report)) assert.deepEqual(v, [], screen);
    assert.deepEqual(page.errors, []);
    await page.close();
  });
});

describe("keyboard focus follows the content", () => {
  test("start, continue, required error, summary and done", async () => {
    const page = await open();
    await page.focus("#btn-start-manual"); await page.keyboard.press("Enter");
    assert.equal(await focused(page), "question-text");
    assert.match(await page.textContent("#question-text"), /low vision/);

    await pick(page, "Yes"); await page.focus("#btn-next"); await page.keyboard.press("Enter");
    assert.equal(await focused(page), "question-text");
    assert.match(await page.textContent("#question-text"), /screen reader/);

    // Q2 is required: continuing with no answer keeps you there and focuses the first option.
    await page.focus("#btn-next"); await page.keyboard.press("Enter");
    assert.equal(await focused(page), "Q2-opt0");
    await page.waitForFunction(() => document.getElementById("assertive-announcer").textContent.includes("needs an answer"));

    await pick(page, "No");
    for (let i = 0; i < 20 && !(await page.isVisible("#screen-summary")); i++) await next(page);
    assert.equal(await focused(page), "summary-heading");
    await page.click("#btn-submit-final");
    assert.equal(await focused(page), "done-heading");
    await page.close();
  });
});

describe("form path", () => {
  test("changing a branching answer drops the answer it no longer applies to", async () => {
    const page = await open();
    await page.click("#btn-start-manual");
    await pick(page, "Yes"); await next(page);
    await pick(page, "Yes"); await next(page);
    for (let i = 0; i < 4; i++) await next(page);
    await pick(page, "Yes"); await next(page);              // Q7 Yes -> Q8
    await page.fill("#Q8-text", "too many alerts"); await next(page);
    await page.click("#btn-prev"); await page.click("#btn-prev");
    await pick(page, "No"); await next(page);               // Q7 No -> Q8 skipped
    assert.match(await page.textContent("#question-text"), /alternative route/);
    for (let i = 0; i < 20 && !(await page.isVisible("#screen-summary")); i++) await next(page);
    assert.ok(!(await page.textContent("#summary-list")).includes("too many alerts"));
    await page.click("#btn-submit-final");
    const stored = JSON.parse(await page.evaluate(() => localStorage.getItem("accessgo_survey_response_demo")));
    assert.deepEqual(stored, { Q1: "Yes", Q2: "Yes", Q7: "No" });
    assert.equal(await page.textContent("#done-summary-note"), "Answered 3 questions in this session.");
    await page.close();
  });
});

describe("voice path (speech stubbed)", () => {
  const say = async (page, t) => { await page.waitForTimeout(20); await page.evaluate((x) => window.__say(x), t); await page.waitForTimeout(20); };
  const lastSpoken = (page) => page.evaluate(() => window.__spoken.at(-1));

  test('"no" is heard as No and "yes" confirms and moves on', async () => {
    const page = await open({ voice: true });
    await page.click("#btn-start-voice");
    await say(page, "no");
    assert.match(await lastSpoken(page), /^I heard: No\./);
    await say(page, "yes");
    assert.match(await lastSpoken(page), /screen reader/);
    assert.match(await page.textContent("#question-text"), /screen reader/);
    await page.click("#btn-prev");
    assert.equal(await page.isChecked("#Q1-opt1"), true, "Q1 radio shows the spoken answer");
    await page.close();
  });

  test('"back" on the first question re-asks instead of going silent', async () => {
    const page = await open({ voice: true });
    await page.click("#btn-start-voice");
    await say(page, "back");
    const spoken = await page.evaluate(() => window.__spoken);
    assert.match(spoken.at(-2), /first question/);
    assert.match(spoken.at(-1), /low vision/);
    await page.close();
  });
});
