import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { ITemplateRepository, TEMPLATE_REPOSITORY } from '../modules/events/templates/interfaces/template-repository.interface';

async function run() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  const templateRepo = app.get<ITemplateRepository>(TEMPLATE_REPOSITORY);

  const all = await templateRepo.findMany({});
  for (const t of all) {
    await templateRepo.deleteById(t.id);
    console.log(`Deleted: ${t.name}`);
  }
  console.log(`\nCleared ${all.length} template(s). Run npm run seed:templates next.`);
  await app.close();
}
run();