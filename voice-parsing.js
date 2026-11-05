// AccessGo Survey — transcript parsing
// Pure functions that turn a speech-recognition transcript into an answer
// or a voice command. Kept separate from app.js (no DOM, no Web Speech
// API) so they can be unit tested in Node: see test/voice-parsing.test.js.

(function (root) {
  "use strict";

  const NUMBER_WORDS = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8 };
  const NUMBER_TOKEN = "(one|two|three|four|five|six|seven|eight|[1-8])";
  // "two", "option two", "number 3", "the first one" is not supported on purpose:
  // only an utterance that is *just* a number is read as an option number.
  const BARE_NUMBER = new RegExp("^(?:(?:option|number)\\s+)?" + NUMBER_TOKEN + "$");

  function normalise(t) {
    return String(t || "")
      .toLowerCase()
      .replace(/[‘’]/g, "'")
      .replace(/[^a-z0-9' ]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function escapeRegExp(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  // True if `phrase` appears in `text` as whole words.
  function containsPhrase(text, phrase) {
    if (!phrase) return false;
    return new RegExp("(^| )" + escapeRegExp(phrase) + "( |$)").test(text);
  }

  // Returns 1-8 if the whole utterance is an option number, else null.
  function wordsToNumber(t) {
    const m = normalise(t).match(BARE_NUMBER);
    if (!m) return null;
    return NUMBER_WORDS[m[1]] || parseInt(m[1], 10);
  }

  // Map a transcript to one of `options`, or null if nothing fits.
  // Order of preference:
  //   1. the utterance is just a number ("two", "option 2")
  //   2. exact match with an option
  //   3. the option's words appear in the utterance (longest option wins,
  //      so "strongly agree" beats "agree")
  //   4. the utterance's words appear in the option ("not sure" -> "Not sure")
  //   5. the most shared words of 3+ letters
  // Matching is on whole words, so "no" never matches "not" or "none".
  function matchOption(transcript, options) {
    const t = normalise(transcript);
    if (!t) return null;

    const num = wordsToNumber(t);
    if (num && options[num - 1]) return options[num - 1];

    const norm = options.map(normalise);
    const exact = norm.indexOf(t);
    if (exact !== -1) return options[exact];

    let best = null, bestLen = 0;
    norm.forEach((o, i) => {
      if (containsPhrase(t, o) && o.length > bestLen) { best = options[i]; bestLen = o.length; }
    });
    if (best) return best;

    best = null; bestLen = Infinity;
    norm.forEach((o, i) => {
      if (containsPhrase(o, t) && o.length < bestLen) { best = options[i]; bestLen = o.length; }
    });
    if (best) return best;

    const tTokens = new Set(t.split(" ").filter((w) => w.length > 2));
    let bestOverlap = 0;
    norm.forEach((o, i) => {
      const overlap = o.split(" ").filter((w) => w.length > 2 && tTokens.has(w)).length;
      if (overlap > bestOverlap) { bestOverlap = overlap; best = options[i]; }
    });
    return best;
  }

  function isAffirmative(t) { return /\b(yes|yeah|yep|correct|right|confirm|sure)\b/i.test(t); }
  function isNegative(t) { return /\b(no|nope|wrong|incorrect)\b/i.test(t); }

  const COMMAND_PATTERNS = [
    ["repeat", /\brepeat\b/],
    ["back", /\bback\b/],
    ["faster", /\bfaster\b/],
    ["slower", /\bslower\b/],
    ["pause", /\bpause\b/],
    ["done", /\bdone\b|\bfinished\b|that.?s all/]
  ];

  // Recognise a spoken command anywhere in the utterance.
  // With { whole: true } the utterance must be only the command (optionally
  // with "go" / "please"), which is what free-text answers need: otherwise an
  // answer like "staff at the back of the platform" would trigger "back".
  function globalCommand(t, opts) {
    const s = normalise(t);
    if (opts && opts.whole) {
      const core = s.replace(/^(please |go |can you )+/, "").replace(/( please)$/, "").trim();
      for (const [name, re] of COMMAND_PATTERNS) {
        if (name === "done") continue; // "done" is a valid free-text answer
        if (new RegExp("^" + re.source + "$").test(core)) return name;
      }
      return null;
    }
    for (const [name, re] of COMMAND_PATTERNS) if (re.test(s)) return name;
    return null;
  }

  function isBlank(v) {
    return v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0);
  }

  // Keep only answers to questions that are still active and non-blank.
  // Changing a branching answer (e.g. Q7 from "Yes" to "No") can leave an
  // answer behind for a question that no longer applies (Q8).
  function activeAnswers(answers, activeIds) {
    const out = {};
    activeIds.forEach((id) => { if (!isBlank(answers[id])) out[id] = answers[id]; });
    return out;
  }

  const api = { normalise, wordsToNumber, matchOption, isAffirmative, isNegative, globalCommand, isBlank, activeAnswers };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.VoiceParsing = api;
})(typeof window !== "undefined" ? window : this);
