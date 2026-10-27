# Decisions needed (final list)

Everything below is a demo default, not a decision. The items marked "please confirm" matter most:

1. **A1**: Admin sees the customer total and the professional payout side by side (never the commission rate or the word).
2. **G1 / C4 / M2**: where "24 hours" and "48 hours" fall, and when a job counts as scheduled on cash and SPEI.
3. **M6 / A6**: how many Quality Score points a late cancellation or no-show costs.
4. **I4**: the real case decision options and any partial amounts.
5. **P1 to P10**: levels, reschedule rules for professionals, payout account copy, itemization per category, notification timing, zones and addresses, Home Profile rights.
6. **Visual design**: the look is a greyscale placeholder; the approved design replaces `src/ui/tokens.ts`.

The full table, step by step, follows.

# Decisions needed (maintained as the build progresses)

Status: `open` = using a demo/assumed value. Every value lives in `src/core/config/fixx.config.ts`.

| ID | Item | Current demo/assumed value | Status |
|----|------|----------------------------|--------|
| D1 | Emergency surcharge | MXN 300 | open |
| D2 | Travel fee bands | same 80 / adjacent 150 / far 250 MXN | open |
| D3 | Warranty by category | 30-90 days (config per category) | open |
| D4 | Professional price limits | +/-15% of suggestion | open |
| D5 | Agent business hours | Mon-Sat 9:00-18:00 | open |
| D6 | Sign-in code rules | 10 min valid, 30 s resend, 15 min lockout | open |
| D7 | Case review deadline | 14 days after decision | open |
| D8 | Mexican holiday calendar for business days | 2026 seed list | open |
| C2 | What Admin sees about commission | net payout only, never the rate | open |
| G1 | 24h / 48h boundaries inclusive or exclusive; card payment for jobs within 24h | to be set in rules engine (step 3) | open |
| G9 | Recovery after losing a number | new number + selfie vs ID, Admin approves | open |
| C4 | Contrast | brand #4EB961 used for fills only; link/focus token #2A7D3B | decided in tokens |
| P1 | Pro/Expert requirements, loss of levels | screens only, copy TODO | open |
| P2 | Does declining/ignoring a reschedule affect Quality Score | not applied | open |
| P3 | Can professionals start a reschedule | no | open |
| P4 | Payout account (CLABE) screens/copy | screens, copy TODO | open |
| P5 | Itemization per category | generic line types | open |
| P6 | Notification timing, per-channel preferences, marketing opt-in | proposed defaults in brief | open |
| P7 | Is professional phone verification redundant with phone sign-in | kept as separate step | open |
| P8 | Zone assignment and address validation | seeded colonia-to-zone table | open |
| P9 | Home Profile editing rights and privacy | prefilled, read-only | open |
| P10 | Admin languages beyond EN/ES | none | open |

## Added in Step 2
| ID | Item | Current demo/assumed value | Status |
|----|------|----------------------------|--------|
| S1 | Seed people and places | All names, phones, emails fictional; zones and fraccionamiento are placeholders | demo |
| S2 | Real colonia-to-zone mapping (see P8) | 3 placeholder zones with adjacency | open |
| S3 | Visual design | Tokens are the Step 1 placeholder; will be restyled from the approved Claude Design look | open |
| S4 | Fonts | Named with system fallbacks, not bundled yet | open |

## Added in Step 3 (rules engine assumptions)
| ID | Item | Assumption in code | Status |
|----|------|--------------------|--------|
| G1 | 24h / 48h boundaries | more than 48h = far; 24h up to and including 48h = mid; under 24h = near. Cards use the same rules at every distance | open |
| G1b | Near tier (<24h): 3h deadline can fall after the job start (e.g. a job in 2 hours) | not capped | open |
| G1c | Mid tier (24-48h): what happens if a payment is missed | deposit missed = booking expires; balance missed = job cancelled and deposit refunded | open |
| G2 | Travel fee when less than the fee was paid (e.g. cash deposit unpaid) | capped at the amount paid | open |
| G6 | Additional-work lines in issue reports | selectable like any other line | open |
| P8 | Unknown zone pair | treated as the "far" band | open |
| R1 | CLABE validation | 18 digits only; check digit not enforced in the demo | open |
| R2 | Business days | Mon-Fri minus the 2026 holiday list; fixed UTC-6 offset | open |
| R3 | Holidays after 2026 | list must be extended | open |

## Added in Step 4 (state machines)
| ID | Item | Assumption in code | Status |
|----|------|--------------------|--------|
| M1 | Machine library | Typed pure reducer (`core/machines/machine.ts`) instead of XState; effects are returned as data | decided |
| M2 | Mid/near tier: when the job becomes `scheduled` | After the first installment is paid (`PAYMENT_SATISFIED`); for mid tier this is deposit paid | open |
| M3 | Customer cancellation: refund choice | Automatic refund (minus travel fee after "on the way"); the replacement-or-refund choice applies after professional cancel, no-show, unanswered reschedule | open |
| M4 | Reschedule declined | Customer keeps the current time (free cancel remains available) | per brief |
| M5 | Balance unpaid (cash/SPEI) | Job cancelled by FIXX, deposit refunded in full to a CLABE | per brief |
| G3 | Professional cancels after check-in | Not self-service; event is refused (Support handles it) | open |
| M6 | Quality Score penalty | Late professional cancel (after "on the way") and no-show emit a `qualityPenalty` effect; amount not set | open (P2) |
| M7 | Warranty start | Payment release, independent of rating | open (C5) |
| M8 | Case reviews | Max one per party; deadline fixed at 14 days after the first decision | open |
| M9 | Support chat out of hours | Assistant keeps the chat; follow-up notification to Support for the next support day | open |

## Added in Step 5 (mock services)
| ID | Item | Assumption in code | Status |
|----|------|--------------------|--------|
| N1 | Channels per audience | Customers and professionals: push, WhatsApp, email, in-app as each event asks. Admin and Support: in-app and email only | open (P6) |
| N2 | Numbers in notification copy | Deadlines and counts come from config (e.g. issue window hours, refund business days), never typed into strings | decided |
| N3 | Professionals and amounts | Professional copy never shows customer totals, held amounts or refunds; only their travel fee and net held share. Enforced by a test | decided |
| N4 | Notification language | Each message is shown in the recipient's language, labelled by channel and recipient | open |
| N5 | Storage | Runtime state (jobs, timers, notifications) is in memory and clears on reload; Dexie holds seed data only | open |
| N6 | Demo job panel | Event names and deadlines appear as code (developer tool), not translated | open |
| N7 | Translation | Scripted phrasebook for scenario 12; other text gets a visible `[demo xx→yy]` prefix | demo |
| N8 | Payout amount on release | total x payout ratio; how held amounts adjust a payout after a case is not modeled yet | open |
| N9 | Assistant | Keyword-based script; hands refunds, cases, payments and emergencies to an Agent | demo |

## Added in Step 6 (customer happy path)
| ID | Item | Assumption in code | Status |
|----|------|--------------------|--------|
| V1 | Visual direction | Greyscale tokens with work-order highlights (white = amounts, mid-grey = needs your OK, outline = dates, black labels); all tokens neutral, enforced by a test | placeholder |
| E1 | Estimate ranges per category | Demo ranges in config (painting 3,500-5,000 from the brief); shown with the Demo value marker | open |
| E2 | Quote lines | Generic split of the range midpoint (preparation 15%, materials 35%, labor rest, plus urgent surcharge); real itemization per category is open (P5) | open |
| E3 | Recommendation scoring | Config weights: same zone 30, nearby 15, language 25, Quality Score x0.3; top 3 (G7) | open |
| E4 | Payment methods in the flow | Card and wallet only until Step 8 adds cash and SPEI | open |
| E5 | Email capture | Required, simple format check, confirmation simulated | open |
| E6 | Time slots | Three demo slots 30, 54 and 78 hours ahead, rounded to the hour | open |
| E7 | Professional side | A "Demo: act as the professional" box drives the professional's steps until the professional app (Step 7) | demo |
| E8 | Payout share | 80% (demo), never shown to customers | open |
| E9 | Rating | 7 dimensions, all required, shown after payment release | per brief |
| E10 | Not in this step | Permission pre-prompts and consent screens, professional profile page, chat, issue report, settings | open |

## Added in Step 7 (professional happy path and chat)
| ID | Item | Assumption in code | Status |
|----|------|--------------------|--------|
| PR1 | What professionals see on a quote | Payout only. They adjust the suggested payout within the limit (+/-15%, demo); the customer's total is derived and never shown to them | decided |
| PR2 | Quote adjustment | The professional's change scales the customer's lines by the same factor; the urgent surcharge is not scaled; a reason is required when the payout changes | open |
| PR3 | Photos | Before/after photos are optional in the demo; only the checklist blocks completion | open |
| PR4 | Checklist | Generic FIXX Standard checklist for every category (4 items); category-specific lists are open (P5) | open |
| PR5 | Verification statuses | not started, pending, approved, rejected with a reason, recovery; Admin actions are shown in a demo box until the Admin app (Step 11) | demo |
| PR6 | Payout account | CLABE field with 18-digit check; copy is a labelled draft (P4) | open |
| PR7 | Availability | Weekly morning/afternoon grid, Monday to Saturday free by default; not yet used by matching | open |
| PR8 | Quality Score display | Shown from seed data; late cancellations and no-shows are counted, but how much the score drops is undecided (M6) | open |
| PR9 | Levels | Shown conceptually; Pro and Expert requirements and whether levels can be lost are open (P1) | open |
| CH1 | Chat | Sender writes in the app language; every message is translated for all three languages when sent; translated lines say so and keep the original | decided |
| CH2 | Chat translation | Scripted lines translate exactly; free text gets a visible [demo xx>yy] prefix | demo |
| CH3 | Language of notifications | Customer and professional messages follow the language each person is using the app in | open |
| CH4 | Not in this step | Reschedule requests, cancelling as a professional (with the late-cancellation warning), additional work requests, issue/case view | open |

## Added in Step 8 (cash/SPEI, urgent, out-of-area)
| ID | Item | Assumption in code | Status |
|----|------|--------------------|--------|
| C1 | Payment methods | All four are offered in the quote. Cards/wallets pay the deposit at acceptance; cash/SPEI use references with the tiered deadlines | per brief |
| C2 | Deadline basis | Deadlines are calculated from acceptance, then from the time of any accepted reschedule (stored as `scheduleBasis`) | decided |
| C3 | Job within 24 hours | The full amount is prepaid, so the balance is already settled when the job is marked complete | decided |
| C4 | Mid tier: scheduled status | The job becomes scheduled once the deposit is paid, even though both amounts are due 24h before the job (M2) | open |
| C5 | Stale deadlines | An overdue-balance timer is ignored if the balance was paid on time (bug found by the scenario 2 test) | fixed |
| C6 | Cash/SPEI references | Fake references and a made-up CLABE; "mark as received" is a demo button standing in for the store or bank | demo |
| C7 | Refund to a CLABE | Customer enters 18 digits; then the refund is marked issued with the 3-business-day expected date | open |
| C8 | Urgent slots | Two demo slots (4 and 8 hours ahead) when a request is urgent | open |
| C9 | Urgent outside Agent hours | The screen says the Assistant and automatic matching handle it and an Agent follows up next support day; matching itself is not different | open |
| C10 | Out-of-area review | The customer sees the exact follow-up deadline (24 hours from submission); Admin approve/decline are demo buttons until Step 11 | open |
| C11 | Not in this step | Customer cancel and reschedule screens, additional work approval, issue reports (Steps 9 and 10) | open |

## Added in Step 9 (cancellations, replacement, reschedule, additional work)
| ID | Item | Assumption in code | Status |
|----|------|--------------------|--------|
| B1 | Customer cancel | Allowed while awaiting the deposit, scheduled, or on the way. The screen states the exact consequence first; after "on the way" the travel fee (demo value) comes off, capped at what was paid | per brief |
| B2 | Customer cancel after check-in | Not offered (G3); Support handles it | open |
| B3 | Professional cancel | Allowed while scheduled or on the way. The warning about the Quality Score shows only after "on the way". After check-in it is not self-service | per brief |
| B4 | Replacement | The customer keeps the paid amount, sees the price difference on the new quote, and pays only the difference. If it already covers the deposit, the job schedules at once. The previous professional is not offered again | open |
| B5 | Carry-over scope | Carry-over is modeled for the deposit only; if the payment exceeds the new deposit, how the extra reduces the balance is not modeled yet | open |
| B6 | Reschedule | Customer requests a new slot before "on the way"; the professional has 12 hours; current time stays booked until acceptance; decline keeps the time; no answer expires the request and offers replacement or refund (a new request is allowed after a decline) | per brief |
| B7 | Who can start a reschedule | Customers only (P3) | open |
| B8 | Additional work | Professional enters their payout and a description; the customer sees the total and approves before work continues. Cards: added to the balance. Cash/SPEI: a reference with no deadline; the job cannot be marked complete until paid | per brief |
| B9 | Demo triggers | Professional cancels and no-show buttons in the demo panel; +12 hour clock jump for the reschedule window | demo |
| B10 | Not in this step | Issue reports, the case view and warranty claims (Step 10), Admin and Support consoles (Step 11) | open |

## Added in Step 10 (issue reports, cases, warranty, My Home)
| ID | Item | Assumption in code | Status |
|----|------|--------------------|--------|
| I1 | Issue report | Customer picks items or "The whole job" during the issue window; the held amount previews as they choose; a description is required | per brief |
| I2 | Additional work in reports | Approved additional work becomes a selectable "Additional work" line (G6) | open |
| I3 | Held amounts | Customers see the held amount; professionals see only their net held share. Held cash/SPEI amounts refund to a CLABE | per brief |
| I4 | Decisions | Three outcomes: refund the customer, release to the professional, or split 50/50. Real decision options and any partial amounts are for Admin to define (Step 11) | open |
| I5 | Settlement | On a final decision the refund is created and the professional's payout is reduced by their share of what was refunded; the job then releases payment and starts the warranty | open |
| I6 | Review rule | One review per party until the review deadline (14 days, demo); after it, or once both are used, the decision is final automatically | per brief |
| I7 | Case SLA | Shown as 5 business days with the exact date; no automatic escalation if missed | open |
| I8 | Warranty | Starts at payment release; period from config and marked as a demo value; one claim at a time; claims differ from issue reports (the screens say so) | open |
| I9 | My Home | Prefilled read-only profile (seed placeholders) and a service history built from completed jobs | open (P9) |
| I10 | Agents | A "Demo: act as an Agent" box drives cases and warranty claims until the Admin and Support consoles (Step 11) | demo |

## Added in Step 11 (Admin and Support)
| ID | Item | Assumption in code | Status |
|----|------|--------------------|--------|
| A1 | C2 updated: what Admin sees about money | Admin sees the customer total and the professional payout side by side; the word and the rate of commission never appear anywhere | open (please confirm) |
| A2 | Admin and Support languages | Both are English and Spanish only; switching to either leaves Korean. Admin strings exist in EN/ES only (the lint allows this for `admin.` keys) | per brief |
| A3 | Sections | Requests (incl. manual review), Homeowners, Professionals, Verification, Jobs, Quotes, Service standards, Cases, Warranties, Refunds, Quality Score changes, Internal notes | per brief |
| A4 | Service standards | Read-only in the demo: generic checklist, demo warranty periods and estimate ranges | open (P5) |
| A5 | Cases | Admin can set the held amount before a decision (up to the job total; the professional's net share recalculates), start the review, decide (3 outcomes), and finish a review | open (I4) |
| A6 | Quality Score | Automatic penalties are listed with no point value; Admin can record manual adjustments with a reason; the professional's score shows the sum | open (M6) |
| A7 | Internal notes | Per job, professional or homeowner; never shown to customers or professionals; cleared with the demo | per brief |
| A8 | Homeowner reliability | Shown to Admin only as a count of customer cancellations; never shown to customers | per brief |
| S1b | Support chat | Assistant first, hand-off to an Agent in Agent hours (queue) or outside them (the Assistant keeps helping, an Agent follows up next support day); every line is labelled Assistant, Agent or You | per brief |
| S2b | Agent macros | Four macros in English and Spanish, translated for Korean users with the scripted phrasebook | demo |
| S3b | Korean users | Told that Korean support uses translation tools and Agents work in English and Spanish | per brief |
| S4b | Not in this step | Admin editing of standards, config values, and real authentication | open |

## Added for the customer completion check
| ID | Item | Assumption in code | Status |
|----|------|--------------------|--------|
| CC1 | Balance release | Simulated in the job machine. Approve, or no answer, releases the balance. No escrow and no real charge | demo |
| CC2 | Deposit and balance | 20% deposit, 80% balance, from the existing deposit share | open |
| CC3 | Auto-release and reminders | 48 h, reminders at 2 / 24 / 44 h. Labels in config are placeholders | open |
| CC4 | Return visit | The professional has the first chance to fix a reported problem within 72 h | open |
| CC5 | Photo location | A fixed simulated place until a device provides one | demo |
| CC6 | Customer list | Optional. Shared core plus 2–3 items per trade, from config | open |
| CC7 | Korean copy | Draft, flagged for a native review | open |
