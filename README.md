# AccessGo Survey — Voice Accessible

A voice-piloted, screen-reader-friendly implementation of the AccessGo requirements-elicitation survey, built for TransitVic Digital's user research with commuters who have vision impairment and use screen readers.

This is a companion demonstration artifact for the AccessGo assignment. It exists to show the accessibility-first design decisions described in the written justification, not as a production data-collection tool.

## What it does

The entire 16-question survey can be completed by voice alone: every question is spoken aloud, the response is listened for, and what was heard is always played back for confirmation before moving on. Nobody has to find, read, or tap anything to finish the survey this way.

Every question is *also* answerable through ordinary, fully accessible form controls (native radio buttons, checkboxes, and a text area) that are visible and usable at all times, whether or not voice is being used. Voice is the primary path here, not the only one: browser support for speech recognition varies, microphone permission can be denied, and a person may be somewhere they'd rather not speak aloud. The form underneath is a first-class fallback, not an afterthought.

## Using it

1. Open `index.html` in a browser (or visit the GitHub Pages link, if enabled).
2. Choose "Start with voice" or "Start without voice."
3. If using voice: listen to each question, answer aloud, and confirm what was heard. At any point you can say:
   - **"repeat"** — hear the current question again
   - **"back"** — return to the previous question and change your answer
   - **"faster" / "slower"** — adjust how quickly questions are read
   - **"pause"** — stop listening and switch to the form
   - **"yes" / "no"** — confirm or reject what was heard
   - a number ("one", "two"...) or the option's own words, to answer multiple-choice questions
4. A short, distinct tone plays at the start of each new section, so there's a sense of structure without extra spoken narration every time.
5. Before submitting, a summary of all answers is read back, with an explicit "say yes to submit" confirmation required.

## Browser support

Built on the [Web Speech API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API), which has uneven browser support:

| Browser | Speech synthesis (output) | Speech recognition (input) |
|---|---|---|
| Chrome (desktop & Android) | Yes | Yes |
| Edge | Yes | Yes |
| Safari (desktop & iOS) | Yes | Limited / inconsistent |
| Firefox | Yes | No (as of this writing) |

Where speech recognition isn't available, the app detects this on load and tells the person plainly, then relies entirely on the visible form controls, which work identically in every modern browser.

## Accessibility decisions baked in

- **Confirmation-before-advance on every question.** Speech recognition mishears things; the survey never silently accepts a guess.
- **No hard timeouts.** Listening windows don't cut a person off for taking time to think or speak.
- **No information by colour alone**; visible focus outlines throughout for keyboard and switch users.
- **Semantic HTML underneath the voice layer**: real `<fieldset>`/`<legend>`, labelled inputs, and a logical heading and tab order, so the fallback path is genuinely accessible on its own, not just present.
- **Explicit privacy disclosure** before any listening starts: audio is processed transiently in the browser to produce text, never recorded or sent anywhere by this site.
- **Section earcons**, not just more speech, to convey structure with less listening effort.

## Pilot testing

The survey structure and question wording were refined through:

1. **A persona-based walkthrough**, completing the survey from the perspective of Christina, the primary persona for this project (low vision, full-time screen reader user).
2. **Direct pilot testing with a blind participant**, using her own screen reader and speech, not a sighted tester's assumptions about what would work.

Findings that shaped this build:

- An early draft's multi-select "rank your priorities" question took noticeably longer to complete by ear than by eye, since every option has to be listened to in full before a choice can be made; this is part of why multi-select questions here explicitly support "done" as a spoken exit rather than requiring a fixed number of picks.
- A written, step-by-step route description was briefly included as one option in a single-select "most important feature" list; testing surfaced that this treats a baseline accessibility requirement (a non-visual route description) as if it were competing against optional features like step-free access or staffed stations, forcing an invalid trade-off. It was removed from that list entirely rather than reworded, since accessibility isn't something a screen-reader-dependent user should have to "vote for."
- The final survey branch logic (Section 3) was corrected so that notification-only and "both equally" respondents both continue through to the route-priority question, since route information stays relevant during a live disruption regardless of which feature a respondent initially said mattered more; only respondents who said route planning matters more skip the notification-specific questions.
- The survey was trimmed to its final 16 questions after early pilot timing showed a longer draft pushed past a reasonable completion time for voice and screen-reader navigation.

## Project structure

```
index.html       — page structure, all screens (intro, survey, summary, done)
survey-data.js    — the 16 questions, their type, options, and branching conditions
app.js            — speech synthesis/recognition, state machine, voice commands, fallback rendering
```

No build step, no dependencies, no backend. Answers exist only in the browser tab for the session (optionally mirrored to `localStorage` under the key `accessgo_survey_response_demo` for demo persistence); nothing is transmitted anywhere.

## Limitations

This is a demonstration build, not a production survey tool:

- There is no backend; "submitting" the survey stores answers only in the local browser session.
- Speech recognition accuracy depends entirely on the browser and device; it has not been tested across every screen reader and browser combination.
- English (Australian) recognition locale is hardcoded (`en-AU`); a production version would need to support multiple languages and accents more robustly.
