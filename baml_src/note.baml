// The CaptureNote play, authored as BAML (T-007-04, story S-007, epic E-007) — the SECOND
// play, and the keystone proof that the casting engine is play-agnostic (≥2 plays through
// one castPlay). A minimal-but-real Red SORCERY (card-model.md): a fast, single-use capture,
// in deliberate contrast to DecomposeEpic's Blue/White permanent. AUTHORING ONLY, exactly
// like decompose.baml: `b.request.CaptureNote(...)` renders the prompt, the `claude -p` seam
// (src/executor/claude.ts) dispenses, `b.parse.CaptureNote(text)` SAP-parses the reply into a
// typed Note. ClaudeStub is render-only; BAML is never the transport.
//
// SAP PARSE-LENIENCY HAZARD (inherited from decompose.baml): Note carries required strings
// and an array, and the SAP parser never REJECTS such a class — a malformed reply degrades to
// an EMPTY Note (blank title/summary, []) rather than throwing. The play's `substance` gate
// (src/play/note-core.ts) MUST classify an empty note as a STOP; `b.parse` alone cannot.

// The captured note: a tight, useful distillation of a topic, grounded in project state.
class Note {
  title string @description("a short, specific title for the note — a phrase, not a sentence")
  summary string @description("ONE or two sentences capturing the essence — no fluff")
  points string[] @description("3-6 concrete takeaways or observations; never empty")
}

function CaptureNote(topic: string, project: string) -> Note {
  client ClaudeStub
  prompt #"
    You are Vend's note-taker — a fast, one-shot capture play (a Red sorcery). Distill the
    TOPIC below, grounded in the project's ACTUAL state, into a tight, useful note: a
    specific title, a one-or-two-sentence summary, and a handful of concrete points. No
    fluff, no speculation, no restating the topic — capture what IS, briefly. This is a
    single cast for the moment, not a reusable plan.

    ## The topic to capture
    {{ topic }}

    ## The project's current state (go-and-see — ground the note in THIS)
    {{ project }}

    {{ ctx.output_format }}
  "#
}
