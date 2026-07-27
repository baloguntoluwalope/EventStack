import {
  Injectable,
  Inject,
  BadRequestException,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Types } from 'mongoose';

// Use 'import type' for interfaces used in decorated signatures
import type { IMembershipRepository } from './interfaces/membership-repository.interface';
import { MEMBERSHIP_REPOSITORY } from './interfaces/membership-repository.interface';

import type { IEmailProvider } from '../../../common/providers/email-provider.interface';
import { EMAIL_PROVIDER } from '../../../common/providers/email-provider.interface';

import { OrganizationsService } from '../organizations/organizations.service';
import { InviteMemberDto } from './dto/invite-member.dto';
import { MembershipStatus } from './schemas/membership.schema';
import { assertFound, assertDeleted } from '../../../common/utils/assert-found.util';
import { renderInvitationEmail } from 'src/modules/identity/email/templates/invitation-email.template';

interface InviteJwtPayload {
  membershipId: string;
  purpose: string;
}

@Injectable()
export class MembersService {
  private readonly logger = new Logger(MembersService.name);

  constructor(
    @Inject(MEMBERSHIP_REPOSITORY) private readonly membershipRepo: IMembershipRepository,
    @Inject(EMAIL_PROVIDER) private readonly emailProvider: IEmailProvider,
    private readonly orgService: OrganizationsService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  async invite(organizationId: string, invitedBy: string, dto: InviteMemberDto) {
    const org = await this.orgService.findByIdOrThrow(organizationId);

    const membership = await this.membershipRepo.create({
      organizationId: new Types.ObjectId(org.id),
      invitedEmail: dto.email,
      role: dto.role,
      invitedBy: new Types.ObjectId(invitedBy),
      status: MembershipStatus.PENDING,
    });

    const inviteToken = this.jwtService.sign(
      { membershipId: membership.id, purpose: 'invite' },
      {
        secret: this.config.get<string>('jwt.accessSecret'),
        expiresIn: '7d',
      },
    );

    try {
      const appUrl = this.config.get<string>('appUrl', 'https://eventstack.pxxl.run');
      const acceptUrl = `${appUrl}/invitations/${inviteToken}/accept`;

      await this.emailProvider.send(
        dto.email,
        `You've been invited to ${org.name} on EventStack`,
        renderInvitationEmail(org.name, acceptUrl, appUrl),
      );
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      this.logger.error(`Failed to send invitation email to ${dto.email}: ${errorMessage}`);
    }

    return membership;
  }

  async acceptInvite(token: string, userId: string) {
    let payload: InviteJwtPayload;

    try {
      payload = this.jwtService.verify<InviteJwtPayload>(token, {
        secret: this.config.get<string>('jwt.accessSecret'),
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired invitation token');
    }

    if (payload.purpose !== 'invite') {
      throw new BadRequestException('Invalid token purpose');
    }

    return assertFound(
      await this.membershipRepo.updateById(payload.membershipId, {
        userId: new Types.ObjectId(userId) as any,
        status: MembershipStatus.ACCEPTED,
      }),
      'Invitation no longer exists',
    );
  }

  /** Used by TenantContextGuard on every tenant-scoped request. */
  findByOrgAndUser(organizationId: string, userId: string) {
    return this.membershipRepo.findByOrgAndUser(organizationId, userId);
  }

  list(organizationId: string) {
    return this.membershipRepo.findManyForTenant(organizationId);
  }

  async changeRole(organizationId: string, membershipId: string, role: string) {
    return assertFound(
      await this.membershipRepo.updateById(membershipId, { role } as any),
      'Membership not found',
    );
  }

  async remove(membershipId: string) {
    return assertDeleted(
      await this.membershipRepo.deleteById(membershipId),
      'Membership not found',
    );
  }

  findForUser(userId: string) {
    return this.membershipRepo.findByUser(userId);
  }
}