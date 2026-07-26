import { Injectable, Inject } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

// Use 'import type' for interfaces used in decorated signatures
import type { IMembershipRepository } from './interfaces/membership-repository.interface';
import { MEMBERSHIP_REPOSITORY } from './interfaces/membership-repository.interface';

import type { IEmailProvider } from '../../../common/providers/email-provider.interface';
import { EMAIL_PROVIDER } from '../../../common/providers/email-provider.interface';

import { OrganizationsService } from '../organizations/organizations.service';
import { InviteMemberDto } from './dto/invite-member.dto';
import { MembershipStatus } from './schemas/membership.schema';
import { assertFound, assertDeleted } from '../../../common/utils/assert-found.util';

@Injectable()
export class MembersService {
  constructor(
    @Inject(MEMBERSHIP_REPOSITORY) private membershipRepo: IMembershipRepository,
    @Inject(EMAIL_PROVIDER) private emailProvider: IEmailProvider,
    private orgService: OrganizationsService,
    private jwtService: JwtService,
    private config: ConfigService,
  ) {}

  async invite(organizationId: string, invitedBy: string, dto: InviteMemberDto) {
    const org = await this.orgService.findByIdOrThrow(organizationId);

    const membership = await this.membershipRepo.create({
      organizationId: org.id,
      invitedEmail: dto.email,
      role: dto.role,
      invitedBy: invitedBy as any,
      status: MembershipStatus.PENDING,
    });

    const inviteToken = this.jwtService.sign(
      { membershipId: membership.id, purpose: 'invite' },
      { secret: this.config.get('jwt.accessSecret'), expiresIn: '7d' },
    );

    try {
      const link = `${this.config.get('appUrl')}/invitations/${inviteToken}/accept`;
      await this.emailProvider.send(
        dto.email,
        `You've been invited to ${org.name} on EventStack`,
        `<p>You've been invited to join <strong>${org.name}</strong>.</p><a href="${link}">Accept Invitation</a>`,
      );
    } catch {
      // Non-blocking
    }
    return membership;
  }

  async acceptInvite(token: string, userId: string) {
    let payload: any;
    try {
      payload = this.jwtService.verify(token, { secret: this.config.get('jwt.accessSecret') });
    } catch {
      throw new Error('Invalid or expired invitation');
    }
    if (payload.purpose !== 'invite') throw new Error('Invalid invitation');

    return assertFound(
      await this.membershipRepo.updateById(payload.membershipId, {
        userId: userId as any,
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
    return assertDeleted(await this.membershipRepo.deleteById(membershipId), 'Membership not found');
  }
}