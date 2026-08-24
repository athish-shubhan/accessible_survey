// AccessGo Survey — voice-piloted app logic
// Every question is answerable two ways at once: by voice (speak the
// question, listen, confirm, advance) or by the always-visible native form
// controls underneath. Voice is the primary path; the form is the fallback,
// not an afterthought, so nobody is stranded if their browser or situation
// doesn't support speech.

(function () {
  "use strict";

  // ---------------------------------------------------------------
  // Feature detection
  // ---------------------------------------------------------------
  const SpeechRecognitionImpl = window.SpeechRecognition || window.webkitSpeechRecognition;
  const speechSynthAvailable = "speechSynthesis" in window;
  const speechRecognitionAvailable = !!SpeechRecognitionImpl;

  // ---------------------------------------------------------------
  // State
  // ---------------------------------------------------------------
  const state = {
    answers: {},          // question id -> string | string[]
    order: [],             // active question ids given answers so far
    index: 0,
    voiceEnabled: false,
    rate: 1.0,
    phase: "idle",         // idle | asking | listening | confirming | listening-multi | confirming-multi
    pendingValue: null,
    multiSelected: [],
    recognizer: null,
    lastSection: null
  };

  // ---------------------------------------------------------------
  // DOM references
  // ---------------------------------------------------------------
  const $ = (id) => document.getElementById(id);
  const screenIntro = $("screen-intro");
  const screenSurvey = $("screen-survey");
  const screenSummary = $("screen-summary");
  const screenDone = $("screen-done");

  const voiceStatus = $("voice-status");
  const micDot = $("mic-dot");
  const micLabel = $("mic-label");
  const rateDisplay = $("rate-display");
  const assertiveAnnouncer = $("assertive-announcer");

  const questionSectionLabel = $("question-section-label");
  const questionText = $("question-text");
  const questionBody = $("question-body");
  const questionForm = $("question-form");

  const progressFill = $("progress-fill");
  const progressTrack = $("progress-track");
  const progressLabel = $("progress-label");
  const sectionProgressText = $("section-progress-text");

  // ---------------------------------------------------------------
  // Speech output
  // ---------------------------------------------------------------
  function speak(text, onEnd) {
    if (!speechSynthAvailable) {
      if (onEnd) onEnd();
      return;
    }
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.rate = state.rate;
    utter.onend = () => { if (onEnd) onEnd(); };
    utter.onerror = () => { if (onEnd) onEnd(); };
    window.speechSynthesis.speak(utter);
  }

  function announce(text) {
    // Screen-reader-only live region for state changes that aren't spoken aloud.
    assertiveAnnouncer.textContent = text;
  }

  // ---------------------------------------------------------------
  // Earcons — short distinct tones marking a new section
  // ---------------------------------------------------------------
  let audioCtx = null;
  function playEarcon(freq) {
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.15, audioCtx.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.35);
      osc.connect(gain).connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.36);
    } catch (e) { /* audio not available; silently skip, speech still works */ }
  }
  const SECTION_TONES = {
    "Section 1: About you and your travel": 440,
    "Section 2: Planning an alternative journey": 554,
    "Section 3: Feature prioritisation": 659
  };

  // ---------------------------------------------------------------
  // Speech input
  // ---------------------------------------------------------------
  function startRecognition(onTranscript) {
    if (!speechRecognitionAvailable) {
      setVoiceStatus("Voice input isn't supported in this browser. Please use the form below.", "error");
      return;
    }
    if (state.recognizer) {
      try { state.recognizer.abort(); } catch (e) {}
    }
    const rec = new SpeechRecognitionImpl();
    rec.lang = "en-AU";
    rec.continuous = false;
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    state.recognizer = rec;

    micDot.classList.add("live");
    micLabel.textContent = "Listening…";

    rec.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      micDot.classList.remove("live");
      micLabel.textContent = "Mic idle";
      onTranscript(transcript);
    };
    rec.onerror = (event) => {
      micDot.classList.remove("live");
      micLabel.textContent = "Mic idle";
      if (event.error === "no-speech") {
        setVoiceStatus("I didn't catch that. Press Listen, or say it again.", "error");
      } else if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        setVoiceStatus("Microphone access was denied. You can still use the form below.", "error");
      } else {
        setVoiceStatus("There was a problem listening. Press Listen to try again.", "error");
      }
    };
    rec.onend = () => {
      micDot.classList.remove("live");
      micLabel.textContent = "Mic idle";
    };
    rec.start();
  }

  function setVoiceStatus(text, stateName) {
    voiceStatus.textContent = text;
    voiceStatus.setAttribute("data-state", stateName || "idle");
  }

  // ---------------------------------------------------------------
  // Transcript parsing helpers
  // ---------------------------------------------------------------
  const NUMBER_WORDS = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8 };

  function wordsToNumber(t) {
    for (const word in NUMBER_WORDS) {
      if (new RegExp("\\b" + word + "\\b").test(t)) return NUMBER_WORDS[word];
    }
    const m = t.match(/\b([1-8])\b/);
    if (m) return parseInt(m[1], 10);
    return null;
  }

  function matchOption(transcript, options) {
    const t = transcript.toLowerCase().trim();
    const num = wordsToNumber(t);
    if (num && options[num - 1]) return options[num - 1];
    let best = null, bestScore = 0;
    options.forEach((opt) => {
      const optLower = opt.toLowerCase();
      if (t.includes(optLower) || optLower.includes(t)) {
        const score = optLower.length;
        if (score > bestScore) { bestScore = score; best = opt; }
      } else {
        const tTokens = new Set(t.split(/\s+/).filter((w) => w.length > 2));
        const oTokens = optLower.split(/\s+/).filter((w) => w.length > 2);
        const overlap = oTokens.filter((w) => tTokens.has(w)).length;
        if (overlap > 0 && overlap > bestScore) { bestScore = overlap; best = opt; }
      }
    });
    return best;
  }

  function isAffirmative(t) { return /\b(yes|yeah|yep|correct|right|confirm|sure)\b/i.test(t); }
  function isNegative(t) { return /\b(no|nope|wrong|incorrect)\b/i.test(t); }

  function globalCommand(t) {
    const s = t.toLowerCase();
    if (/\brepeat\b/.test(s)) return "repeat";
    if (/\bback\b/.test(s)) return "back";
    if (/\bfaster\b/.test(s)) return "faster";
    if (/\bslower\b/.test(s)) return "slower";
    if (/\bpause\b/.test(s)) return "pause";
    if (/\bdone\b|\bfinished\b|that.?s all/.test(s)) return "done";
    return null;
  }

  // ---------------------------------------------------------------
  // Navigation / branching
  // ---------------------------------------------------------------
  function recomputeOrder() {
    state.order = getActiveQuestions(state.answers).map((q) => q.id);
  }

  function currentQuestion() {
    const id = state.order[state.index];
    return SURVEY.find((q) => q.id === id);
  }

  function updateProgress() {
    const q = currentQuestion();
    const total = state.order.length;
    const pos = state.index + 1;
    progressFill.style.width = Math.round((state.index / Math.max(total - 1, 1)) * 100) + "%";
    progressTrack.setAttribute("aria-valuenow", Math.round((state.index / Math.max(total - 1, 1)) * 100));
    progressLabel.textContent = "Question " + pos + " of " + total;
    sectionProgressText.textContent = q.section;
  }

  function goNext() {
    recomputeOrder();
    const q = currentQuestion();
    const idxInOrder = state.order.indexOf(q.id);
    if (idxInOrder < state.order.length - 1) {
      state.index = idxInOrder + 1;
      renderCurrentQuestion();
    } else {
      showSummary();
    }
  }

  function goBack() {
    if (state.index > 0) {
      state.index -= 1;
      renderCurrentQuestion();
    }
  }

  // ---------------------------------------------------------------
  // Rendering the fallback (and always-visible) form controls
  // ---------------------------------------------------------------
  function renderCurrentQuestion() {
    window.speechSynthesis && window.speechSynthesis.cancel();
    if (state.recognizer) { try { state.recognizer.abort(); } catch (e) {} }
    state.phase = "idle";
    setVoiceStatus("Voice is off. Press \u201cListen\u201d, or use the form below.", "idle");

    const q = currentQuestion();
    updateProgress();
    questionSectionLabel.textContent = q.section;
    questionText.textContent = q.prompt + (q.type === "multi" ? " (choose all that apply)" : "");
    questionBody.innerHTML = "";

    if (q.type === "single") {
      const fs = document.createElement("fieldset");
      const legend = document.createElement("legend");
      legend.textContent = q.prompt;
      fs.appendChild(legend);
      q.options.forEach((opt, i) => {
        const row = document.createElement("div");
        row.className = "option-row";
        const input = document.createElement("input");
        input.type = "radio";
        input.name = q.id;
        input.id = q.id + "-opt" + i;
        input.value = opt;
        if (state.answers[q.id] === opt) { input.checked = true; row.classList.add("selected"); }
        const label = document.createElement("label");
        label.setAttribute("for", input.id);
        label.textContent = opt;
        input.addEventListener("change", () => {
          document.querySelectorAll("#question-body .option-row").forEach((r) => r.classList.remove("selected"));
          row.classList.add("selected");
        });
        row.appendChild(input);
        row.appendChild(label);
        fs.appendChild(row);
      });
      questionBody.appendChild(fs);
    } else if (q.type === "multi") {
      const fs = document.createElement("fieldset");
      const legend = document.createElement("legend");
      legend.textContent = q.prompt;
      fs.appendChild(legend);
      const existing = Array.isArray(state.answers[q.id]) ? state.answers[q.id] : [];
      q.options.forEach((opt, i) => {
        const row = document.createElement("div");
        row.className = "option-row";
        const input = document.createElement("input");
        input.type = "checkbox";
        input.name = q.id;
        input.id = q.id + "-opt" + i;
        input.value = opt;
        if (existing.includes(opt)) { input.checked = true; row.classList.add("selected"); }
        const label = document.createElement("label");
        label.setAttribute("for", input.id);
        label.textContent = opt;
        input.addEventListener("change", () => {
          row.classList.toggle("selected", input.checked);
        });
        row.appendChild(input);
        row.appendChild(label);
        fs.appendChild(row);
      });
      questionBody.appendChild(fs);
    } else if (q.type === "open") {
      const label = document.createElement("label");
      label.setAttribute("for", q.id + "-text");
      label.className = "visually-hidden";
      label.textContent = q.prompt;
      const textarea = document.createElement("textarea");
      textarea.id = q.id + "-text";
      textarea.name = q.id;
      textarea.value = state.answers[q.id] || "";
      questionBody.appendChild(label);
      questionBody.appendChild(textarea);
    }

    // Section earcon on first question of a new section
    if (state.lastSection !== q.section) {
      playEarcon(SECTION_TONES[q.section] || 440);
      state.lastSection = q.section;
    }

    $("btn-prev").disabled = state.index === 0;

    if (state.voiceEnabled) {
      askQuestionByVoice();
    }
  }

  function readManualAnswerFromDOM(q) {
    if (q.type === "single") {
      const checked = questionBody.querySelector('input[name="' + q.id + '"]:checked');
      return checked ? checked.value : null;
    }
    if (q.type === "multi") {
      const checked = Array.from(questionBody.querySelectorAll('input[name="' + q.id + '"]:checked'));
      return checked.map((c) => c.value);
    }
    if (q.type === "open") {
      const ta = $(q.id + "-text");
      return ta ? ta.value.trim() : "";
    }
    return null;
  }

  // ---------------------------------------------------------------
  // Voice flow
  // ---------------------------------------------------------------
  function speakOptionsList(options) {
    return options.map((o, i) => (i + 1) + ": " + o).join(". ");
  }

  function askQuestionByVoice() {
    const q = currentQuestion();
    state.phase = "asking";
    state.multiSelected = Array.isArray(state.answers[q.id]) ? state.answers[q.id].slice() : [];
    setVoiceStatus("Asking: " + q.prompt, "asking");

    let spoken = q.prompt;
    if (q.type === "single" || q.type === "multi") {
      spoken += " " + (q.type === "multi" ? "You can choose more than one. " : "") + speakOptionsList(q.options);
      if (q.type === "multi") spoken += ". Say the options that apply, one at a time, then say done.";
    } else {
      spoken += " Say your answer after the tone.";
    }

    speak(spoken, () => {
      if (q.type === "multi") {
        state.phase = "listening-multi";
        setVoiceStatus("Listening for an option to add, or say \u201cdone\u201d to continue.", "listening");
      } else {
        state.phase = "listening";
        setVoiceStatus("Listening for your answer\u2026", "listening");
      }
      startRecognition(handleTranscript);
    });
  }

  function handleTranscript(transcript) {
    const q = currentQuestion();
    const cmd = globalCommand(transcript);

    // Global commands work in every phase.
    if (cmd === "repeat") { askQuestionByVoice(); return; }
    if (cmd === "back") { goBack(); return; }
    if (cmd === "pause") {
      state.voiceEnabled = false;
      state.phase = "idle";
      setVoiceStatus("Voice paused. Use the form below, or press \u201cListen\u201d to resume.", "idle");
      return;
    }
    if (cmd === "faster") { adjustRate(0.15); askQuestionByVoice(); return; }
    if (cmd === "slower") { adjustRate(-0.15); askQuestionByVoice(); return; }

    if (state.phase === "listening") {
      let value;
      if (q.type === "open") {
        value = transcript.trim();
      } else {
        value = matchOption(transcript, q.options);
        if (!value) {
          setVoiceStatus("I didn't recognise that option. Say a number, like \u201cone\u201d, or press Listen to try again.", "error");
          speak("Sorry, I didn't recognise that option. " + speakOptionsList(q.options), () => startRecognition(handleTranscript));
          return;
        }
      }
      state.pendingValue = value;
      state.phase = "confirming";
      const confirmText = "I heard: " + value + ". Say yes to confirm, repeat to try again, or back to change a previous answer.";
      setVoiceStatus(confirmText, "confirming");
      speak(confirmText, () => startRecognition(handleTranscript));
      return;
    }

    if (state.phase === "confirming") {
      if (isAffirmative(transcript)) {
        commitAnswer(q, state.pendingValue);
        applyAnswerToDOM(q, state.pendingValue);
        goNext();
      } else if (isNegative(transcript) || cmd === "repeat") {
        askQuestionByVoice();
      } else {
        speak("Sorry, say yes to confirm, or repeat to try again.", () => startRecognition(handleTranscript));
      }
      return;
    }

    if (cmd === "done") {
      if (state.multiSelected.length === 0) {
        speak("You haven't chosen any options yet. Say one, or say \u2018none of these\u2019 to leave it blank and continue.", () => startRecognition(handleTranscript));
        return;
      }
      state.phase = "confirming-multi";
      const confirmText = "I heard: " + state.multiSelected.join(", ") + ". Say yes to confirm, or repeat to start over.";
      setVoiceStatus(confirmText, "confirming");
      speak(confirmText, () => startRecognition(handleTranscript));
      return;
    }

    if (state.phase === "listening-multi") {
      if (/\bnone of these\b/i.test(transcript)) {
        state.multiSelected = [];
        state.phase = "confirming-multi";
        speak("Leaving this blank. Say yes to confirm, or repeat to start over.", () => startRecognition(handleTranscript));
        return;
      }
      const value = matchOption(transcript, q.options);
      if (!value) {
        speak("I didn't recognise that option. " + speakOptionsList(q.options) + ". Or say done to continue.", () => startRecognition(handleTranscript));
        return;
      }
      if (!state.multiSelected.includes(value)) state.multiSelected.push(value);
      speak("Added " + value + ". Say another option, or say done.", () => startRecognition(handleTranscript));
      return;
    }

    if (state.phase === "confirming-multi") {
      if (isAffirmative(transcript)) {
        commitAnswer(q, state.multiSelected.slice());
        applyAnswerToDOM(q, state.multiSelected);
        goNext();
      } else {
        askQuestionByVoice();
      }
      return;
    }
  }

  function commitAnswer(q, value) {
    state.answers[q.id] = value;
  }

  function applyAnswerToDOM(q, value) {
    if (q.type === "single") {
      const input = questionBody.querySelector('input[name="' + q.id + '"][value="' + CSS.escape(value) + '"]');
      if (input) { input.checked = true; input.dispatchEvent(new Event("change")); }
    } else if (q.type === "multi") {
      questionBody.querySelectorAll('input[name="' + q.id + '"]').forEach((input) => {
        input.checked = value.includes(input.value);
        input.dispatchEvent(new Event("change"));
      });
    } else if (q.type === "open") {
      const ta = $(q.id + "-text");
      if (ta) ta.value = value;
    }
  }

  function adjustRate(delta) {
    state.rate = Math.max(0.5, Math.min(2.0, Math.round((state.rate + delta) * 100) / 100));
    rateDisplay.textContent = state.rate.toFixed(1) + "x";
  }

  // ---------------------------------------------------------------
  // Summary / submit
  // ---------------------------------------------------------------
  function showSummary() {
    window.speechSynthesis && window.speechSynthesis.cancel();
    if (state.recognizer) { try { state.recognizer.abort(); } catch (e) {} }
    screenSurvey.hidden = true;
    screenSummary.hidden = false;

    const list = $("summary-list");
    list.innerHTML = "";
    let spokenSummary = "Here is a summary of your answers. ";
    state.order.forEach((id) => {
      const q = SURVEY.find((sq) => sq.id === id);
      const val = state.answers[id];
      if (val === undefined || val === null || val === "" || (Array.isArray(val) && val.length === 0)) return;
      const dt = document.createElement("dt");
      dt.textContent = q.prompt;
      const dd = document.createElement("dd");
      const displayVal = Array.isArray(val) ? val.join(", ") : val;
      dd.textContent = displayVal;
      list.appendChild(dt);
      list.appendChild(dd);
      spokenSummary += q.prompt + " " + displayVal + ". ";
    });
    spokenSummary += "Say yes to submit, or back to change something.";

    if (state.voiceEnabled) {
      setVoiceStatus(spokenSummary, "confirming");
      speak(spokenSummary, () => startRecognition(handleSummaryTranscript));
    }
  }

  function handleSummaryTranscript(transcript) {
    const cmd = globalCommand(transcript);
    if (isAffirmative(transcript)) {
      finalSubmit();
    } else if (isNegative(transcript) || cmd === "back") {
      screenSummary.hidden = true;
      screenSurvey.hidden = false;
      renderCurrentQuestion();
    } else {
      speak("Say yes to submit, or back to change an answer.", () => startRecognition(handleSummaryTranscript));
    }
  }

  function finalSubmit() {
    window.speechSynthesis && window.speechSynthesis.cancel();
    if (state.recognizer) { try { state.recognizer.abort(); } catch (e) {} }
    try {
      localStorage.setItem("accessgo_survey_response_demo", JSON.stringify(state.answers));
    } catch (e) { /* storage unavailable; not essential for the demo */ }
    screenSummary.hidden = true;
    screenDone.hidden = false;
    $("done-summary-note").textContent = "Answered " + Object.keys(state.answers).length + " questions in this session.";
    if (state.voiceEnabled) speak("Thank you. Your responses have been recorded for this session.");
  }

  // ---------------------------------------------------------------
  // Wiring: intro screen
  // ---------------------------------------------------------------
  $("speech-support-note").textContent = speechRecognitionAvailable
    ? "Voice input is supported in this browser."
    : "This browser doesn't support voice input; the form below will still work fully.";

  $("btn-start-voice").addEventListener("click", () => {
    state.voiceEnabled = speechRecognitionAvailable;
    beginSurvey();
    if (!speechRecognitionAvailable) {
      setVoiceStatus("Voice input isn't available in this browser. Use the form below.", "error");
    }
  });
  $("btn-start-manual").addEventListener("click", () => {
    state.voiceEnabled = false;
    beginSurvey();
  });

  function beginSurvey() {
    screenIntro.hidden = true;
    screenSurvey.hidden = false;
    recomputeOrder();
    state.index = 0;
    renderCurrentQuestion();
  }

  // ---------------------------------------------------------------
  // Wiring: survey screen controls
  // ---------------------------------------------------------------
  $("btn-listen").addEventListener("click", () => {
    state.voiceEnabled = true;
    askQuestionByVoice();
  });
  $("btn-repeat").addEventListener("click", () => askQuestionByVoice());
  $("btn-back").addEventListener("click", () => goBack());
  $("btn-prev").addEventListener("click", () => goBack());
  $("btn-faster").addEventListener("click", () => adjustRate(0.15));
  $("btn-slower").addEventListener("click", () => adjustRate(-0.15));

  questionForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const q = currentQuestion();
    const value = readManualAnswerFromDOM(q);
    if (q.required && (value === null || value === "" || (Array.isArray(value) && value.length === 0))) {
      announce("This question needs an answer before continuing.");
      return;
    }
    state.answers[q.id] = value;
    goNext();
  });

  // ---------------------------------------------------------------
  // Wiring: summary / done screens
  // ---------------------------------------------------------------
  $("btn-summary-back").addEventListener("click", () => {
    screenSummary.hidden = true;
    screenSurvey.hidden = false;
    renderCurrentQuestion();
  });
  $("btn-submit-final").addEventListener("click", () => finalSubmit());

})();
