import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Organization, OrganizationSchema } from './schemas/organization.schema';
import { MongooseOrganizationRepository } from './repositories/organization.repository';
import { ORGANIZATION_REPOSITORY } from './interfaces/organization-repository.interface';
import { OrganizationsService } from './organizations.service';
import { OrganizationsController } from './organizations.controller';
import { MembersModule } from '../members/members.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Organization.name, schema: OrganizationSchema }]),
    forwardRef(() => MembersModule),
  ],
  providers: [
    { provide: ORGANIZATION_REPOSITORY, useClass: MongooseOrganizationRepository },
    OrganizationsService,
  ],
  controllers: [OrganizationsController],
  exports: [ORGANIZATION_REPOSITORY, OrganizationsService],
})
export class OrganizationsModule {}