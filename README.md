# FIXX prototype (Final prototype (all 12 steps))

    npm install
    npm run check
    npm run dev

Try: switch role (Admin forces EN/ES), change language, text size and high contrast,
step the job status back and forth, "Reset demo data", jump the demo clock.

Try: `npm run test` (rules, seed, contrast, clock). The rules live in `src/core/rules/` and take their values from `src/core/config/fixx.config.ts`.

Machines live in `src/core/machines/` (job, payment, reschedule, issueCase, warranty, verification, supportChat). `send(machine, snapshot, event, now)` returns the new snapshot plus effects (notifications, timers, refunds) as data.

Try the Demo job panel: pick cash, start a job, click through the steps, then use "Jump 24 hours ahead" and watch deadlines fire and messages arrive. Services live in `src/mocks/` (runtime, notifications, payments, translation, assistant).

Switch the demo role to Customer and walk the flow: sign in (demo code is on screen), pick a service, describe the job, add a photo, send the request, pick a professional, then use the "Demo: act as the professional" box between your steps. Use the clock jumps to reach the job time and the end of the issue window.

Switch the role to Professional to verify a new professional (choose "New professional"), see a job request, send an adjusted quote, then run the job. Use the chat on both sides; set the app language to Korean as the customer and Spanish as the professional to see translations.

Try cash or SPEI: pick it in the quote, read the deadlines on the payment screen, then use the clock jumps to let the deposit or balance deadline pass, or use "mark this payment as received". Choose an urgent request to see the 3-hour window, or "Outside Apodaca" for manual review.

Try: as the customer, cancel before and after the professional is on the way; request a new time and answer it as the professional (or jump 12 hours); use the demo panel to make the professional cancel or not show, then pick a replacement; as the professional, request additional work during a job.

Try: finish a job, then during the issue window open "Report an issue", pick items, and use the "Demo: act as an Agent" box to decide the case; ask for a review as the customer and as the professional; then see the warranty tab and file a claim.

Switch the role to Admin (English or Spanish) to see the console; open the Help tab as a customer or professional and talk to the Assistant, ask for an Agent, then switch to Support to join the chat and use the macros.

## Final checklist

    npm install
    npm run check
    npm run dev

Open the demo control panel at the bottom: pick a scenario, press "Start scenario" (it runs to a meaningful point and hands over), or "Finish it for me". See ACCEPTANCE.md for how each acceptance criterion is checked and what still needs a human.
