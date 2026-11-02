import type { HypothesisConfig, StakeholderCategory } from "@/data/research/types";

/**
 * Primary research (channel checks): planning, compliance screening and
 * deterministic analysis of notes the USER recorded.
 *
 * Integrity rules enforced here and in the UI:
 *  - Interview guides are generated templates. They are labelled
 *    `ai-generated` / template work product and are never evidence.
 *  - Notes are `user-primary`. They stay in the user's browser and are
 *    screened for personal data and MNPI risk before anything else.
 *  - Analysis extracts what the notes say; it does not add facts.
 */

export interface InterviewGuide {
  stakeholderId: string;
  stakeholder: string;
  origin: "template";
  objective: string;
  hypotheses: Array<{ id: string; title: string }>;
  opening: string[];
  questions: string[];
  closing: string[];
  cautions: string[];
}

const OPENING = [
  "Confirm consent to take notes and whether any remarks may be quoted (attributed or anonymised).",
  "Remind the interviewee not to share confidential or material non-public information about any company.",
  "Ask about their role and what part of the freight market they see directly.",
  "Establish the observation period, region, equipment or mode, business size and spot/contract mix so later comparisons use a consistent basis.",
];
const CLOSING = [
  "What would change your view over the next two quarters?",
  "Is there anything you expected me to ask that I did not?",
  "May I follow up, and is there anyone else you suggest I speak with?",
];

export function buildInterviewGuide(category: StakeholderCategory, hypotheses: HypothesisConfig[]): InterviewGuide {
  const linked = hypotheses.filter((h) => category.hypothesisIds.includes(h.id));
  return {
    stakeholderId: category.id,
    stakeholder: category.label,
    origin: "template",
    objective: `${category.why} Tests: ${linked.map((h) => `${h.id} (${h.title})`).join(", ")}.`,
    hypotheses: linked.map((h) => ({ id: h.id, title: h.title })),
    opening: OPENING,
    questions: [
      ...category.questions,
      "What changed within comparable operations, and what changed because of customer, route or equipment mix?",
      "Which observations are first-hand, and which come from what others have told you?",
      "What evidence points in the opposite direction, and what would change your interpretation?",
    ],
    closing: CLOSING,
    cautions: [
      ...category.cautions,
      "Record what the interviewee observed directly, separately from what they heard second-hand.",
    ],
  };
}

// ── Compliance screening ────────────────────────────────────────────────────

export type ScreenFlagKind = "pii-email" | "pii-phone" | "pii-id" | "mnpi-language" | "confidentiality";

export interface ScreenFlag {
  kind: ScreenFlagKind;
  match: string;
  message: string;
}

const MNPI_PATTERNS: Array<[RegExp, string]> = [
  [/\b(not (yet )?(public|announced|released)|unannounced|pre-?announcement|before (the )?(earnings|announcement|release))\b/i, "Refers to information that may not be public yet."],
  [/\b(material non-?public|mnpi|inside information|insider)\b/i, "Mentions material non-public / inside information."],
  [/\b(internal (forecast|budget|numbers|guidance)|guidance (before|ahead of))\b/i, "Refers to a company's internal forecasts or guidance."],
  [/\b(embargo(ed)?|under nda|nda|deal (terms|talks)|acquisition talks|merger talks)\b/i, "Mentions embargoed or deal-related information."],
];
const CONFIDENTIAL = /\b(confidential|don'?t share|do not share|off the record|proprietary to)\b/i;

export function screenText(text: string): ScreenFlag[] {
  const flags: ScreenFlag[] = [];
  const email = text.match(/[\w.+-]+@[\w-]+\.[\w.-]+/);
  if (email) flags.push({ kind: "pii-email", match: email[0], message: "Contains an email address. Remove personal contact details." });
  const phone = text.match(/(\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}\b/);
  if (phone) flags.push({ kind: "pii-phone", match: phone[0], message: "Contains a phone number. Remove personal contact details." });
  const ssn = text.match(/\b\d{3}-\d{2}-\d{4}\b/);
  if (ssn) flags.push({ kind: "pii-id", match: ssn[0], message: "Contains what looks like a government ID number." });
  for (const [pattern, message] of MNPI_PATTERNS) {
    const m = text.match(pattern);
    if (m) flags.push({ kind: "mnpi-language", match: m[0], message: `${message} Do not record or act on MNPI; consult compliance.` });
  }
  const c = text.match(CONFIDENTIAL);
  if (c) flags.push({ kind: "confidentiality", match: c[0], message: "Marked confidential or off the record. Confirm you have permission to keep it." });
  return flags;
}

/** Redact emails and phone numbers for display or for sending to an AI model. */
export function redactPersonalData(text: string): string {
  return text
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, "[email removed]")
    .replace(/(\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}\b/g, "[phone removed]")
    .replace(/\b\d{3}-\d{2}-\d{4}\b/g, "[id removed]");
}

// ── Deterministic note analysis ─────────────────────────────────────────────

export type ThemeId = "volume" | "pricing" | "capacity" | "fuel" | "labor" | "inventory" | "contract-spot";

const THEMES: Record<ThemeId, { label: string; terms: RegExp }> = {
  volume: { label: "Freight volume", terms: /\b(volume|volumes|loads?|shipments?|tonnage|orders?|demand)\b/i },
  pricing: { label: "Rates & pricing", terms: /\b(rates?|pricing|prices?|linehaul|rate per mile|yield)\b/i },
  capacity: { label: "Capacity", terms: /\b(capacity|trucks? parked|exits?|exiting|bankrupt\w*|authorit(y|ies)|fleet size|tender rejections?)\b/i },
  fuel: { label: "Fuel", terms: /\b(fuel|diesel|surcharges?)\b/i },
  labor: { label: "Drivers & labor", terms: /\b(drivers?|wages?|labor|labour|turnover|recruit\w*)\b/i },
  inventory: { label: "Inventory", terms: /\b(inventor(y|ies)|restock\w*|destock\w*|stock levels?)\b/i },
  "contract-spot": { label: "Contract vs spot", terms: /\b(spot|contract(ual)?|bid season|bids?|rfp)\b/i },
};

const UP = /\b(up|higher|rising|rose|increas\w*|grow\w*|tighter|tightening|stronger|improv\w*|accelerat\w*|recover\w*|firm\w*|more)\b/i;
const DOWN = /\b(down|lower|falling|fell|declin\w*|decreas\w*|weaker|soft\w*|loose\w*|loosening|slow\w*|less|fewer|worse\w*)\b/i;

export type Direction = "up" | "down" | "mixed" | "unclear";

export interface ThemeFinding {
  theme: ThemeId;
  label: string;
  direction: Direction;
  sentences: string[];
}

export interface ExtractedIndicator {
  text: string;
  value: string;
  context: string;
}

export interface NoteAnalysis {
  themes: ThemeFinding[];
  indicators: ExtractedIndicator[];
  flags: ScreenFlag[];
}

export function splitSentences(text: string): string[] {
  return text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?;])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 3);
}

function directionOf(sentences: string[]): Direction {
  let up = 0;
  let down = 0;
  for (const s of sentences) {
    if (UP.test(s)) up += 1;
    if (DOWN.test(s)) down += 1;
  }
  if (up === 0 && down === 0) return "unclear";
  if (up > 0 && down > 0) return up >= 2 * down ? "up" : down >= 2 * up ? "down" : "mixed";
  return up > 0 ? "up" : "down";
}

export function analyzeNotes(text: string): NoteAnalysis {
  const sentences = splitSentences(text);
  const themes: ThemeFinding[] = (Object.keys(THEMES) as ThemeId[])
    .map((theme) => {
      const hits = sentences.filter((s) => THEMES[theme].terms.test(s));
      return { theme, label: THEMES[theme].label, direction: directionOf(hits), sentences: hits.slice(0, 4) };
    })
    .filter((t) => t.sentences.length > 0);
  const indicators: ExtractedIndicator[] = [];
  const numberPattern = /([-+]?\$?\d[\d,]*(\.\d+)?\s?(%|percent|pp|bps|cents|\/mile|per mile|per gallon|loads|trucks)?)/gi;
  for (const s of sentences) {
    for (const m of s.matchAll(numberPattern)) {
      const value = m[0].trim();
      if (!/[%$]|percent|pp|bps|mile|gallon|loads|trucks/i.test(value)) continue;
      indicators.push({ text: s, value, context: s.length > 160 ? `${s.slice(0, 157)}…` : s });
    }
  }
  return { themes, indicators: indicators.slice(0, 20), flags: screenText(text) };
}

/** What each hypothesis expects to hear, per theme. Used to flag contradictions in notes. */
export const HYPOTHESIS_THEME_EXPECTATIONS: Record<string, Partial<Record<ThemeId, "up" | "down">>> = {
  H1: { volume: "up" },
  H2: { pricing: "up" },
  H3: { capacity: "down" },
  H4: { fuel: "up" },
};

export interface NoteContradiction {
  hypothesisId: string;
  theme: ThemeId;
  expected: "up" | "down";
  observed: Direction;
  sentence: string;
}

export function contradictionsWithHypotheses(analysis: NoteAnalysis): NoteContradiction[] {
  const out: NoteContradiction[] = [];
  for (const [hypothesisId, expectations] of Object.entries(HYPOTHESIS_THEME_EXPECTATIONS)) {
    for (const [theme, expected] of Object.entries(expectations) as Array<[ThemeId, "up" | "down"]>) {
      const finding = analysis.themes.find((t) => t.theme === theme);
      if (!finding || finding.direction === "unclear" || finding.direction === "mixed") continue;
      if (finding.direction !== expected) out.push({ hypothesisId, theme, expected, observed: finding.direction, sentence: finding.sentences[0] });
    }
  }
  return out;
}

/** Cross-source comparison: per theme, which notes say up vs down. */
export function crossSourceAgreement(
  notes: Array<{ id: string; label: string; analysis: NoteAnalysis }>,
): Array<{ theme: ThemeId; label: string; up: string[]; down: string[]; mixed: string[]; agreement: "agree" | "disagree" | "single-source" }> {
  return (Object.keys(THEMES) as ThemeId[])
    .map((theme) => {
      const up: string[] = [];
      const down: string[] = [];
      const mixed: string[] = [];
      for (const note of notes) {
        const f = note.analysis.themes.find((t) => t.theme === theme);
        if (!f) continue;
        if (f.direction === "up") up.push(note.label);
        else if (f.direction === "down") down.push(note.label);
        else mixed.push(note.label);
      }
      const sources = up.length + down.length + mixed.length;
      const agreement: "agree" | "disagree" | "single-source" = sources <= 1 ? "single-source" : up.length > 0 && down.length > 0 ? "disagree" : "agree";
      return { theme, label: THEMES[theme].label, up, down, mixed, agreement };
    })
    .filter((row) => row.up.length + row.down.length + row.mixed.length > 0);
}
