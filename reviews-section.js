const workflowScenarios = [
  { label: "AI front desk example", title: "Missed Call Recovery", body: "An after-hours caller is answered, qualified by urgency, prepared for CRM handoff, and queued for text follow-up." },
  { label: "Workflow automation example", title: "Connected Admin Handoff", body: "Forms, email, voicemail, and text can trigger calendar holds, record updates, team alerts, and human approvals." },
  { label: "Managed operations example", title: "Supported After Launch", body: "Phone routing, inboxes, calendars, access, tickets, and cloud tools stay aligned as the AI workflow evolves." }
];
function renderWorkflowScenarios(items) {
  return `<div class="review-grid" aria-label="Illustrative workflow scenarios">${items.map(item => `<article class="review-card glass"><span class="placeholder">${item.label}</span><h3>${item.title}</h3><p>${item.body}</p></article>`).join("")}</div><p class="trust-note" style="text-align:center;margin-top:16px">Illustrative workflow scenarios—not customer testimonials or claimed results. Verified case studies can replace these cards when approved.</p>`;
}
const reviewsMount = document.getElementById("reviews-section");
if (reviewsMount) reviewsMount.innerHTML = renderWorkflowScenarios(workflowScenarios);
