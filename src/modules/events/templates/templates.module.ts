import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Template, TemplateSchema } from './schemas/template.schema';
import { MongooseTemplateRepository } from './repositories/template.repository';
import { TEMPLATE_REPOSITORY } from './interfaces/template-repository.interface';
import { TemplatesService } from './templates.service';
import { TemplatesController } from './templates.controller';
import { AuthModule } from '../../identity/auth/auth.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Template.name, schema: TemplateSchema }]),
    AuthModule,
  ],
  providers: [
    { provide: TEMPLATE_REPOSITORY, useClass: MongooseTemplateRepository },
    TemplatesService,
  ],
  controllers: [TemplatesController],
  exports: [TemplatesService],
})
export class TemplatesModule {}