import { NestFactory } from '@nestjs/core';
import { AppModule } from 'src/app.module';
import { EventsService } from 'src/modules/events/events.service';
import { SectionsService } from 'src/modules/events/sections/sections.service';
import * as path from 'path';
import { pathToFileURL } from 'url';

/**
 * Seeds one event + all its sections through your real NestJS services
 * (not a raw repository write, not HTTP) — same pattern as your Templates
 * and Themes seed script. Runs EventsService.create() so slug resolution
 * and any future business logic there still applies, then creates each
 * section via SectionsService.create() and locks in order via .reorder().
 *
 * Usage:
 *   ORG_ID=<orgId> npx ts-node -r tsconfig-paths/register scripts/seed-event.ts scripts/seed-data-church-anniversary.ts
 *
 * CREATED_BY (optional): user id events are attributed to.
 *   Defaults to the existing dev test account if not set.
 */

const ORG_ID = process.env.ORG_ID;
const CREATED_BY = process.env.CREATED_BY ?? '6a689b9cce9b5d972f6553fe';

async function run() {
  const dataPath = process.argv[2];
  if (!dataPath) {
    console.error('Usage: npx ts-node scripts/seed-event.ts <path-to-seed-data-file>');
    process.exit(1);
  }
  if (!ORG_ID) {
    console.error('Missing ORG_ID environment variable.');
    process.exit(1);
  }

  const { event, sections } = await import(pathToFileURL(path.resolve(dataPath)).href);

  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  const eventsService = app.get(EventsService);
  const sectionsService = app.get(SectionsService);

  try {
    console.log(`Creating event "${event.title}"...`);
    const createdEvent = await eventsService.create(ORG_ID, CREATED_BY, event);
    const eventId = (createdEvent as any).id ?? (createdEvent as any)._id;
    console.log(`  -> created event ${eventId}`);

    const createdSectionIds: string[] = [];
    for (const section of sections) {
      console.log(`Creating section "${section.type}"...`);
      const created = await sectionsService.create(ORG_ID, eventId, section as any);
      const sectionId = (created as any).id ?? (created as any)._id;
      if (!sectionId) throw new Error(`Section "${section.type}" was created but returned no id.`);
      createdSectionIds.push(sectionId);
    }

    console.log('Locking in section order...');
    await sectionsService.reorder(ORG_ID, eventId, createdSectionIds);

    console.log(`\n✓ Seed complete. Event id: ${eventId}`);
    console.log(`Edit it at: /dashboard/${ORG_ID}/events/${eventId}`);
  } catch (err: any) {
    if (err.code === 11000) {
      console.log('An event with this slug already exists — seed likely already ran.');
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