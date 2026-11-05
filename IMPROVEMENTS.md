# Improvements log

## Round 1 — 2026-11-05

### What changed
1. **Bug: voice answers picked the wrong option.** `matchOption` used plain substring matching and read any number word in the sentence as an option number. Saying an option's own label could select a different option, and 8 of the 41 options couldn't be chosen by saying their label at all:
   - Q1 "no" → *Prefer not to say*; Q7 "no" → *Not sure* (because "no" is inside "not")
   - Q10/Q11 "agree" → *Disagree*; "disagree" → *Strongly disagree*
   - Q3 "one to two days a week" → *Rarely* (option one); Q15 "one clear update…" → option one

   Matching now works on whole words. An exact label wins, then the longest option contained in the utterance. A number counts only when it is the whole utterance ("two", "option two").
2. **Bug: free-text answers could trigger voice commands.** Dictating "staff at the back of the platform" for Q12 ran the **back** command and threw the answer away. While a free-text answer is being dictated, a command now counts only when it is said on its own ("back", "go back", "repeat please").
3. **Bug: stale branching answers were stored on submit.** If someone answered Q7 "Yes" and Q8, then went back and changed Q7 to "No", Q8 was still saved to `localStorage`. The "Answered N questions" count also included skipped and blank questions. Submit now saves only non-blank answers to questions on the current path, which matches the summary the person just confirmed.
4. **Bug: saying "back" on the first question stalled the voice flow.** Nothing was spoken and listening never restarted. The app now says it's the first question and asks it again.
5. **Tests and CI.** The parsing helpers moved out of `app.js` into `voice-parsing.js` (pure functions, loaded by `index.html` before `app.js`), and `survey-data.js` can now also be loaded in Node. There are 137 `node:test` tests with no dependencies: every option is reachable by its label and its number, the regressions above, commands, yes/no, and the Q7→Q8 and Q13→Q14/Q15→Q16 branching. GitHub Actions runs a syntax check and `npm test` on every PR.
6. **README.** Updated the project structure, added "Running the tests", and documented how commands behave in free-text answers.

### Why it matters
For a survey whose main path is voice, a person who says "no" or "agree" and hears "I heard: Prefer not to say" or "I heard: Disagree" has to work out that they must say a number instead. That is the extra effort the design is meant to remove. The stored response also didn't match what the person confirmed.

### How it was verified
```
$ npm test
# tests 137
# pass 137
# fail 0

# the same test files against the original parsing code from main (app.js helpers, no activeAnswers):
# tests 137
# pass 122
# fail 15
```
I also ran a browser check in headless Chromium (Playwright, script not committed) on `index.html`, on this branch and on `main`. Speech recognition and synthesis were stubbed so the voice path could be driven:

| Check | main | this branch |
|---|---|---|
| Form path: Q7 Yes → Q8 → back → Q7 No → submit, keys stored | `Q1…Q13,Q16` incl. **Q8** and blanks | `Q1,Q2,Q7` |
| "Answered N questions" (3 answered) | 14 | 3 |
| Voice: say "back" on Q1 | nothing spoken, listening stops | "This is the first question…" then re-asks |
| Voice: say "no" on Q1 | "I heard: Prefer not to say" | "I heard: No" |
| Page errors | none | none |

**Not verified:** real speech recognition in a real browser with a microphone, and real screen readers (VoiceOver/TalkBack/NVDA). The browser support table and the pilot-testing findings in the README were left unchanged.

### Files touched
`app.js`, `voice-parsing.js` (new), `survey-data.js` (Node export only), `index.html` (one script tag), `package.json` (new, test script only), `test/` (new), `.github/workflows/ci.yml` (new), `README.md`, `IMPROVEMENTS.md` (new).

## Round 2 — 2026-11-05

### What changed
1. **Bug: keyboard and screen-reader focus was lost between steps.** Nothing in `app.js` moved focus, which I checked in Chromium:
   - "Start without voice" / "Start with voice" hid the button that had focus, so focus fell back to `<body>`.
   - "Continue" left focus on the Continue button. The status live region was given the same text again, so a screen reader announced nothing about the new question.
   - The last "Continue" (into the summary) and "Submit" also left focus on hidden buttons.

   Focus now moves to the new question's text (`tabindex="-1"`), to the first option when a required question is left blank, and to the summary and thank-you headings.
2. **Repeated announcements.** `announce()` set the live region to the same string each time, and many screen readers don't re-read unchanged text. A second blank submit was therefore silent. The region is now cleared before each announcement.
3. **End-to-end tests (`e2e/`, 5 tests, `npm run test:e2e`).** These run in headless Chromium. axe-core checks all six screens (intro, single, multi, open, summary, done). Other tests cover focus at each step, the form path with a Q7 branching change (exact stored response and count), and the voice path with speech stubbed: "no" is heard as No, "yes" advances, "back" on Q1 re-asks. `playwright` and `axe-core` are devDependencies only; the page still has no runtime dependencies. CI has a new `e2e` job.
4. **README.** Added the focus behaviour to "Accessibility decisions" and documented how to run the e2e tests.

### Why it matters
The README promises a screen-reader-friendly fallback path. Before this change, a screen-reader user pressing Continue had no indication that anything happened, and a keyboard user had to find their way back from the top of the page after every screen change.

### How it was verified
Focus trace (Playwright, keyboard `Enter` on each button):

| Step | round 1 | round 2 |
|---|---|---|
| Start without voice | `<body>` (focus lost) | `p#question-text` "Do you have low vision…" |
| Continue Q1 → Q2 | `button#btn-next` | `p#question-text` "Do you use a screen reader…" |
| Continue on required Q2, blank | `button#btn-next` | `input#Q2-opt0` |
| Arrive on summary | `<body>` (focus lost) | `h1#summary-heading` |
| Submit | `button#btn-submit-final` (hidden) | `h1#done-heading` |

```
$ npm run test:e2e
# tests 5   # pass 5   # fail 0
# with round-1 app.js + index.html: # pass 4   # fail 1   (keyboard focus test)
$ npm test
# tests 137   # pass 137   # fail 0
```
axe-core 4.10.2 reported 0 violations on every screen both before and after this change, so focus handling was the gap automated scanning doesn't catch.

**Not verified:** behaviour with real screen readers (VoiceOver, TalkBack, NVDA). In voice mode, a screen reader may now read the focused question while speech synthesis also reads it. The existing `role="status"` voice panel already read "Asking: …" aloud in the same way, but I couldn't test how the overlap sounds in practice.

### Files touched
`app.js`, `index.html`, `package.json`, `package-lock.json` (new), `.gitignore` (new), `e2e/survey.e2e.test.js` (new), `.github/workflows/ci.yml`, `README.md`, `IMPROVEMENTS.md`.
