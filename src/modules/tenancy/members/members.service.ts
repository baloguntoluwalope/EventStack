import {
  Injectable,
  Inject,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Types } from 'mongoose';
import { UsersService } from '../../identity/users/users.service';
import { renderInvitationEmail } from '../../identity/email/templates/invitation-email.template';
import { assertDeleted, assertFound } from '../../../common/utils/assert-found.util';
import { EMAIL_PROVIDER, IEmailProvider } from '../../../common/providers/email-provider.interface';
import { Role } from '../../../common/constants/roles.constants';
import type { IMembershipRepository } from './interfaces/membership-repository.interface';
import { MEMBERSHIP_REPOSITORY } from './interfaces/membership-repository.interface';
import { InviteMemberDto } from './dto/invite-member.dto';
import { MembershipStatus } from './schemas/membership.schema';
import { OrganizationsService } from '../organizations/organizations.service';

interface InviteJwtPayload {
  membershipId: string;
  purpose: string;
}

@Injectable()
export class MembersService {
  private readonly logger = new Logger(MembersService.name);

  constructor(
    @Inject(MEMBERSHIP_REPOSITORY)
    private readonly membershipRepo: IMembershipRepository,
    @Inject(EMAIL_PROVIDER)
    private readonly emailProvider: IEmailProvider,
    private readonly orgService: OrganizationsService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly usersService: UsersService,
  ) {}

  /** Called when an organization is created so its creator becomes Owner. */
  createOwnerMembership(organizationId: string, userId: string) {
    return this.membershipRepo.create({
      organizationId: new Types.ObjectId(organizationId),
      userId: new Types.ObjectId(userId),
      role: Role.OWNER,
      status: MembershipStatus.ACCEPTED,
    });
  }

  async invite(organizationId: string, invitedBy: string, dto: InviteMemberDto) {
    const org = await this.orgService.findByIdOrThrow(organizationId);
    const email = dto.email.trim().toLowerCase();
    const existing = await this.membershipRepo.findByOrgAndInvitedEmail(organizationId, email);

    if (existing) {
      if (existing.status === MembershipStatus.ACCEPTED) {
        throw new ConflictException('This person is already a member.');
      }
      await this.membershipRepo.deleteById(existing.id);
    }

    const membership = await this.membershipRepo.create({
      organizationId: new Types.ObjectId(organizationId),
      invitedEmail: email,
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
        email,
        `You've been invited to ${org.name} on EventStack`,
        renderInvitationEmail(org.name, acceptUrl, appUrl),
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      this.logger.error(`Failed to send invitation email to ${email}: ${message}`);
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

    const membership = await assertFound(
      await this.membershipRepo.findById(payload.membershipId),
      'Invitation no longer exists',
    );
    if (membership.status === MembershipStatus.ACCEPTED) {
      throw new ConflictException('This invitation has already been accepted.');
    }

    const user = await assertFound(await this.usersService.findById(userId), 'User not found');
    if (!user.emailVerified) {
      throw new ForbiddenException('Verify your email address before accepting an invitation.');
    }
    if (membership.invitedEmail && user.email.toLowerCase() !== membership.invitedEmail.toLowerCase()) {
      throw new ForbiddenException('This invitation was sent to a different email address.');
    }

    const existingMembership = await this.membershipRepo.findByOrgAndUser(
      membership.organizationId.toString(),
      userId,
    );
    if (existingMembership) {
      throw new ConflictException('You are already a member of this organization.');
    }

    return assertFound(
      await this.membershipRepo.updateById(membership.id, {
        userId: new Types.ObjectId(userId),
        status: MembershipStatus.ACCEPTED,
      }),
      'Invitation no longer exists',
    );
  }

  findByOrgAndUser(organizationId: string, userId: string) {
    return this.membershipRepo.findByOrgAndUser(organizationId, userId);
  }

  list(organizationId: string) {
    return this.membershipRepo.findManyForTenant(organizationId);
  }

  async changeRole(organizationId: string, membershipId: string, role: Role) {
    const membership = await assertFound(
      await this.membershipRepo.findByIdForTenant(membershipId, organizationId),
      'Membership not found',
    );
    if (membership.role === Role.OWNER) {
      throw new ForbiddenException("An owner's role can't be changed here.");
    }
    return assertFound(
      await this.membershipRepo.updateById(membershipId, { role }),
      'Membership not found',
    );
  }

  async remove(organizationId: string, membershipId: string) {
    const membership = await assertFound(
      await this.membershipRepo.findByIdForTenant(membershipId, organizationId),
      'Membership not found',
    );
    if (membership.role === Role.OWNER) {
      throw new ForbiddenException("An owner can't be removed.");
    }
    return assertDeleted(
      await this.membershipRepo.deleteById(membershipId),
      'Membership not found',
    );
  }

  findForUser(userId: string) {
    return this.membershipRepo.findByUser(userId);
  }
}