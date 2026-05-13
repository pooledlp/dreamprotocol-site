const customerReviews = [
  {
    company: "Podium",
    label: "Customer Messaging",
    logo: "/public/logos/customers/podium.svg",
    quote: "DreamProtocol made customer response workflows feel faster, cleaner, and more consistent."
  },
  {
    company: "Dialpad",
    label: "Voice AI Workflows",
    logo: "/public/logos/customers/dialpad.svg",
    quote: "The AI receptionist experience was smooth, professional, and easy to deploy."
  },
  {
    company: "PandaDoc",
    label: "Document Workflows",
    logo: "/public/logos/customers/pandadoc.svg",
    quote: "DreamProtocol helped simplify workflows that previously required multiple tools."
  },
  {
    company: "Atera",
    label: "IT Operations",
    logo: "/public/logos/customers/atera.svg",
    quote: "We immediately saw operational improvements through workflow automation."
  }
];

function renderLogoMark(item, className) {
  return `
    <img src="${item.logo}" alt="${item.company} logo" class="${className} opacity-70 transition-opacity duration-200 group-hover:opacity-100" loading="lazy" onerror="this.classList.add('hidden'); this.nextElementSibling.classList.remove('hidden');">
    <span class="hidden text-sm font-semibold tracking-wide text-gray-100 opacity-90">${item.company}</span>
  `;
}

function renderStars(company) {
  return Array.from({ length: 5 }, () => `
    <svg class="h-4 w-4 text-blue-200 drop-shadow-[0_0_10px_rgba(147,178,255,.55)]" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" focusable="false">
      <path d="M10 1.8l2.35 4.76 5.25.76-3.8 3.7.9 5.23L10 13.78l-4.7 2.47.9-5.23-3.8-3.7 5.25-.76L10 1.8z"></path>
    </svg>
  `).join("") + `<span class="sr-only">5 out of 5 star review from ${company}</span>`;
}

function ReviewsSection(reviews) {
  const logoRow = reviews.map((item) => `
    <li class="customer-logo-tile group flex min-h-[82px] items-center justify-center rounded-2xl border border-white/10 bg-white/[.045] px-8 py-5 shadow-[0_0_34px_rgba(91,140,255,.08)]">
      ${renderLogoMark(item, "customer-logo")}
    </li>
  `).join("");

  const cards = reviews.map((item) => `
    <article class="review-card glass rounded-3xl p-6 md:p-7">
      <div class="relative z-10 flex h-full flex-col">
        <div class="flex items-center justify-between gap-4">
          <div class="flex items-center gap-1" aria-label="5 out of 5 star review">${renderStars(item.company)}</div>
          <div class="inline-flex items-center gap-1.5 rounded-full border border-blue-200/20 bg-blue-300/10 px-3 py-1 text-[.68rem] font-semibold uppercase tracking-[.16em] text-blue-100">
            <svg class="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" focusable="false"><path fill-rule="evenodd" d="M16.7 5.3a1 1 0 010 1.4l-7.25 7.25a1 1 0 01-1.4 0L3.3 9.2a1 1 0 111.4-1.4l4.05 4.04L15.3 5.3a1 1 0 011.4 0z" clip-rule="evenodd"></path></svg>
            Verified
          </div>
        </div>
        <p class="mt-8 text-lg leading-relaxed text-gray-100">“${item.quote}”</p>
        <div class="mt-auto pt-8 border-t border-white/10">
          <h3 class="text-xl font-bold text-white">${item.company}</h3>
          <p class="mt-1 text-sm text-blue-100/75">${item.label}</p>
        </div>
      </div>
    </article>
  `).join("");

  return `
    <section id="reviews" class="reviews-shell py-24 px-6" aria-labelledby="reviews-heading">
      <div class="relative z-10 max-w-7xl mx-auto">
        <div class="mx-auto max-w-4xl text-center">
          <p class="reveal text-blue-300 uppercase tracking-widest text-sm mb-4">TRUSTED BY MODERN TEAMS</p>
          <h2 id="reviews-heading" class="reveal text-4xl md:text-6xl font-black leading-tight">Built for teams. Trusted by forward thinkers.</h2>
          <p class="reveal mt-6 text-lg md:text-xl text-gray-300 leading-relaxed">AI workflows that help businesses answer faster, follow up smarter, and keep operations moving.</p>
        </div>

        <ul class="mt-12 flex gap-4 overflow-x-auto pb-3 md:grid md:grid-cols-4 md:overflow-visible md:pb-0" aria-label="Customer logos">
          ${logoRow}
        </ul>

        <div class="mt-12 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          ${cards}
        </div>

        <div class="mt-12 text-center">
          <p class="text-2xl md:text-3xl font-black">Ready to automate your front desk?</p>
          <a href="mailto:pooledlp@gmail.com?subject=15-Minute%20DreamProtocol%20Build%20Call" aria-label="Book a DreamProtocol demo" class="mt-6 inline-flex justify-center bg-white text-black px-8 py-4 rounded-full font-bold hover:scale-105 transition">Book a Demo</a>
        </div>
      </div>
    </section>
  `;
}

const reviewsMount = document.getElementById("reviews-section");
if (reviewsMount) reviewsMount.innerHTML = ReviewsSection(customerReviews);
