# ADR-0055 — The canonical problem statement, with falsifiers

- **Date:** 2026-09-15
- **Status:** Accepted
- **Context:** The problem was stated correctly but differently in IDEA §2, PRD §1 and `PRODUCT.md`, and the owner's working version stacked six claims of unequal weight with no primary. A symptom list cannot be argued with, tested, or put on a landing page.
- **Decision:** One primary cause, everything else as consequence. This wording is canonical; IDEA §2 and PRD §1 conform.

  > **Your work surface and your distraction surface are the same browser — so nothing you own can tell you whether the block you just spent produced the thing it was for.**
  >
  > Not the calendar: it records that you booked the hour, never that the hour delivered. Not the timer: it counts elapsed minutes, which you already knew. Not the blocker: it cannot tell Instagram-the-job from Instagram-the-escape, so you either break your work or you do not block it. Not your own memory: the fifteen minutes that vanished are the fifteen you did not notice.
  >
  > The cost is not the lost time. It is that tomorrow gets planned on **feelings instead of evidence**, so the same task slips again — and for someone self-employed, the slippage is unbilled.

  **Falsifiers — a statement that cannot be wrong is a mood:**

  | # | If observed, the statement is wrong |
  |---|---|
  | **P-F1** | Target users, asked at the end of a block with no tool, can already say accurately what they did and whether it moved → this is a *motivation* problem, not an *information* one, and the product is aimed wrong |
  | **P-F2** | Drift plus away is small — under ~15% — for target users → the loss is not where we say it is. *(Our n=1 shows 50.2% away. One person, 37 minutes.)* |
  | **P-F3** | Users answer "did you finish it?" reliably and nothing about the next day changes → the consequence chain breaks and the ledger is a diary |

  **P-F3 is the one to watch:** it is the only falsifier our own six sessions could already be failing, and it has never been checked.

- **Decision, second part — "they don't know the problem exists" is a distribution fact, not a wedge.** That the loss is often invisible to the person losing it is true, and it is the product's strongest *retention* argument: the first review showing someone half a session in `away` is the moment the problem becomes visible. **It cannot be the acquisition argument.** Someone who does not suspect a problem does not search for a focus tool and does not install an extension. **The wedge is the person who already suspects; the unaware population is the expansion market, reached through the aware one.**
- **Consequences:** The landing page sells to suspicion, never to ignorance. "We will show you a problem you did not know you had" is a second-session promise and belongs in the review, not in acquisition copy.
- **Source:** owner statement and decision 2026-09-14/15; IDEA §2, PRD §1, §1.2
