const { test } = require("node:test");
const assert = require("node:assert/strict");
const { SURVEY, getActiveQuestions } = require("../survey-data.js");

const ids = (answers) => getActiveQuestions(answers).map((q) => q.id);
const all = Array.from({ length: 16 }, (_, i) => "Q" + (i + 1));

test("there are 16 questions with unique ids Q1..Q16", () => {
  assert.deepEqual(SURVEY.map((q) => q.id), all);
});

test("every question has a section, a prompt and a valid type", () => {
  for (const q of SURVEY) {
    assert.ok(q.section && q.prompt, q.id);
    assert.ok(["single", "multi", "open"].includes(q.type), q.id);
    if (q.type !== "open") assert.ok(q.options.length >= 2 && q.options.length <= 8, q.id);
  }
});

test("Q8 is only asked when Q7 is Yes", () => {
  assert.ok(ids({ Q7: "Yes" }).includes("Q8"));
  assert.ok(!ids({ Q7: "No" }).includes("Q8"));
  assert.ok(!ids({ Q7: "Not sure" }).includes("Q8"));
});

test("Q13 branching: notifications and 'both' get Q14-Q15, journey planning skips them", () => {
  for (const q13 of ["Disruption notifications", "Both equally"]) {
    const path = ids({ Q7: "No", Q13: q13 });
    assert.ok(path.includes("Q14") && path.includes("Q15"), q13);
  }
  const planning = ids({ Q7: "No", Q13: "Alternative journey planning" });
  assert.ok(!planning.includes("Q14") && !planning.includes("Q15"));
});

test("Q16 is asked on every path", () => {
  for (const q13 of ["Disruption notifications", "Both equally", "Alternative journey planning", undefined]) {
    assert.equal(ids({ Q13: q13 }).at(-1), "Q16");
  }
});

test("the longest path is 16 questions and the shortest is 13", () => {
  assert.equal(ids({ Q7: "Yes", Q13: "Both equally" }).length, 16);
  assert.equal(ids({ Q7: "No", Q13: "Alternative journey planning" }).length, 13);
});

test("the removed written-route-description option is not in Q16", () => {
  const q16 = SURVEY.find((q) => q.id === "Q16");
  assert.ok(!q16.options.some((o) => /written|step-by-step/i.test(o)));
});
