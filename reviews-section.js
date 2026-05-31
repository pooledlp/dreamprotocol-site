const workflowScenarios = [
  {
    title: "Missed Call Recovery",
    label: "AI front desk example",
    body: "An after-hours caller gets answered, qualified, routed by urgency, added to the CRM, and followed up by text before the next business day."
  },
  {
    title: "Connected Admin Handoff",
    label: "Workflow automation example",
    body: "Form fills, emails, voicemails, and texts can trigger next steps like CRM updates, calendar holds, internal alerts, and manager approval flows."
  },
  {
    title: "Managed Systems Support",
    label: "Operations support example",
    body: "Phone routing, inboxes, calendars, user access, help desk tickets, and cloud tools stay aligned with the AI workflows your team depends on."
  }
];

function WorkflowScenariosSection(scenarios) {
  const cards = scenarios.map((item) => `
    <article class="review-card glass rounded-3xl p-6 md:p-7">
      <div class="relative z-10 flex h-full flex-col">
        <p class="inline-flex w-fit items-center rounded-full border border-blue-200/20 bg-blue-300/10 px-3 py-1 text-[.68rem] font-semibold uppercase tracking-[.16em] text-blue-100">${item.label}</p>
        <h3 class="mt-5 text-2xl font-bold text-white">${item.title}</h3>
        <p class="mt-4 text-base leading-relaxed text-gray-200">${item.body}</p>
      </div>
    </article>
  `).join("");

  return `
    <section id="reviews" class="reviews-shell py-24 px-6" aria-labelledby="reviews-heading">
      <div class="relative z-10 max-w-7xl mx-auto">
        <div class="mx-auto max-w-4xl text-center">
          <p class="reveal text-blue-300 uppercase tracking-widest text-sm mb-4">WORKFLOW EXAMPLES</p>
          <h2 id="reviews-heading" class="reveal text-4xl md:text-6xl font-black leading-tight">Where AI Automation Expands Into Real Operations</h2>
          <p class="reveal mt-6 text-lg md:text-xl text-gray-300 leading-relaxed">Start with the first customer touchpoint, then connect the work into the systems, approvals, and support processes your team already uses.</p>
        </div>

        <div class="mt-12 grid gap-5 md:grid-cols-3">
          ${cards}
        </div>

        <p class="mt-8 text-center text-xs md:text-sm text-gray-400">Example scenarios shown for illustration. Actual workflows are customized around each business.</p>

        <div class="mt-12 text-center">
          <p class="text-2xl md:text-3xl font-black">Ready to map your first AI operations workflow?</p>
          <button type="button" onclick="openAssessment()" aria-label="Book an AI Ops Audit" class="mt-6 inline-flex justify-center bg-white text-black px-8 py-4 rounded-full font-bold hover:scale-105 transition">Book an AI Ops Audit</button>
        </div>
      </div>
    </section>
  `;
}

const reviewsMount = document.getElementById("reviews-section");
if (reviewsMount) reviewsMount.innerHTML = WorkflowScenariosSection(workflowScenarios);
