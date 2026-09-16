# ADR-0056 — Why now: two changed conditions; MV3 is a why-possible and distraction abundance is a why-ever

- **Date:** 2026-09-15
- **Status:** Accepted
- **Context:** The owner's working hypothesis was that the moment is right because instant gratification is everywhere "and its going to get worse." That argues the market exists; it does not argue that this is the moment, because it has been true and worsening since roughly 2012. A why-now must name something that **changed** and made the solution newly possible or newly necessary. An earlier draft of this decision listed three conditions; one of them does not survive the same test it was applied with.
- **Decision:** **Two changed conditions.** Both are cited as why-nows; neither of the other two is, in any document, deck or page.

  | # | Condition | Why it qualifies |
  |---|---|---|
  | 1 | **AI chat collapsed the work surface into the distraction surface.** For a browser-native worker, `chatgpt.com` is simultaneously the tool they build with and the rabbit hole they fall into. The window title is identical in both cases, so no OS-level observer can separate them — only *what the person said they would do* separates them | New (2023→2026), structural, and the sole reason a browser-native product beats an OS-level one. **Our own database is the evidence: `chatgpt.com` is 24 of 62 recorded attention-minutes — 38.7%** |
  | 2 | **Inference became cheap enough to judge one tab against one sentence.** Verified 2026-09-11: one batched on-demand analysis across ~10 sessions ≈ 2,700 input / 800 output tokens — **$0.0067 on Haiku 4.5, $0.0134 on Sonnet 5, $0.0335 on Opus 5**; at eight analyses a month that is 0.45%–2.2% of a $12 subscription against M9's 15% budget | Turns "is this drift?" from unanswerable into sub-cent. The second-order effect matters more: **on-demand rather than per-session frequency buys frontier-model quality for the one thing that is the product** |
  | — | ~~MV3 runtime-mutable blocking~~ | **Demoted to a *why-possible*.** True since 2024. Two years is not a window. It removes the reason this had to be a desktop app; it does not date the opportunity |
  | — | ~~Distraction is abundant and worsening~~ | **Why-ever.** Retained as market context, never cited as timing |

- **Consequences:**
  - Condition 1 is also the positioning line — it is why *"every AI accountability product asks whether you were focused; this one is inside the tab and already knows"* is true rather than clever. **That claim was last verified 2026-08-28 and is the single most perishable asset in the strategy.**
  - Condition 2 is why the judge moved off per-session onto on-demand (ADR-0060).
  - The window is not closing on a clock: any incumbent could ship an extension and none has, because each would have to abandon the layer its product is built on. The nearer threat is the 2026 voice-agent cohort bolting one on — months, not years — which is why the defensible asset is accumulated personal observation, not the judge.
- **Source:** owner statement 2026-09-14; IDEA §3; model pricing verified 2026-09-11; attention figures re-queried 2026-09-14
