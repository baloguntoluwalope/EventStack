import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { ISectionRepository, SECTION_REPOSITORY } from '../modules/events/sections/interfaces/section-repository.interface';
import { hashContent } from '../common/utils/content-hash.util';

/**
 * One-time: for every section that has a sourceTemplateSectionKey but no
 * sourceTemplateContentHash (created before this fix), captures its
 * CURRENT content as the baseline. From this point forward, any real
 * change to the template will be correctly detected — this script does
 * not itself flag anything as outdated, it just gives old sections a
 * starting point to compare against.
 */
async function run() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  const sectionRepo = app.get<ISectionRepository>(SECTION_REPOSITORY);

  const all = await sectionRepo.findMany({ sourceTemplateSectionKey: { $ne: null }, sourceTemplateContentHash: null } as any);
  for (const s of all) {
    await sectionRepo.updateById(s.id, { sourceTemplateContentHash: hashContent(s.content ?? {}) } as any);
    console.log(`Backfilled: ${s.id} (${s.type})`);
  }
  console.log(`\nBackfilled ${all.length} section(s).`);
  await app.close();
}
run();