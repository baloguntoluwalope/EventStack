/**
 * Seed content for "50th Golden Jubilee & Kingdom Advancement Summit".
 * Run via: npx ts-node scripts/seed-event.ts scripts/seed-data/church-anniversary.ts
 *
 * Visual styling (navy/emerald/gold, glassmorphism, 12px radii) is a Theme
 * concern in your app (ThemesController), not section content — assign a
 * matching theme to this event separately once it's created. This file only
 * seeds the actual copy/data each section needs.
 */

export const event = {
  title: '50th Golden Jubilee & Kingdom Advancement Summit',
  category: 'church',
  slug: 'golden-jubilee-kingdom-advancement-summit',
};

export const sections: { type: string; content: Record<string, unknown> }[] = [
  {
    type: 'hero',
    content: {
      title: '50th Golden Jubilee & Kingdom Advancement Summit',
      subtitle: 'Fifty years of faithfulness. One weekend to celebrate it together.',
      backgroundImage: 'https://images.unsplash.com/photo-1438032005730-c779502df39b',
      ctaLabel: 'RSVP / Get Free Ticket',
      ctaUrl: '#rsvp',
      secondaryCtaLabel: 'Watch Online',
      secondaryCtaUrl: '#livestream',
    },
  },
  {
    type: 'countdown',
    content: {
      label: 'Counting down to our Golden Jubilee',
      targetDate: '2026-11-08T09:00',
    },
  },
  {
    type: 'about',
    content: {
      heading: 'Our Legacy & Vision',
      body: 'Fifty years ago, a handful of families gathered in a rented hall with nothing but faith and a vision. Today, that same vision has grown into a congregation spanning three generations. This Jubilee isn\u2019t a look backward — it\u2019s a recommitment to the next fifty years of kingdom advancement, discipleship, and community impact.',
      image: 'https://images.unsplash.com/photo-1438232992991-995b7058bbb3',
    },
  },
  {
    type: 'programme',
    content: {
      heading: 'Programme & Schedule',
      items: [
        { time: '9:00 AM', title: 'Morning Service', description: 'A service of thanksgiving led by the Jubilee choir and founding members.', location: 'Main Sanctuary' },
        { time: '11:30 AM', title: 'Keynote Session', description: 'Kingdom Advancement in the Next 50 Years — a message from our keynote speaker.', location: 'Main Sanctuary' },
        { time: '1:00 PM', title: 'Youth Workshop', description: 'A dedicated track for teens and young adults on faith in a digital age.', location: 'Youth Hall' },
        { time: '6:00 PM', title: 'Evening Gala', description: 'A celebratory dinner, tribute video, and closing worship.', location: 'Fellowship Hall' },
      ],
    },
  },
  {
    type: 'speakers',
    content: {
      heading: 'Guest Ministers & Speakers',
      items: [
        { name: 'Bishop Emmanuel Adeyinka', role: 'Presiding Bishop, Kingdom Life Assembly', photoUrl: 'https://images.unsplash.com/photo-1560250097-0b93528c311a', bio: 'Over three decades of ministry across West Africa, known for his teaching on generational faith.' },
        { name: 'Pastor Grace Nwachukwu', role: 'Founder, Grace & Truth Ministries', photoUrl: 'https://images.unsplash.com/photo-1580489944761-15a19d654956', bio: 'A voice for women in ministry and community development across Lagos and Abuja.' },
        { name: 'Rev. Dr. Samuel Okafor', role: 'Senior Pastor, Redeemed Family Church', photoUrl: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e', bio: 'Theologian and author focused on church leadership and succession.' },
        { name: 'Evangelist Ruth Bello', role: 'Director, Kingdom Youth Network', photoUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2', bio: 'Leads a network of youth ministries reaching over 40 congregations nationwide.' },
      ],
    },
  },
  {
    type: 'venue',
    content: {
      name: 'Grace Community Church — Main Campus',
      address: '214 Maple Grove Road, Ikorodu, Lagos',
      parkingInfo: 'Free parking is available on-site in the north and south lots, with overflow parking at the adjacent community center.',
      transitInfo: 'Bus routes 14 and 22 stop directly outside the main gate. Rideshare drop-off is at the front entrance.',
      mapUrl: 'https://maps.google.com/?q=214+Maple+Grove+Road+Ikorodu+Lagos',
      image: 'https://images.unsplash.com/photo-1507692049790-de58290a4334',
    },
  },
  {
    type: 'donation',
    content: {
      heading: 'Partner & Support the Anniversary',
      description: 'Fifty years of ministry has been sustained by generosity. As we celebrate, we invite you to partner with the next chapter of kingdom advancement.',
      goalAmount: 50000,
      currency: 'USD',
      donateUrl: '#give',
      presetAmounts: [{ amount: 50 }, { amount: 100 }, { amount: 500 }],
      bankName: 'GTBank',
      accountName: 'Grace Community Church Anniversary Fund',
      accountNumber: '0123456789',
    },
  },
  {
    type: 'faq',
    content: {
      heading: 'Frequently Asked Questions',
      items: [
        { question: 'Is there a dress code?', answer: 'Smart casual for the day services; formal attire is welcomed for the Evening Gala.' },
        { question: 'Is childcare provided?', answer: 'Yes — supervised childcare is available for ages 0–10 throughout all sessions.' },
        { question: 'Is parking available?', answer: 'Yes, free on-site parking is available with overflow parking nearby.' },
        { question: 'Will the event be livestreamed?', answer: 'Yes — every session will be streamed live and available to watch afterward.' },
      ],
    },
  },
  {
    type: 'footer',
    content: {
      text: 'Grace Community Church — celebrating 50 years of faithfulness.',
      socialLinks: [
        { platform: 'Instagram', url: 'https://instagram.com/gracecommunitychurch' },
        { platform: 'YouTube', url: 'https://youtube.com/@gracecommunitychurch' },
        { platform: 'Facebook', url: 'https://facebook.com/gracecommunitychurch' },
      ],
    },
  },
];