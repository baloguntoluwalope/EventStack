import mongoose from 'mongoose';

async function updatePulse12Sections() {
  await mongoose.connect('mongodb+srv://baloguntoluwalope76:XFCW_t2xabR3t4-@godgrace.hxxm0.mongodb.net/eventstack?retryWrites=true&appName=GodGrace');
  const db = mongoose.connection.db!;

  const result = await db.collection('templates').updateOne(
    { slug: 'pulse' },
    {
      $set: {
        name: 'Pulse',
        category: 'conference',
        description: 'A comprehensive 12-section layout for modern conferences, summits, and tech events.',
        previewImageUrl: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=800&q=80',
        isPremium: false,
        active: true,
        defaultPages: [
          {
            title: 'Home',
            slug: '',
            isHome: true,
            sections: [
              {
                type: 'hero',
                order: 0,
                key: 'hero-0',
                content: {
                  title: 'Ideas Worth Building',
                  subtitle: 'Two days with the people building what’s next.',
                  backgroundImage: 'https://images.unsplash.com/photo-1505373877841-8d25f7d46678?w=1600&q=80',
                  ctaLabel: 'Get Your Ticket',
                  ctaUrl: '#register',
                  secondaryCtaLabel: 'Watch Livestream',
                  secondaryCtaUrl: '#livestream'
                }
              },
              {
                type: 'about',
                order: 1,
                key: 'about-1',
                content: {
                  heading: 'Why This Matters',
                  body: 'No keynote fluff, no vendor pitches — just the case studies, postmortems, and roadmaps the best teams actually use.',
                  image: 'https://images.unsplash.com/photo-1540317580384-e5d43616b9aa?w=1200&q=80'
                }
              },
              {
                type: 'countdown',
                order: 2,
                key: 'countdown-2',
                content: { label: 'Doors open in' }
              },
              {
                type: 'speakers',
                order: 3,
                key: 'speakers-3',
                content: {
                  heading: 'Featured Speakers',
                  items: [
                    { name: 'Dr. Jane Doe', role: 'AI Lead, TechCorp', image: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&q=80' },
                    { name: 'John Smith', role: 'Principal Architect', image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&q=80' }
                  ]
                }
              },
              {
                type: 'programme',
                order: 4,
                key: 'programme-4',
                content: {
                  heading: 'Conference Agenda',
                  items: [
                    { time: '9:00 AM', title: 'Opening Keynote', description: 'Welcome and vision setting.', location: 'Main Stage' },
                    { time: '11:00 AM', title: 'Deep Dive Tracks', description: 'Technical sessions.', location: 'Track A & B' },
                    { time: '1:00 PM', title: 'Lunch & Networking', description: 'Connect with peers.', location: 'Atrium' }
                  ]
                }
              },
              {
                type: 'sponsors',
                order: 5,
                key: 'sponsors-5',
                content: {
                  heading: 'Our Partners & Sponsors',
                  items: [
                    { name: 'CloudScale', logo: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=200&q=80' },
                    { name: 'DataFlow', logo: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=200&q=80' }
                  ]
                }
              },
              {
                type: 'pricing',
                order: 6,
                key: 'pricing-6',
                content: {
                  heading: 'Ticket Options',
                  items: [
                    { title: 'Early Bird', price: '$199', features: ['Full access', 'Lunch included'] },
                    { title: 'VIP Pass', price: '$499', features: ['All access', 'VIP lounge', 'After-party'] }
                  ]
                }
              },
              {
                type: 'faq',
                order: 7,
                key: 'faq-7',
                content: {
                  heading: 'Frequently Asked Questions',
                  items: [
                    { question: 'Is parking available?', answer: 'Yes, free parking at the main venue.' },
                    { question: 'Will recordings be available?', answer: 'All ticket holders get lifetime access to recordings.' }
                  ]
                }
              },
              {
                type: 'venue',
                order: 8,
                key: 'venue-8',
                content: {
                  heading: 'Venue & Location',
                  description: 'Tech Convention Center, Silicon District, 4th Avenue.',
                  mapUrl: 'https://maps.google.com'
                }
              },
              {
                type: 'gallery',
                order: 9,
                key: 'gallery-9',
                content: {
                  heading: 'Past Events Gallery',
                  images: [
                    'https://images.unsplash.com/photo-1511578314322-379afb476865?w=800&q=80',
                    'https://images.unsplash.com/photo-1475721027785-f74eccf877e2?w=800&q=80'
                  ]
                }
              },
              {
                type: 'contact',
                order: 10,
                key: 'contact-10',
                content: {
                  email: 'hello@pulseconf.io',
                  phone: '+1 (555) 019-2834',
                  address: 'Convention Center, Tech District'
                }
              },
              {
                type: 'footer',
                order: 11,
                key: 'footer-11',
                content: {
                  text: 'Built by practitioners, for practitioners.',
                  socialLinks: []
                }
              }
            ]
          },
          {
            title: 'About Us',
            slug: 'about',
            isHome: false,
            sections: [
              {
                type: 'about',
                order: 0,
                key: 'about-page-hero',
                content: {
                  heading: 'About Pulse Conference',
                  body: 'Pulse brings together engineering leaders, product designers, and founders to share practical strategies.',
                  image: 'https://images.unsplash.com/photo-1515187029135-18ee286d815b?w=1200&q=80'
                }
              }
            ]
          }
        ]
      }
    }
  );

  console.log('Successfully updated Pulse template to 12 sections:', result);
  await mongoose.disconnect();
}

updatePulse12Sections();