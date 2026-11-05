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
