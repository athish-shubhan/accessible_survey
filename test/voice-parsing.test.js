const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const vp = require("../voice-parsing.js");
const { SURVEY } = require("../survey-data.js");

const opts = (id) => SURVEY.find((q) => q.id === id).options;

describe("matchOption: every option is reachable", () => {
  for (const q of SURVEY.filter((q) => q.options)) {
    q.options.forEach((opt, i) => {
      test(`${q.id}: saying "${opt}" selects it`, () => {
        assert.equal(vp.matchOption(opt, q.options), opt);
      });
      test(`${q.id}: saying its number (${i + 1}) selects it`, () => {
        assert.equal(vp.matchOption(String(i + 1), q.options), opt);
        assert.equal(vp.matchOption(["one", "two", "three", "four", "five", "six", "seven", "eight"][i], q.options), opt);
      });
    });
  }
});

describe("matchOption: regressions", () => {
  test('"no" is No, not "Prefer not to say" (Q1)', () => {
    assert.equal(vp.matchOption("no", opts("Q1")), "No");
    assert.equal(vp.matchOption("No.", opts("Q1")), "No");
  });

  test('"no" is No, not "Not sure" (Q7)', () => {
    assert.equal(vp.matchOption("no", opts("Q7")), "No");
    assert.equal(vp.matchOption("not sure", opts("Q7")), "Not sure");
    assert.equal(vp.matchOption("I'm not sure", opts("Q7")), "Not sure");
  });

  test('"one to two days a week" is not read as option one (Q3)', () => {
    assert.equal(vp.matchOption("one to two days a week", opts("Q3")), "One to two days a week");
    assert.equal(vp.matchOption("five days a week", opts("Q3")), "Five or more days a week");
  });

  test("agree / strongly agree / disagree are distinguished (Q10)", () => {
    assert.equal(vp.matchOption("agree", opts("Q10")), "Agree");
    assert.equal(vp.matchOption("I strongly agree", opts("Q10")), "Strongly agree");
    assert.equal(vp.matchOption("disagree", opts("Q10")), "Disagree");
    assert.equal(vp.matchOption("strongly disagree", opts("Q10")), "Strongly disagree");
  });

  test("option/number prefixes and filler words", () => {
    assert.equal(vp.matchOption("option two", opts("Q4")), "Tram");
    assert.equal(vp.matchOption("number 3", opts("Q4")), "Bus");
    assert.equal(vp.matchOption("yes please", opts("Q2")), "Yes");
    assert.equal(vp.matchOption("lift status", opts("Q9")), "Lift or escalator status");
  });

  test("unrecognised or out-of-range input returns null", () => {
    assert.equal(vp.matchOption("banana", opts("Q2")), null);
    assert.equal(vp.matchOption("", opts("Q2")), null);
    assert.equal(vp.matchOption("seven", opts("Q2")), null);
  });
});

describe("globalCommand", () => {
  test("recognises commands inside a sentence", () => {
    assert.equal(vp.globalCommand("can you repeat that"), "repeat");
    assert.equal(vp.globalCommand("go back"), "back");
    assert.equal(vp.globalCommand("a bit faster"), "faster");
    assert.equal(vp.globalCommand("slower please"), "slower");
    assert.equal(vp.globalCommand("pause"), "pause");
    assert.equal(vp.globalCommand("that's all"), "done");
    assert.equal(vp.globalCommand("Train"), null);
  });

  test("does not fire on longer words", () => {
    assert.equal(vp.globalCommand("not repeated ones"), null);
    assert.equal(vp.globalCommand("backpack"), null);
  });

  test("whole-utterance mode lets free-text answers contain command words", () => {
    assert.equal(vp.globalCommand("staff waiting at the back of the platform", { whole: true }), null);
    assert.equal(vp.globalCommand("announcements that repeat the platform number", { whole: true }), null);
    assert.equal(vp.globalCommand("I'm done with apps that spam me", { whole: true }), null);
    assert.equal(vp.globalCommand("back", { whole: true }), "back");
    assert.equal(vp.globalCommand("Go back.", { whole: true }), "back");
    assert.equal(vp.globalCommand("repeat please", { whole: true }), "repeat");
  });
});

describe("yes / no", () => {
  test("affirmative", () => {
    for (const t of ["yes", "Yeah", "yep that's right", "correct", "sure"]) assert.ok(vp.isAffirmative(t), t);
    assert.ok(!vp.isAffirmative("no"));
  });
  test("negative", () => {
    for (const t of ["no", "Nope", "that's wrong", "incorrect"]) assert.ok(vp.isNegative(t), t);
    assert.ok(!vp.isNegative("not now"));
    assert.ok(!vp.isNegative("yes"));
  });
});

describe("activeAnswers", () => {
  test("drops answers to questions no longer on the path, and blanks", () => {
    const answers = { Q1: "Yes", Q7: "No", Q8: "too many alerts", Q4: [], Q12: "" };
    assert.deepEqual(vp.activeAnswers(answers, ["Q1", "Q4", "Q7", "Q12"]), { Q1: "Yes", Q7: "No" });
  });
});
