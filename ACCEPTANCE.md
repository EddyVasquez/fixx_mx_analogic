# Acceptance criteria: how each one is checked

Run everything with `npm run check` (i18n lint, key coverage, source lint, tests, type-check and build).

| Criterion (brief section 15) | What enforces it | Still needs a human |
|---|---|---|
| Every scenario in section 13 runs end to end in all three languages, no hard-coded text, no raw placeholders | `tests/scenarios.test.ts` runs each scenario (17 entries covering all 12) in EN, ES and KO, from the hand-over point to the end. `i18n:lint` checks matching keys, matching placeholders and balanced braces. `i18n:keys` checks every key used on screen exists. `a11y:lint` rejects hard-coded JSX text and labels | Click through each scenario once per language in the browser. Korean strings are flagged "needs native review" |
| No screen mentions commission, "dispute", "cancellation fee", or "pro" for the generic worker | `i18n:lint` bans those words in every string (the FIXX Pro level name is allowed). `a11y:lint` bans them in source strings. A test checks professional copy never shows customer totals, held amounts or refunds. The decisions panel leaves out the payout share | Admin shows customer total and professional payout side by side (decision A1); please confirm |
| Every money screen shows exact amounts and deadlines from the rules engine | `tests/rules.test.ts`, `tests/payments.test.ts`. Quote, payment, balance and cancel screens call the rules engine; cash and SPEI screens print each deadline and its consequence | Read each money screen once |
| Accessibility basics pass (contrast, keyboard, screen-reader labels, touch targets) | `tests/contrast.test.ts` (every text/background pair at 4.5:1 or more). `a11y:lint` (touch-sized buttons). Skip link, page language and title follow the app language, errors use alerts, loaders and job status are announced, magnification and high-contrast controls | Keyboard and screen-reader walk-through on a real device; run an automated audit (axe) in the browser |
| A "decisions needed" list is maintained | `DECISIONS.md`, and the same demo values appear in the demo panel under "Decisions needed" | Answer the open items |

## What has not been verified
The logic (rules, state machines, runtime, scenarios) runs in plain Node in the build environment. The React screens were type-checked against stand-in library types but have never been compiled or run in a browser. Expect small fixes on first `npm install && npm run dev`.
