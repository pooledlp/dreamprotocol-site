// Published starting points are sourced from content/services.mjs.
// These are separate services, not an undisclosed bundle or automatic checkout.
export const monthlyPlans = [
  {
    slug:'ai-front-desk', name:'AI Receptionist', stage:'01 / ANSWER', price:'$399', unit:'/ month from',
    setup:'One-location setup from $995',
    summary:'Answer routine calls, capture new inquiries and route the right next step when your staff are busy.',
    includes:['Approved business knowledge and call flows','Defined intake fields and staff routing','Routine and difficult-call testing'],
    boundary:'Minutes, transfers, recording rules, integrations and extra locations are scoped and quoted before launch.',
    source:'monthly-receptionist'
  },
  {
    slug:'ai-lead-engine', name:'AI Lead Follow-up', stage:'02 / FOLLOW THROUGH', price:'$499', unit:'/ month from',
    setup:'Setup from $1,500 for one lead source and one follow-up path',
    summary:'Respond to new inquiries promptly, ask qualifying questions and route the lead to the right person.',
    includes:['One agreed inbound lead source','Approved follow-up sequence','Qualification and handoff rules'],
    boundary:'CRM, email, SMS and scheduling connections depend on permissions, consent, subscriptions and agreed scope.',
    source:'monthly-lead-engine'
  },
  {
    slug:'managed-ai-operations', name:'Managed AI Operations', stage:'03 / KEEP IMPROVING', price:'$750', unit:'/ month from',
    setup:'For businesses with existing AI workflows; onboarding quoted separately',
    summary:'Review and tune a working AI system instead of leaving it unattended as the business changes.',
    includes:['Monthly workflow review','Up to four hours of support or improvements in the published scope','Usage, knowledge and exception checks'],
    boundary:'Third-party usage, licenses and changes beyond the agreed allowance are quoted separately.',
    source:'monthly-managed-ops'
  }
];
