import { NestFactory } from '@nestjs/core';
import { AppModule } from 'src/app.module';
import { ITemplateRepository } from '../events/templates/interfaces/template-repository.interface';
import { TEMPLATE_REPOSITORY } from '../events/templates/interfaces/template-repository.interface';
import { IThemeRepository } from '../events/themes/interfaces/theme-repository.interface';
import { THEME_REPOSITORY } from '../events/themes/interfaces/theme-repository.interface';

async function run() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  const templateRepo = app.get<ITemplateRepository>(TEMPLATE_REPOSITORY);
  const themeRepo = app.get<IThemeRepository>(THEME_REPOSITORY);

  try {
    await templateRepo.create({
      name: 'Grace',
      slug: 'grace',
      category: 'church',
      description: 'Warm, ceremonial layout for church services, conventions, and religious gatherings.',
      isPremium: false,
      active: true,
      defaultSections: [
        { type: 'hero', order: 0 },
        { type: 'about', order: 1 },
        { type: 'countdown', order: 2 },
        { type: 'programme', order: 3 },
        { type: 'speakers', order: 4 },
        { type: 'gallery', order: 5 },
        { type: 'donation', order: 6 },
        { type: 'footer', order: 7 },
      ],
    } as any);
    console.log('✓ Created template: Grace');

    await templateRepo.create({
      name: 'Pulse',
      slug: 'pulse',
      category: 'conference',
      description: 'Bold, modern layout for conferences, summits, and corporate events.',
      isPremium: false,
      active: true,
      defaultSections: [
        { type: 'hero', order: 0 },
        { type: 'about', order: 1 },
        { type: 'countdown', order: 2 },
        { type: 'speakers', order: 3 },
        { type: 'programme', order: 4 },
        { type: 'sponsors', order: 5 },
        { type: 'gallery', order: 6 },
        { type: 'contact', order: 7 },
        { type: 'footer', order: 8 },
      ],
    } as any);
    console.log('✓ Created template: Pulse');

    await themeRepo.create({
      name: 'Warm Sunrise',
      slug: 'warm-sunrise',
      isPremium: false,
      active: true,
      tokens: {
        primaryColor: '#b45309',
        secondaryColor: '#78716c',
        backgroundColor: '#fffbeb',
        fontFamily: 'Georgia, serif',
        fontScale: 1.0,
        radius: '12px',
        spacing: '20px',
        shadow: 'sm',
      },
    } as any);
    console.log('✓ Created theme: Warm Sunrise (pairs with Grace)');

    await themeRepo.create({
      name: 'Modern Slate',
      slug: 'modern-slate',
      isPremium: false,
      active: true,
      tokens: {
        primaryColor: '#4f46e5',
        secondaryColor: '#64748b',
        backgroundColor: '#ffffff',
        fontFamily: 'Inter, sans-serif',
        fontScale: 1.0,
        radius: '8px',
        spacing: '16px',
        shadow: 'md',
      },
    } as any);
    console.log('✓ Created theme: Modern Slate (pairs with Pulse)');

    console.log('\nSeed complete.');
  } catch (err: any) {
    if (err.code === 11000) {
      console.log('One or more items already exist (duplicate slug) — seed likely already ran.');
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