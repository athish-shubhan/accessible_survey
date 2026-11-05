// AccessGo Survey — question data
// Mirrors the 16-question TransitVic Digital AccessGo survey exactly as
// submitted (Survey_for_TransitVic_Digital_-_Google_Forms.pdf), including
// the final Q13 branch logic and the Q16 revision described in Activity 2,
// Part C.
//
// Funnel structure (Activity 2, Part B): the three sections move from easy
// factual items to reflective/evaluative ones — screening and context,
// then journey-planning experience, then evaluative prioritisation — to
// build rapport before anything sensitive, reducing dropout.
//
// Q13 branch logic (final, revised — see Activity 2 Part C, Problem 1):
//   Q13 = "Disruption notifications" or "Both equally"  -> Q14 -> Q15 -> Q16
//   Q13 = "Alternative journey planning"                 -> skips Q14/Q15, straight to Q16
//   Q16 is asked of every respondent regardless of path, since route
//   information stays relevant during a live disruption regardless of a
//   respondent's stated priority.
//
//   This replaces an earlier draft where "both equally" respondents were
//   routed into one merged seven-option question forcing a single choice
//   between "only high-priority alerts" and "real-time updates during a
//   disruption." That forced a false choice: Christina's notification
//   preferences are state-dependent (minimal alerts when nothing is wrong,
//   meaningful updates during an active disruption) — not competing
//   preferences to rank against each other. Q13-15 route around that
//   instead of merging it into one list.
//
// Q16 revision (Activity 2 Part C, Problem 2): an earlier draft included
// "a written, step-by-step route description instead of a visual map" as
// one option in this single-select list. Since the target respondent
// relies entirely on a screen reader, accessible route presentation is a
// baseline requirement, not a preference to rank against step-free access
// or staffed stations — so that option was removed entirely rather than
// reworded, the same way disruption severity is treated as a built-in
// default elsewhere rather than a ranked preference.

const SURVEY = [

  // ---------------- Section 1: About you and your travel ----------------
  // Q1-Q8 establish the target user class (commuters with vision impairment
  // who rely on screen readers) and their notification goals, per the
  // Question-to-Need Mapping Table in Activity 2 Part B.
  {
    // Persona goal: cannot reliably use visual-only information.
    // Pain point: visual-only app design excludes her — confirms target
    // user class before eliciting requirements. "Prefer not to say" is
    // offered since this discloses disability status, reducing social
    // desirability bias.
    id: "Q1", section: "Section 1: About you and your travel", type: "single", required: true,
    prompt: "Do you have low vision or another vision impairment that affects how you use a smartphone or navigate public transport?",
    options: ["Yes", "No", "Prefer not to say"]
  },
  {
    // Persona goal: uses a screen reader for all smartphone interactions.
    // Pain point: screen-reader-incompatible formats block access —
    // confirms target user class before eliciting requirements.
    id: "Q2", section: "Section 1: About you and your travel", type: "single", required: true,
    prompt: "Do you use a screen reader, such as VoiceOver, TalkBack, or a similar tool, on your smartphone?",
    options: ["Yes", "No"]
  },
  {
    // Persona goal: frequent commuter. Pain point: frequent travel
    // increases exposure to disruptions, contextualising the notification
    // and route-planning pain points below. Iterative testing broadened
    // this from "in the city" to "commute or daily travel."
    id: "Q3", section: "Section 1: About you and your travel", type: "single",
    prompt: "How often do you use public transport for your commute or daily travel?",
    options: ["Rarely, less than once a week", "One to two days a week", "Three to four days a week", "Five or more days a week"]
  },
  {
    // Persona goal: uses train/tram, doesn't drive. Pain point: modal mix
    // determines which lines/routes disruption alerts must target,
    // linking to "notifications don't say whether her line is affected."
    id: "Q4", section: "Section 1: About you and your travel", type: "multi",
    prompt: "Which types of public transport do you use at least once a week?",
    options: ["Train", "Tram", "Bus", "Other"]
  },
  {
    // Pain point: reliance on multiple discovery channels, not just the
    // app notification itself. Iterative testing split "avoiding
    // strangers" and "using social media" into distinct options since
    // they're different behaviours.
    id: "Q5", section: "Section 1: About you and your travel", type: "multi",
    prompt: "How do you find out if a journey is disrupted?",
    options: ["Notification from the transport app", "Checking the transport app manually, even without a notification", "Station announcements", "People around me", "I do not find out until I am affected", "Social media", "Other"]
  },
  {
    // Persona goal: wants timely, screen-reader-friendly notifications
    // about disruptions affecting her journey. Pain point: notifications
    // don't say whether her line is affected. Balanced five-point scale
    // with explicit neutral midpoint, avoiding acquiescence bias.
    id: "Q6", section: "Section 1: About you and your travel", type: "single",
    prompt: "How important is it to you that a disruption notification tells you whether it affects your specific line or route?",
    options: ["Extremely important", "Very important", "Somewhat important", "Not so important", "Not at all important"]
  },
  {
    // Persona goal: prefers only high-priority alerts, finds frequent
    // notifications overwhelming. Evidence: previously uninstalled apps
    // that sent too many.
    id: "Q7", section: "Section 1: About you and your travel", type: "single",
    prompt: "Have you ever stopped using a transport or travel app because it sent too many notifications?",
    options: ["Yes", "No", "Not sure"]
  },
  {
    // Same persona goal/pain point as Q7; open-ended qualitative follow-up
    // captures the detail behind the uninstall history without priming
    // respondents with researcher-assumed reasons.
    id: "Q8", section: "Section 1: About you and your travel", type: "open",
    prompt: "In a few words, what made you stop using it?",
    condition: (answers) => answers.Q7 === "Yes"
  },

  // ---------------- Section 2: Planning an alternative journey ----------------
  // Q9-Q12 target route-planning goals and journey-map pain points
  // one-for-one.
  {
    // Persona goal: plan alternative routes accounting for step-free
    // access and staffed stations. Pain point: route options don't
    // indicate accessibility.
    id: "Q9", section: "Section 2: Planning an alternative journey", type: "multi",
    prompt: "When your usual journey is disrupted, what information do you need before choosing an alternative route?",
    options: ["Step-free access", "Staffed stations", "Lift or escalator status", "Replacement bus accessibility", "Distance I'd need to walk", "Seating availability", "Other"]
  },
  {
    // Persona goal: feel confident about where to go without needing to
    // ask strangers for help. Pain point: unfamiliar interchange stations
    // feel risky; dependence on other passengers is undesirable during a
    // disruption.
    //
    // Wording matches the final submitted survey exactly (negative
    // framing: agreement here indicates the pain point, not confidence).
    // Revised from an earlier, ambiguous "staff or other passengers"
    // statement to "other passengers" specifically, matching the target
    // respondent's actual goal of avoiding dependence on strangers rather
    // than on station staff generally. Balanced five-point scale with
    // neutral midpoint, matching Q6/Q11.
    id: "Q10", section: "Section 2: Planning an alternative journey", type: "single",
    prompt: "When navigating an unfamiliar interchange station during a disruption, I need to ask other passengers for help.",
    options: ["Strongly disagree", "Disagree", "Neutral", "Agree", "Strongly agree"]
  },
  {
    // Persona goal: checking replacement bus accessibility (journey map
    // action). Pain point: replacement bus accessibility unknown until
    // boarding — turns this single named pain point directly into a
    // testable item.
    id: "Q11", section: "Section 2: Planning an alternative journey", type: "single",
    prompt: "Knowing whether a replacement bus or tram is accessible before I board is important to me.",
    options: ["Strongly disagree", "Disagree", "Neutral", "Agree", "Strongly agree"]
  },
  {
    // Same persona goal/pain point as Q10 (confidence navigating unfamiliar
    // interchanges without asking strangers); open-ended to surface
    // solutions the closed items above can't anticipate.
    id: "Q12", section: "Section 2: Planning an alternative journey", type: "open",
    prompt: "What would help you feel more confident navigating an unfamiliar interchange station during a disruption?"
  },

  // ---------------- Section 3: Feature prioritisation ----------------
  // Q13-Q16 fulfil the requirement to explore relative feature
  // importance. Q13 is a filter question, narrowing to a broader category
  // before showing a more specific list, rather than one long merged list
  // upfront — long response lists increase respondent burden, a cost
  // compounded for screen-reader users listening sequentially rather than
  // scanning visually. See branch-logic note at the top of this file.
  {
    // Aggregate of notification and route goals; filter question used to
    // route respondents to relevant sub-questions below. "Both equally"
    // was added during iterative testing to avoid a false binary between
    // equally weighted goals.
    id: "Q13", section: "Section 3: Feature prioritisation", type: "single",
    prompt: "Which matters more to you when thinking about disruptions?",
    options: ["Disruption notifications", "Alternative journey planning", "Both equally"]
  },
  {
    // Persona goal: prefers only high-priority alerts, finds frequent
    // notifications overwhelming (same evidence as Q7/Q8). Asked only of
    // respondents who said notifications matter (or matter equally).
    id: "Q14", section: "Section 3: Feature prioritisation", type: "single",
    prompt: "Outside of an active disruption, what kind of notifications do you want about your line?",
    options: ["Only urgent or high-priority alerts", "All updates, including minor ones", "Other"],
    condition: (answers) => answers.Q13 === "Disruption notifications" || answers.Q13 === "Both equally"
  },
  {
    // Pain point: too few updates during an ongoing disruption causes
    // anxiety about whether the situation has changed — the tension
    // between wanting infrequent alerts generally and wanting updates
    // during an active disruption specifically. Clarified during
    // iterative testing to resolve that tension explicitly.
    id: "Q15", section: "Section 3: Feature prioritisation", type: "single",
    prompt: "Once a disruption affecting your line has started, what matters most to you?",
    options: ["Frequent real-time updates until it's resolved, only relevant updates, not repeated ones", "One clear update explaining the delay and its impact", "Other"],
    condition: (answers) => answers.Q13 === "Disruption notifications" || answers.Q13 === "Both equally"
  },
  {
    // Aggregate of the route-related pain points above (route accessibility
    // unknown, replacement bus accessibility unknown until boarding,
    // unfamiliar interchanges feel risky). Asked of every respondent
    // regardless of Q13 path, since route information stays relevant
    // during a live disruption regardless of stated priority. The
    // written-step-by-step-description option was removed entirely — see
    // "Q16 revision" note at the top of this file.
    id: "Q16", section: "Section 3: Feature prioritisation", type: "single",
    prompt: "Which of the following matters most to you?",
    options: ["Step-free alternative route options", "Staffed station indicators", "Replacement bus accessibility information", "Ability to save or favourite accessible routes", "Other"]
  }
];

// Given current answers, returns the ordered list of questions that apply
// (i.e. filters out any question whose condition is not met).
function getActiveQuestions(answers) {
  return SURVEY.filter(q => !q.condition || q.condition(answers));
}

// Allow the data and branching to be loaded by the Node tests in test/.
if (typeof module !== "undefined" && module.exports) {
  module.exports = { SURVEY, getActiveQuestions };
}
