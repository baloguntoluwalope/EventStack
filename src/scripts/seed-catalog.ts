// src/modules/scripts/seed-catalog.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from 'src/app.module';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';

interface ITheme {
  name: string;
  slug: string;
  category: string;
  colors: Record<string, string>;
  fontFamily: string;
  borderRadius: string;
  isPremium: boolean;
  active: boolean;
}

interface ITemplate {
  name: string;
  slug: string;
  category: string;
  description: string;
  previewUrl: string;
  defaultSections: Array<{
    type: string;
    order: number;
    defaultContent: Record<string, any>;
  }>;
  active: boolean;
}

async function bootstrap() {
  console.log('[Seed] Starting Catalog (Templates/Themes) seed process...');

  const app = await NestFactory.createApplicationContext(AppModule);

  const themeModel = app.get<Model<ITheme>>(getModelToken('Theme'));
  const templateModel = app.get<Model<ITemplate>>(getModelToken('Template'));

  // --- THEMES DEFINITION ---
  const themes: Partial<ITheme>[] = [
    {
      name: 'Emerald Heritage',
      slug: 'emerald-heritage',
      category: 'Religious',
      colors: {
        primary: '#10B981',
        background: '#FFFFFF',
        surface: '#F8FAFC',
        text: '#0F172A',
        muted: '#64748B',
        accent: '#D4AF37',
        border: '#E2E8F0',
      },
      fontFamily: 'Inter, sans-serif',
      borderRadius: '0.75rem',
      isPremium: false,
      active: true,
    },
    {
      name: 'Midnight Slate',
      slug: 'midnight-slate',
      category: 'Technology',
      colors: {
        primary: '#3B82F6',
        background: '#0F172A',
        surface: '#1E293B',
        text: '#F8FAFC',
        muted: '#94A3B8',
        accent: '#22D3EE',
        border: '#334155',
      },
      fontFamily: 'Roboto Mono, monospace',
      borderRadius: '0.375rem',
      isPremium: false,
      active: true,
    },
  ];

  // --- TEMPLATE SECTIONS (Matching Exact Reference Structure) ---

  const graceDefaultSections = [
    {
      type: 'hero',
      order: 0,
      defaultContent: {
        title: 'Your Event Title Here',
        subtitle: 'A short line under the title',
        ctaLabel: 'RSVP / Get Free Ticket',
        ctaUrl: '#rsvp',
        secondaryCtaLabel: 'Watch Online',
        secondaryCtaUrl: '#livestream',
      },
    },
    {
      type: 'about',
      order: 1,
      defaultContent: {
        heading: 'Our Legacy & Vision',
        body: 'Tell the story of your church and the vision behind this gathering.',
      },
    },
    {
      type: 'countdown',
      order: 2,
      defaultContent: { label: 'Counting down to the big day' },
    },
    {
      type: 'programme',
      order: 3,
      defaultContent: {
        heading: 'Order of the Day',
        items: [
          { time: '9:00 AM', title: 'Morning Service', description: '', location: 'Main Sanctuary' },
        ],
      },
    },
    {
      type: 'speakers',
      order: 4,
      defaultContent: { heading: 'Guest Ministers & Speakers', items: [] },
    },
    {
      type: 'gallery',
      order: 5,
      defaultContent: { heading: 'Gallery', images: [] },
    },
    {
      type: 'donation',
      order: 6,
      defaultContent: {
        heading: 'Partner & Support This Event',
        currency: 'USD',
        presetAmounts: [{ amount: 50 }, { amount: 100 }, { amount: 500 }],
      },
    },
    {
      type: 'footer',
      order: 7,
      defaultContent: { text: 'Your church name here.', socialLinks: [] },
    },
  ];

  const pulseDefaultSections = [
    {
      type: 'hero',
      order: 0,
      defaultContent: {
        title: 'Your Conference Name Here',
        subtitle: 'A short line under the title',
        ctaLabel: 'Get Your Ticket',
        ctaUrl: '#register',
        secondaryCtaLabel: 'Watch Livestream',
        secondaryCtaUrl: '#livestream',
      },
    },
    {
      type: 'about',
      order: 1,
      defaultContent: { heading: 'Why This Conference', body: 'Describe what makes this event worth attending.' },
    },
    {
      type: 'countdown',
      order: 2,
      defaultContent: { label: 'Counting down to the summit' },
    },
    {
      type: 'speakers',
      order: 3,
      defaultContent: { heading: 'Keynote Speakers', items: [] },
    },
    {
      type: 'programme',
      order: 4,
      defaultContent: { heading: 'Day One Agenda', items: [] },
    },
    {
      type: 'sponsors',
      order: 5,
      defaultContent: { heading: 'Our Sponsors', items: [] },
    },
    {
      type: 'gallery',
      order: 6,
      defaultContent: { heading: 'Gallery', images: [] },
    },
    {
      type: 'contact',
      order: 7,
      defaultContent: { email: '', phone: '', address: '' },
    },
    {
      type: 'footer',
      order: 8,
      defaultContent: { text: 'Your conference name here.', socialLinks: [] },
    },
  ];

  const templates: Partial<ITemplate>[] = [
    {
      name: 'Grace (Church Anniversary)',
      slug: 'grace',
      category: 'Religious',
      description: 'Elegant template for church milestones and anniversaries.',
      previewUrl: '/previews/grace.png',
      active: true,
      defaultSections: graceDefaultSections,
    },
    {
      name: 'Pulse (Tech Conference)',
      slug: 'pulse',
      category: 'Technology',
      description: 'Modern, high-energy template for summits and conferences.',
      previewUrl: '/previews/pulse.png',
      active: true,
      defaultSections: pulseDefaultSections,
    },
  ];

  // --- SEED EXECUTION WITH UPSERT ---

  console.log('[Seed] Upserting Themes...');
  for (const theme of themes) {
    try {
      await themeModel.findOneAndUpdate(
        { slug: theme.slug },
        theme,
        { upsert: true, new: true, runValidators: true }
      );
      console.log(` [+] Theme processed: ${theme.slug}`);
    } catch (err: any) {
      console.error(` [!] Error processing theme ${theme.slug}:`, err?.message || err);
    }
  }

  console.log('[Seed] Upserting Templates...');
  for (const template of templates) {
    try {
      await templateModel.findOneAndUpdate(
        { slug: template.slug },
        template,
        { upsert: true, new: true, runValidators: true }
      );
      console.log(` [+] Template processed: ${template.slug}`);
    } catch (err: any) {
      console.error(` [!] Error processing template ${template.slug}:`, err?.message || err);
    }
  }

  console.log('[Seed] Catalog seeding completed successfully!');
  await app.close();
}

bootstrap().catch((err) => {
  console.error('[Seed] Fatal error during catalog seed process:', err);
  process.exit(1);
});