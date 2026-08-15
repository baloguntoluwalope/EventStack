/**
 * Seed content for a professional conference event.
 * Run via: npx ts-node scripts/seed-event.ts scripts/seed-data/conference.ts
 *
 * Visual styling is a Theme concern in your app (ThemesController), not
 * section content — assign a matching theme once the event is created.
 * This file only seeds the copy/data each section needs.
 */

export const event = {
  title: 'Meridian Summit 2026',
  category: 'conference',
  slug: 'meridian-summit-2026',
};

export const sections: { type: string; content: Record<string, unknown> }[] = [
  {
    type: 'hero',
    content: {
      title: 'Meridian Summit 2026',
      subtitle: 'Where infrastructure teams compare notes that actually ship.',
      backgroundImage: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87',
      ctaLabel: 'Get Your Ticket',
      ctaUrl: '#register',
      secondaryCtaLabel: 'Watch Livestream',
      secondaryCtaUrl: '#livestream',
    },
  },
  {
    type: 'countdown',
    content: {
      label: 'Counting down to Meridian Summit',
      targetDate: '2026-03-12T09:00',
    },
  },
  {
    type: 'about',
    content: {
      heading: 'Why This Conference',
      body: 'Meridian Summit brings together engineering and product leaders who build the systems everyone else depends on. Two days, no vendor pitches — just the case studies, postmortems, and roadmaps teams actually use.',
      image: 'https://images.unsplash.com/photo-1505373877841-8d25f7d46678',
    },
  },
  {
    type: 'programme',
    content: {
      heading: 'Day One Agenda',
      items: [
        { time: '9:00 AM', title: 'Scaling state without losing your mind', description: 'A deep dive into distributed state management at scale.', location: 'Hall A' },
        { time: '10:15 AM', title: 'Pricing infrastructure like a product', description: 'How to think about internal tooling as a product with real users.', location: 'Hall B' },
        { time: '11:30 AM', title: 'On-call culture that doesn\u2019t burn people out', description: 'Rebuilding on-call rotations around sustainability, not heroics.', location: 'Hall A' },
        { time: '1:30 PM', title: 'The database migration nobody wanted to own', description: 'A live postmortem of a migration that took eighteen months.', location: 'Hall B' },
      ],
    },
  },
  {
    type: 'speakers',
    content: {
      heading: 'Keynote Speakers',
      items: [
        { name: 'Tobi Balogun', role: 'Staff Engineer, Paystack', photoUrl: 'https://images.unsplash.com/photo-1568602471122-7832951cc4c5', bio: 'Leads platform infrastructure across Paystack\u2019s payment rails.' },
        { name: 'Wale Adeyemi', role: 'VP Product, Flutterwave', photoUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e', bio: 'Ships developer-facing products used across 30+ countries.' },
        { name: 'Ngozi Umeh', role: 'Engineering Manager, Andela', photoUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330', bio: 'Focused on healthy on-call culture and distributed team practices.' },
        { name: 'Femi Okoro', role: 'Principal Engineer, Interswitch', photoUrl: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7', bio: 'Twelve years building high-throughput financial systems.' },
      ],
    },
  },
  {
    type: 'sponsors',
    content: {
      heading: 'Our Sponsors',
      items: [
        { name: 'Paystack', logoUrl: 'https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7', url: 'https://paystack.com' },
        { name: 'Flutterwave', logoUrl: 'https://images.unsplash.com/photo-1611162616305-c69b3fa7fbe0', url: 'https://flutterwave.com' },
        { name: 'Interswitch', logoUrl: 'https://images.unsplash.com/photo-1611162617263-4ec3060a058e', url: 'https://interswitchgroup.com' },
      ],
    },
  },
  {
    type: 'venue',
    content: {
      name: 'Eko Convention Centre',
      address: 'Plot 1415 Adetokunbo Ademola Street, Victoria Island, Lagos',
      parkingInfo: 'Valet and self-park are both available on-site; validated parking included with your badge.',
      transitInfo: 'A free shuttle runs from Victoria Island bus terminal every 20 minutes on both conference days.',
      mapUrl: 'https://maps.google.com/?q=Eko+Convention+Centre+Lagos',
      image: 'https://images.unsplash.com/photo-1540317580384-e5d43616b9aa',
    },
  },
  {
    type: 'faq',
    content: {
      heading: 'Frequently Asked Questions',
      items: [
        { question: 'What does my ticket include?', answer: 'Full access to both days, all sessions, meals, and the networking reception.' },
        { question: 'Is there a refund policy?', answer: 'Full refunds are available up to 30 days before the event; transfers are always free.' },
        { question: 'Will sessions be recorded?', answer: 'Yes — all recordings are available to registered attendees within a week after the event.' },
        { question: 'Is there a dress code?', answer: 'Business casual is standard; there is no formal dress requirement.' },
      ],
    },
  },
  {
    type: 'footer',
    content: {
      text: 'Meridian Summit — infrastructure conversations that ship.',
      socialLinks: [
        { platform: 'X', url: 'https://x.com/meridiansummit' },
        { platform: 'LinkedIn', url: 'https://linkedin.com/company/meridiansummit' },
      ],
    },
  },
];