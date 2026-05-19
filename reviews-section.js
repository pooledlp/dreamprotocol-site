const workflowScenarios = [
  {
    title: "Missed Call Recovery",
    label: "Local service business example",
    body: "An after-hours caller gets answered, qualified, routed by urgency, added to the CRM, and followed up by text before the next business day."
  },
  {
    title: "Appointment Intake",
    label: "Healthcare or wellness example",
    body: "New inquiries are captured, basic questions are answered, appointment requests are organized, and the team gets a clean summary for approval."
  },
  {
    title: "Admin Workflow Handoff",
    label: "Operations example",
    body: "Form fills, emails, voicemails, and texts can trigger next steps like CRM updates, calendar holds, internal alerts, and manager approval flows."
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
          <h2 id="reviews-heading" class="reveal text-4xl md:text-6xl font-black leading-tight">Where the AI Front Desk Expands</h2>
          <p class="reveal mt-6 text-lg md:text-xl text-gray-300 leading-relaxed">Start with calls and follow-up. Then connect the front desk into the workflows your team handles every day.</p>
        </div>

        <div class="mt-12 grid gap-5 md:grid-cols-3">
          ${cards}
        </div>

        <p class="mt-8 text-center text-xs md:text-sm text-gray-400">Example scenarios shown for illustration. Actual workflows are customized around each business.</p>

        <div class="mt-12 text-center">
          <p class="text-2xl md:text-3xl font-black">Ready to automate your front desk?</p>
          <button type="button" onclick="openAssessment()" aria-label="See what DreamProtocol would automate for your business" class="mt-6 inline-flex justify-center bg-white text-black px-8 py-4 rounded-full font-bold hover:scale-105 transition">See What We’d Automate</button>
        </div>
      </div>
    </section>
  `;
}

const reviewsMount = document.getElementById("reviews-section");
if (reviewsMount) reviewsMount.innerHTML = WorkflowScenariosSection(workflowScenarios);
