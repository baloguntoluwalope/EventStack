import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { JwtModule } from '@nestjs/jwt';
import { Membership, MembershipSchema } from './schemas/membership.schema';
import { MongooseMembershipRepository } from './repositories/membership.repository';
import { MEMBERSHIP_REPOSITORY } from './interfaces/membership-repository.interface';
import { MembersService } from './members.service';
import { MembersController } from './members.controller';
import { TenantContextGuard } from './guards/tenant-context.guard';
import { EmailModule } from '../../identity/email/email.module';
import { OrganizationsModule } from '../organizations/organizations.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Membership.name, schema: MembershipSchema }]),
    EmailModule,
    forwardRef(() => OrganizationsModule),
    JwtModule.register({}),
  ],
  providers: [
    { provide: MEMBERSHIP_REPOSITORY, useClass: MongooseMembershipRepository },
    MembersService,
    TenantContextGuard,
  ],
  controllers: [MembersController],
  exports: [MembersService, TenantContextGuard],
})
export class MembersModule {}