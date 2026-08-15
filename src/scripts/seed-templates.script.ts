import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { ITemplateRepository, TEMPLATE_REPOSITORY } from '../modules/events/templates/interfaces/template-repository.interface';
import { IThemeRepository, THEME_REPOSITORY } from '../modules/events/themes/interfaces/theme-repository.interface';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Template, TemplateDocument } from '../modules/events/templates/schemas/template.schema';

async function run() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  const templateRepo = app.get<ITemplateRepository>(TEMPLATE_REPOSITORY);
  const themeRepo = app.get<IThemeRepository>(THEME_REPOSITORY);

  // Direct model access for a true hard delete — Template has a unique index
  // on `slug`, and a soft delete (deletedAt set, doc still present) would
  // block recreating 'grace'/'pulse'/'harvest' with the same slug.
  const templateModel = app.get<Model<TemplateDocument>>(getModelToken(Template.name));

  try {
    const { deletedCount } = await templateModel.deleteMany({});
    console.log(`✓ Removed ${deletedCount} existing template(s)`);

    await templateRepo.create({
      name: 'Grace',
      slug: 'grace',
      category: 'church',
      description: 'A warm, ceremonial layout for church services, anniversaries, and religious gatherings.',
      previewImageUrl: 'https://images.unsplash.com/photo-1438032005730-c779502df39b?w=800&q=80',
      isPremium: false,
      active: true,
      defaultSections: [
        {
          type: 'hero', order: 0,
          defaultContent: {
            title: 'Gather. Celebrate. Remember.',
            subtitle: 'An invitation to a day set apart — worship, fellowship, and thanksgiving together.',
            backgroundImage: 'https://images.unsplash.com/photo-1438232992991-995b7058bbb3?w=1600&q=80',
            ctaLabel: 'RSVP Now',
            ctaUrl: '#rsvp',
            secondaryCtaLabel: 'Watch Online',
            secondaryCtaUrl: '#livestream',
          },
        },
        {
          type: 'about', order: 1,
          defaultContent: {
            heading: 'Our Story',
            body: 'Every gathering carries a story worth telling — of faith kept, community built, and grace given freely. This page is the beginning of yours.',
            image: 'https://images.unsplash.com/photo-1507692049790-de58290a4334?w=1200&q=80',
          },
        },
        { type: 'countdown', order: 2, defaultContent: { label: 'Counting down together' } },
        {
          type: 'programme', order: 3,
          defaultContent: {
            heading: 'Order of the Day',
            items: [
              { time: '9:00 AM', title: 'Welcome & Worship', description: 'Doors open with music and fellowship.', location: 'Main Sanctuary' },
              { time: '10:00 AM', title: 'The Message', description: 'A word for the season we’re in.', location: 'Main Sanctuary' },
              { time: '12:00 PM', title: 'Fellowship Meal', description: 'A shared table, open to all.', location: 'Fellowship Hall' },
            ],
          },
        },
        { type: 'speakers', order: 4, defaultContent: { heading: 'Our Speakers', items: [] } },
        { type: 'committee', order: 5, defaultContent: { heading: 'Planning Team', items: [] } },
        { type: 'gallery', order: 6, defaultContent: { heading: 'Moments Worth Keeping', images: [] } },
        {
          type: 'donation', order: 7,
          defaultContent: {
            heading: 'Sow Into This Season',
            description: 'Your generosity carries this ministry forward long after the last song is sung.',
            currency: 'USD',
            presetAmounts: [{ amount: 25 }, { amount: 50 }, { amount: 100 }, { amount: 250 }],
            bankAccounts: [{ bankName: '', accountName: '', accountNumber: '' }],
          },
        },
        {
          type: 'faq', order: 8,
          defaultContent: {
            heading: 'Good to Know',
            items: [
              { question: 'What should I wear?', answer: 'Come as you are — this is a place for everyone.' },
              { question: 'Is childcare available?', answer: 'Yes, supervised care is provided throughout.' },
            ],
          },
        },
        { type: 'footer', order: 9, defaultContent: { text: 'A gathering of faith, family, and thanksgiving.', socialLinks: [] } },
      ],
    } as any);
    console.log('✓ Created template: Grace');

    await templateRepo.create({
      name: 'Pulse',
      slug: 'pulse',
      category: 'conference',
      description: 'A bold, modern layout for conferences, summits, and corporate events.',
      previewImageUrl: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=800&q=80',
      isPremium: false,
      active: true,
      defaultSections: [
        {
          type: 'hero', order: 0,
          defaultContent: {
            title: 'Ideas Worth Building',
            subtitle: 'Two days with the people building what’s next.',
            backgroundImage: 'https://images.unsplash.com/photo-1505373877841-8d25f7d46678?w=1600&q=80',
            ctaLabel: 'Get Your Ticket',
            ctaUrl: '#register',
            secondaryCtaLabel: 'Watch Livestream',
            secondaryCtaUrl: '#livestream',
          },
        },
        {
          type: 'about', order: 1,
          defaultContent: {
            heading: 'Why This Matters',
            body: 'No keynote fluff, no vendor pitches — just the case studies, postmortems, and roadmaps the best teams actually use.',
            image: 'https://images.unsplash.com/photo-1540317580384-e5d43616b9aa?w=1200&q=80',
          },
        },
        { type: 'countdown', order: 2, defaultContent: { label: 'Doors open in' } },
        { type: 'speakers', order: 3, defaultContent: { heading: 'Speakers', items: [] } },
        {
          type: 'programme', order: 4,
          defaultContent: {
            heading: 'Agenda',
            items: [
              { time: '9:00 AM', title: 'Opening Keynote', description: '', location: 'Main Stage' },
              { time: '11:00 AM', title: 'Breakout Sessions', description: '', location: 'Track A & B' },
              { time: '1:00 PM', title: 'Lunch & Networking', description: '', location: 'Atrium' },
            ],
          },
        },
        { type: 'sponsors', order: 5, defaultContent: { heading: 'Backed By', items: [] } },
        { type: 'gallery', order: 6, defaultContent: { heading: 'Last Year in Photos', images: [] } },
        { type: 'venue', order: 7, defaultContent: { name: '', address: '', parkingInfo: '', transitInfo: '', mapUrl: '', image: '' } },
        { type: 'contact', order: 8, defaultContent: { email: '', phone: '', address: '' } },
        {
          type: 'faq', order: 9,
          defaultContent: {
            heading: 'Questions, Answered',
            items: [
              { question: 'What’s included in my ticket?', answer: 'Full access to every session, meals, and the networking reception.' },
              { question: 'Can I get a refund?', answer: 'Yes, up to 30 days before the event.' },
            ],
          },
        },
        { type: 'footer', order: 10, defaultContent: { text: 'Built by practitioners, for practitioners.', socialLinks: [] } },
      ],
    } as any);
    console.log('✓ Created template: Pulse');

    await templateRepo.create({
      name: 'Harvest',
      slug: 'harvest',
      category: 'church',
      description: 'A structured layout for church anniversaries and harvest/thanksgiving services — event details, giving, and a full leadership directory.',
      previewImageUrl: 'https://images.unsplash.com/photo-1445451757144-8e2e4f11cc44?w=800&q=80',
      isPremium: false,
      active: true,
      defaultSections: [
        {
          type: 'hero', order: 0,
          defaultContent: {
            title: 'Celebrating Every Season of Grace',
            subtitle: 'Join us as we look back in gratitude and forward in faith.',
            backgroundImage: 'https://images.unsplash.com/photo-1438232992991-995b7058bbb3?w=1600&q=80',
            ctaLabel: 'RSVP Now',
            ctaUrl: '#rsvp',
            secondaryCtaLabel: 'Watch Online',
            secondaryCtaUrl: '#livestream',
          },
        },
        {
          type: 'about', order: 1,
          defaultContent: {
            heading: 'About Our Event',
            body: 'Join us as we celebrate another year of God’s faithfulness in our church family. Expect inspiring worship, heartwarming fellowship, and a joyful look back at all we’ve come through together.',
            image: 'https://images.unsplash.com/photo-1507692049790-de58290a4334?w=1200&q=80',
          },
        },
        { type: 'countdown', order: 2, defaultContent: { label: 'Time left until the celebration' } },
        {
          type: 'eventDetails', order: 3,
          defaultContent: {
            eventName: 'Your Anniversary Service',
            venue: 'Church Auditorium',
            address: '',
            description: 'A short description of what this day means to your congregation and what guests can expect.',
            mapUrl: '',
          },
        },
        {
          type: 'donation', order: 4,
          defaultContent: {
            heading: 'Support Our Cause',
            description: 'Your generous contributions enable us to continue hosting impactful events and expanding our community initiatives. Thank you for partnering with us!',
            currency: 'NGN',
            presetAmounts: [{ amount: 5000 }, { amount: 10000 }, { amount: 20000 }],
            bankAccounts: [
              { bankName: '', accountName: '', accountNumber: '' },
              { bankName: '', accountName: '', accountNumber: '' },
            ],
          },
        },
        {
          type: 'quotes', order: 5,
          defaultContent: {
            heading: 'Words of Inspiration',
            items: [
              { text: 'Every man according as he purposeth in his heart, so let him give; not grudgingly, or of necessity: for God loveth a cheerful giver.', reference: '2 Corinthians 9:7 (KJV)' },
              { text: 'Honour the LORD with thy substance, and with the firstfruits of all thine increase: So shall thy barns be filled with plenty, and thy presses shall burst out with new wine.', reference: 'Proverbs 3:9-10 (KJV)' },
              { text: 'Give, and it shall be given unto you; good measure, pressed down, and shaken together, and running over, shall men give into your bosom.', reference: 'Luke 6:38 (KJV)' },
            ],
          },
        },
        {
          type: 'faq', order: 6,
          defaultContent: {
            heading: 'Frequently Asked Questions',
            items: [
              { question: 'What is the primary goal of this event?', answer: 'Describe what this celebration means for your congregation.' },
              { question: 'Who should attend this event?', answer: 'Everyone is welcome — members, family, and friends alike.' },
              { question: 'Are there any prerequisites to attend?', answer: 'None — just come as you are.' },
              { question: 'Are children allowed to attend?', answer: 'Yes, all ages are welcome.' },
              { question: 'When does the event start?', answer: 'See the event details above for the exact time.' },
            ],
          },
        },
        {
          type: 'committee', order: 7,
          defaultContent: {
            heading: 'Meet Our Team',
            items: [
              { name: '', role: 'Shepherd-In-Charge', photoUrl: '' },
              { name: '', role: 'Event Chairman', photoUrl: '' },
              { name: '', role: 'Event Secretary', photoUrl: '' },
            ],
          },
        },
        { type: 'contact', order: 8, defaultContent: { email: '', phone: '', address: '' } },
        { type: 'footer', order: 9, defaultContent: { text: 'Your church name here. All rights reserved.', socialLinks: [] } },
      ],
    } as any);
    console.log('✓ Created template: Harvest');

    await themeRepo.create({
      name: 'Warm Sunrise',
      slug: 'warm-sunrise',
      isPremium: false,
      active: true,
      tokens: {
        primaryColor: '#b45309', secondaryColor: '#78716c', backgroundColor: '#fffbeb',
        fontFamily: 'Georgia, serif', fontScale: 1.0, radius: '12px', spacing: '20px', shadow: 'sm',
      },
    } as any);
    console.log('✓ Created theme: Warm Sunrise (pairs with Grace)');

    await themeRepo.create({
      name: 'Modern Slate',
      slug: 'modern-slate',
      isPremium: false,
      active: true,
      tokens: {
        primaryColor: '#4f46e5', secondaryColor: '#64748b', backgroundColor: '#ffffff',
        fontFamily: 'Inter, sans-serif', fontScale: 1.0, radius: '8px', spacing: '16px', shadow: 'md',
      },
    } as any);
    console.log('✓ Created theme: Modern Slate (pairs with Pulse)');

    await themeRepo.create({
      name: 'Golden Harvest',
      slug: 'golden-harvest',
      isPremium: false,
      active: true,
      tokens: {
        primaryColor: '#7A1F2B', secondaryColor: '#C9A227', backgroundColor: '#FFFDF7',
        fontFamily: 'Georgia, serif', fontScale: 1.0, radius: '12px', spacing: '20px', shadow: 'sm',
      },
    } as any);
    console.log('✓ Created theme: Golden Harvest (pairs with Harvest)');

    console.log('\nSeed complete.');
  } catch (err: any) {
    if (err.code === 11000) {
      console.log('One or more items already exist (duplicate slug) — that’s fine, re-run is safe for themes.');
    } else {
      throw err;
    }
  } finally {
    await app.close();
  }
}

run().catch((err) => {
  console.error('Seed failed:', err.message);
  process.exit(1);
});