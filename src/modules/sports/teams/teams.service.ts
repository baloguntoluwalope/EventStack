import {
  BadRequestException,
  Injectable,
  Inject,
} from '@nestjs/common';

import { Types } from 'mongoose';

import {
  ITeamRepository,
  TEAM_REPOSITORY,
} from './interfaces/team-repository.interface';

import {
  ITeamRegistrationRepository,
  TEAM_REGISTRATION_REPOSITORY,
} from './interfaces/team-registration-repository.interface';

import {
  assertDeleted,
  assertFound,
} from '../../../common/utils/assert-found.util';

import { CreateTeamDto } from './dto/create-team.dto';
import { RegisterTeamDto } from './dto/register-team.dto';

@Injectable()
export class TeamsService {
  constructor(
    @Inject(TEAM_REPOSITORY)
    private readonly teamRepo: ITeamRepository,

    @Inject(TEAM_REGISTRATION_REPOSITORY)
    private readonly registrationRepo: ITeamRegistrationRepository,
  ) {}

  // =========================================================
  // CREATE ORGANIZATION TEAM
  // =========================================================

  async create(
    organizationId: string,
    dto: CreateTeamDto,
  ) {
    if (!organizationId) {
      throw new BadRequestException(
        'Organization ID is required.',
      );
    }

    if (!Types.ObjectId.isValid(organizationId)) {
      throw new BadRequestException(
        'Invalid organization ID.',
      );
    }

    const {
      tournamentId,
      ...teamData
    } = dto;

    if (
      tournamentId &&
      !Types.ObjectId.isValid(tournamentId)
    ) {
      throw new BadRequestException(
        'Invalid tournament ID.',
      );
    }

    const team =
      await this.teamRepo.create({
        ...teamData,

        organizationId:
          new Types.ObjectId(
            organizationId,
          ) as any,
      });

    const teamId =
      this.getId(team);

    if (!teamId) {
      throw new BadRequestException(
        'Team was created but no team ID was returned.',
      );
    }

    if (tournamentId) {
      await this.registerCreatedTeamForTournament(
        organizationId,
        tournamentId,
        teamId,
      );
    }

    return team;
  }

  // =========================================================
  // AUTOMATIC REGISTRATION AFTER TEAM CREATION
  // =========================================================

  private async registerCreatedTeamForTournament(
    organizationId: string,
    tournamentId: string,
    teamId: string,
  ) {
    const existingRegistrations =
      await this.registrationRepo.findByTournamentForTenant(
        tournamentId,
        organizationId,
      );

    const alreadyRegistered =
      existingRegistrations.some(
        (registration: any) =>
          this.getReferencedId(
            registration.teamId,
          ) === String(teamId),
      );

    if (alreadyRegistered) {
      return;
    }

    if (
      !Types.ObjectId.isValid(organizationId) ||
      !Types.ObjectId.isValid(tournamentId) ||
      !Types.ObjectId.isValid(teamId)
    ) {
      throw new BadRequestException(
        'Invalid organization, tournament, or team ID.',
      );
    }

    const registration =
      await this.registrationRepo.create({
        organizationId:
          new Types.ObjectId(
            organizationId,
          ) as any,

        tournamentId:
          new Types.ObjectId(
            tournamentId,
          ) as any,

        teamId:
          new Types.ObjectId(
            teamId,
          ) as any,

        groupId: null,

        status: 'registered' as any,
      });

    console.log(
      '[TeamsService] CREATED REGISTRATION',
      {
        id: String(registration._id),

        organizationId:
          String(
            registration.organizationId,
          ),

        tournamentId:
          String(
            registration.tournamentId,
          ),

        teamId:
          String(registration.teamId),

        groupId:
          registration.groupId
            ? String(registration.groupId)
            : null,

        status:
          registration.status,

        deletedAt:
          registration.deletedAt,
      },
    );

    return registration;
  }

  // =========================================================
  // LIST ORGANIZATION TEAMS
  // =========================================================

  async list(
    organizationId: string,
  ) {
    return this.teamRepo.findManyForTenant(
      organizationId,
    );
  }

  // =========================================================
  // GET SINGLE TEAM
  // =========================================================

  async findByIdOrThrow(
    teamId: string,
    organizationId: string,
  ) {
    if (!teamId) {
      throw new BadRequestException(
        'Team ID is required.',
      );
    }

    return assertFound(
      await this.teamRepo.findByIdForTenant(
        teamId,
        organizationId,
      ),
      'Team not found',
    );
  }

  // =========================================================
  // UPDATE TEAM
  // =========================================================

  async update(
    organizationId: string,
    teamId: string,
    data: Record<string, any>,
  ) {
    await this.findByIdOrThrow(
      teamId,
      organizationId,
    );

    const {
      _id,
      id,
      organizationId: ignoredOrganizationId,
      deletedAt,
      createdAt,
      updatedAt,
      version,
      ...safeData
    } = data;

    return assertFound(
      await this.teamRepo.updateById(
        teamId,
        safeData,
      ),
      'Team not found',
    );
  }

  // =========================================================
  // REGISTER EXISTING TEAM FOR TOURNAMENT
  // =========================================================

  async registerForTournament(
    organizationId: string,
    tournamentId: string,
    dto: RegisterTeamDto,
  ) {
    if (!tournamentId) {
      throw new BadRequestException(
        'Tournament ID is required.',
      );
    }

    if (
      !Types.ObjectId.isValid(
        tournamentId,
      )
    ) {
      throw new BadRequestException(
        'Invalid tournament ID.',
      );
    }

    if (!dto?.teamId) {
      throw new BadRequestException(
        'Team ID is required.',
      );
    }

    if (
      !Types.ObjectId.isValid(
        dto.teamId,
      )
    ) {
      throw new BadRequestException(
        'Invalid team ID.',
      );
    }

    await this.findByIdOrThrow(
      dto.teamId,
      organizationId,
    );

    const registrations =
      await this.registrationRepo.findByTournamentForTenant(
        tournamentId,
        organizationId,
      );

    const alreadyRegistered =
      registrations.some(
        (registration: any) =>
          this.getReferencedId(
            registration.teamId,
          ) === String(dto.teamId),
      );

    if (alreadyRegistered) {
      throw new BadRequestException(
        'Team is already registered for this tournament.',
      );
    }

    const groupId =
      this.toObjectIdOrNull(
        dto.groupId,
        'groupId',
      );

    const registration =
      await this.registrationRepo.create({
        organizationId:
          new Types.ObjectId(
            organizationId,
          ) as any,

        tournamentId:
          new Types.ObjectId(
            tournamentId,
          ) as any,

        teamId:
          new Types.ObjectId(
            dto.teamId,
          ) as any,

        groupId,

        status: 'registered' as any,
      });

    console.log(
      '[TeamsService] REGISTERED EXISTING TEAM',
      {
        id: String(registration._id),

        organizationId:
          String(
            registration.organizationId,
          ),

        tournamentId:
          String(
            registration.tournamentId,
          ),

        teamId:
          String(registration.teamId),

        status:
          registration.status,

        deletedAt:
          registration.deletedAt,
      },
    );

    return registration;
  }

  // =========================================================
  // LIST RAW TOURNAMENT REGISTRATIONS
  // =========================================================

  async listRegistrations(
    organizationId: string,
    tournamentId: string,
  ) {
    if (
      !organizationId ||
      !tournamentId
    ) {
      return [];
    }

    return this.registrationRepo.findByTournamentForTenant(
      tournamentId,
      organizationId,
    );
  }

  // =========================================================
  // LIST REGISTERED TEAMS
  // =========================================================
  //
  // IMPORTANT:
  // This remains the tenant/internal method.
  //
  // Signature:
  //   organizationId
  //   tournamentId
  //
  // Do NOT use this directly from public controllers.
  //

  async listForTournament(
    organizationId: string,
    tournamentId: string,
  ) {
    return this.resolveRegisteredTeams(
      organizationId,
      tournamentId,
    );
  }

  // =========================================================
  // PUBLIC TOURNAMENT TEAMS
  // =========================================================
  //
  // This method deliberately uses:
  //
  //   tournamentId
  //   organizationId
  //
  // in that order.
  //
  // The public controller obtains organizationId from the
  // tournament itself, so the browser never supplies it.
  //

  async listForTournamentPublic(
    tournamentId: string,
    organizationId: string,
  ) {
    if (!tournamentId) {
      return [];
    }

    if (!organizationId) {
      return [];
    }

    if (
      !Types.ObjectId.isValid(
        tournamentId,
      )
    ) {
      return [];
    }

    if (
      !Types.ObjectId.isValid(
        organizationId,
      )
    ) {
      return [];
    }

    return this.resolveRegisteredTeams(
      organizationId,
      tournamentId,
    );
  }

  // =========================================================
  // SHARED REGISTERED TEAM RESOLVER
  // =========================================================

  private async resolveRegisteredTeams(
    organizationId: string,
    tournamentId: string,
  ) {
    if (
      !organizationId ||
      !tournamentId
    ) {
      return [];
    }

    if (
      !Types.ObjectId.isValid(
        organizationId,
      ) ||
      !Types.ObjectId.isValid(
        tournamentId,
      )
    ) {
      return [];
    }

    const registrations =
      await this.registrationRepo.findByTournamentForTenant(
        tournamentId,
        organizationId,
      );

    console.log(
      '[TeamsService] TOURNAMENT REGISTRATIONS',
      {
        organizationId,
        tournamentId,

        count:
          registrations.length,

        registrations:
          registrations.map(
            (registration: any) => ({
              id:
                String(
                  registration._id,
                ),

              teamId:
                this.getReferencedId(
                  registration.teamId,
                ),

              tournamentId:
                this.getReferencedId(
                  registration.tournamentId,
                ),

              organizationId:
                this.getReferencedId(
                  registration.organizationId,
                ),

              status:
                registration.status,

              deletedAt:
                registration.deletedAt,
            }),
          ),
      },
    );

    if (!registrations.length) {
      return [];
    }

    const teamIds =
      registrations
        .map(
          (registration: any) =>
            this.getReferencedId(
              registration.teamId,
            ),
        )
        .filter(
          (id): id is string =>
            Boolean(id) &&
            Types.ObjectId.isValid(id),
        );

    if (!teamIds.length) {
      return [];
    }

    /*
     * Fetch organization teams first.
     *
     * Then restrict them to teams registered for this
     * tournament.
     */
    const teams =
      await this.teamRepo.findManyForTenant(
        organizationId,
      );

    const registeredIds =
      new Set(
        teamIds.map(String),
      );

    const result =
      teams.filter(
        (team: any) => {
          const teamId =
            this.getId(team);

          return (
            Boolean(teamId) &&
            registeredIds.has(
              String(teamId),
            )
          );
        },
      );

    console.log(
      '[TeamsService] TOURNAMENT TEAMS RESULT',
      {
        tournamentId,

        organizationId,

        teamIds,

        count:
          result.length,

        teams:
          result.map(
            (team: any) => ({
              id:
                this.getId(team),

              name:
                team.name,

              shortName:
                team.shortName,

              logoUrl:
                team.logoUrl,
            }),
          ),
      },
    );

    return result;
  }

  // =========================================================
  // UPDATE TOURNAMENT REGISTRATION
  // =========================================================

  async updateRegistration(
    organizationId: string,
    tournamentId: string,
    registrationId: string,
    data: {
      groupId?: string | null;
      status?: string;
    },
  ) {
    if (!tournamentId) {
      throw new BadRequestException(
        'Tournament ID is required.',
      );
    }

    if (!registrationId) {
      throw new BadRequestException(
        'Registration ID is required.',
      );
    }

    const registration =
      await this.registrationRepo.findByIdForTenant(
        registrationId,
        organizationId,
      );

    if (!registration) {
      throw new BadRequestException(
        'Registration not found.',
      );
    }

    const registrationTournamentId =
      this.getReferencedId(
        (registration as any).tournamentId,
      );

    if (
      registrationTournamentId !==
      String(tournamentId)
    ) {
      throw new BadRequestException(
        'Registration does not belong to this tournament.',
      );
    }

    const updateData:
      Record<string, any> = {};

    if (
      data.groupId !== undefined
    ) {
      updateData.groupId =
        this.toObjectIdOrNull(
          data.groupId,
          'groupId',
        );
    }

    if (
      data.status !== undefined
    ) {
      updateData.status =
        data.status;
    }

    if (
      Object.keys(updateData)
        .length === 0
    ) {
      return registration;
    }

    return assertFound(
      await this.registrationRepo.updateById(
        registrationId,
        updateData,
      ),
      'Registration not found',
    );
  }

  // =========================================================
  // WITHDRAW TEAM FROM TOURNAMENT
  // =========================================================

  async withdraw(
    organizationId: string,
    tournamentId: string,
    registrationId: string,
  ) {
    const registration =
      await this.registrationRepo.findByIdForTenant(
        registrationId,
        organizationId,
      );

    if (!registration) {
      throw new BadRequestException(
        'Registration not found.',
      );
    }

    const registrationTournamentId =
      this.getReferencedId(
        registration.tournamentId,
      );

    if (
      registrationTournamentId !==
      String(tournamentId)
    ) {
      throw new BadRequestException(
        'Registration does not belong to this tournament.',
      );
    }

    return assertDeleted(
      await this.registrationRepo.deleteByIdForTenant(
        registrationId,
        organizationId,
      ),
      'Registration not found',
    );
  }

  // =========================================================
  // ASSERT TEAM IS REGISTERED
  // =========================================================

  async assertRegistered(
    organizationId: string,
    tournamentId: string,
    teamId: string,
  ) {
    const registrations =
      await this.registrationRepo.findByTournamentForTenant(
        tournamentId,
        organizationId,
      );

    const found =
      registrations.find(
        (registration: any) =>
          this.getReferencedId(
            registration.teamId,
          ) === String(teamId),
      );

    if (!found) {
      throw new BadRequestException(
        `Team ${teamId} is not registered for this tournament.`,
      );
    }

    return found;
  }

  // =========================================================
  // DELETE ORGANIZATION TEAM
  // =========================================================

  async remove(
    organizationId: string,
    teamId: string,
  ) {
    await this.findByIdOrThrow(
      teamId,
      organizationId,
    );

    return assertDeleted(
      await this.teamRepo.deleteByIdForTenant(
        teamId,
        organizationId,
      ),
      'Team not found',
    );
  }

  // =========================================================
  // PUBLIC TEAM NAME LOOKUP
  // =========================================================

  async getPublicNamesMap(
    teamIds: string[],
  ) {
    const uniqueIds = [
      ...new Set(
        teamIds
          .filter(Boolean)
          .map(String),
      ),
    ];

    if (!uniqueIds.length) {
      return {};
    }

    const teams =
      await this.teamRepo.findNamesByIdsPublic(
        uniqueIds,
      );

    return Object.fromEntries(
      teams.map(
        (team: any) => [
          String(team.id),
          team,
        ],
      ),
    );
  }

  // =========================================================
  // HELPERS
  // =========================================================

  private getId(
    document: any,
  ): string {
    if (!document) {
      return '';
    }

    return String(
      document._id ??
        document.id ??
        '',
    );
  }

  private getReferencedId(
    value: any,
  ): string {
    if (!value) {
      return '';
    }

    if (
      typeof value === 'string' ||
      typeof value === 'number'
    ) {
      return String(value);
    }

    if (value._id) {
      return String(value._id);
    }

    if (value.id) {
      return String(value.id);
    }

    return String(value);
  }

  private toObjectIdOrNull(
    value:
      | string
      | null
      | undefined,
    fieldName: string,
  ): Types.ObjectId | null {
    if (
      value === undefined ||
      value === null ||
      value === ''
    ) {
      return null;
    }

    if (
      !Types.ObjectId.isValid(value)
    ) {
      throw new BadRequestException(
        `${fieldName} must be a valid MongoDB ObjectId.`,
      );
    }

    return new Types.ObjectId(value);
  }
}
// import {
//   Injectable,
//   Inject,
//   BadRequestException,
// } from '@nestjs/common';

// import {
//   ITeamRepository,
//   TEAM_REPOSITORY,
// } from './interfaces/team-repository.interface';

// import {
//   ITeamRegistrationRepository,
//   TEAM_REGISTRATION_REPOSITORY,
// } from './interfaces/team-registration-repository.interface';

// import {
//   assertFound,
//   assertDeleted,
// } from '../../../common/utils/assert-found.util';

// import { CreateTeamDto } from './dto/create-team.dto';
// import { RegisterTeamDto } from './dto/register-team.dto';

// @Injectable()
// export class TeamsService {
//   constructor(
//     @Inject(TEAM_REPOSITORY)
//     private readonly teamRepo: ITeamRepository,

//     @Inject(TEAM_REGISTRATION_REPOSITORY)
//     private readonly registrationRepo: ITeamRegistrationRepository,
//   ) {}

//   /**
//    * Create an organization-level team.
//    *
//    * If tournamentId is supplied, automatically
//    * register the newly-created team for that tournament.
//    */
//   async create(
//     organizationId: string,
//     dto: CreateTeamDto,
//   ) {
//     const {
//       tournamentId,
//       ...teamData
//     } = dto;

//     // -------------------------------------------------------
//     // 1. CREATE ORGANIZATION TEAM
//     // -------------------------------------------------------

//     const team = await this.teamRepo.create({
//       ...teamData,
//       organizationId: organizationId as any,
//     });

//     const teamId = String(
//       (team as any)?._id ??
//       (team as any)?.id ??
//       '',
//     );

//     if (!teamId) {
//       throw new BadRequestException(
//         'Team was created but no team ID was returned.',
//       );
//     }

//     // -------------------------------------------------------
//     // 2. REGISTER TEAM FOR TOURNAMENT
//     // -------------------------------------------------------

//     if (tournamentId) {
//       await this.registerCreatedTeamForTournament(
//         organizationId,
//         tournamentId,
//         teamId,
//       );
//     }

//     return team;
//   }

//   /**
//    * Internal registration used immediately after
//    * creating a team.
//    */
//   private async registerCreatedTeamForTournament(
//     organizationId: string,
//     tournamentId: string,
//     teamId: string,
//   ) {
//     const registrations =
//       await this.registrationRepo
//         .findByTournamentForTenant(
//           tournamentId,
//           organizationId,
//         )
//         .catch(() => []);

//     const alreadyRegistered =
//       registrations.some(
//         (registration: any) =>
//           String(
//             registration.teamId,
//           ) === teamId,
//       );

//     if (alreadyRegistered) {
//       return;
//     }

//     return this.registrationRepo.create({
//       tournamentId: tournamentId as any,
//       teamId: teamId as any,
//       groupId: null,
//       organizationId: organizationId as any,
//     });
//   }

//   /**
//    * List all organization-level teams.
//    */
//   async list(
//     organizationId: string,
//   ) {
//     return this.teamRepo.findManyForTenant(
//       organizationId,
//     );
//   }

//   /**
//    * Find a team while enforcing tenant isolation.
//    */
//   async findByIdOrThrow(
//     id: string,
//     organizationId: string,
//   ) {
//     return assertFound(
//       await this.teamRepo.findByIdForTenant(
//         id,
//         organizationId,
//       ),
//       'Team not found',
//     );
//   }

//   /**
//    * Register an existing organization team
//    * for a tournament.
//    */
//   async registerForTournament(
//     organizationId: string,
//     tournamentId: string,
//     dto: RegisterTeamDto,
//   ) {
//     await this.findByIdOrThrow(
//       dto.teamId,
//       organizationId,
//     );

//     const registrations =
//       await this.registrationRepo
//         .findByTournamentForTenant(
//           tournamentId,
//           organizationId,
//         )
//         .catch(() => []);

//     const alreadyRegistered =
//       registrations.some(
//         (registration: any) =>
//           String(
//             registration.teamId,
//           ) === String(dto.teamId),
//       );

//     if (alreadyRegistered) {
//       throw new BadRequestException(
//         'Team is already registered for this tournament',
//       );
//     }

//     return this.registrationRepo.create({
//       tournamentId: tournamentId as any,
//       teamId: dto.teamId as any,
//       groupId:
//         (dto.groupId as any) ?? null,
//       organizationId:
//         organizationId as any,
//     });
//   }

//   /**
//    * List raw registration records.
//    */
// async listForTournament(
//   organizationId: string,
//   tournamentId: string,
// ) {
//   const registrations =
//     await this.registrationRepo.findByTournamentForTenant(
//       tournamentId,
//       organizationId,
//     );

//   if (!registrations.length) {
//     return [];
//   }

//   const teamIds = registrations
//     .map((registration: any) =>
//       String(
//         registration.teamId?._id ??
//         registration.teamId?.id ??
//         registration.teamId ??
//         '',
//       ),
//     )
//     .filter(Boolean);

//   if (!teamIds.length) {
//     return [];
//   }

//   const allTeams =
//     await this.teamRepo.findManyForTenant(
//       organizationId,
//     );

//   const registeredIds = new Set(teamIds);

//   return allTeams.filter((team: any) => {
//     const id = String(
//       team._id ??
//       team.id ??
//       '',
//     );

//     return registeredIds.has(id);
//   });
// }
//   /**
//    * Update tournament registration.
//    */
//   async updateRegistration(
//     organizationId: string,
//     registrationId: string,
//     data: {
//       groupId?: string;
//       status?: string;
//     },
//   ) {
//     await assertFound(
//       await this.registrationRepo
//         .findByIdForTenant(
//           registrationId,
//           organizationId,
//         ),
//       'Registration not found',
//     );

//     return assertFound(
//       await this.registrationRepo.updateById(
//         registrationId,
//         data as any,
//       ),
//       'Registration not found',
//     );
//   }

//   /**
//    * Withdraw team registration.
//    */
//   async withdraw(
//     organizationId: string,
//     registrationId: string,
//   ) {
//     return assertDeleted(
//       await this.registrationRepo
//         .deleteByIdForTenant(
//           registrationId,
//           organizationId,
//         ),
//       'Registration not found',
//     );
//   }

//   /**
//    * Confirm team registration.
//    */
//   async assertRegistered(
//     organizationId: string,
//     tournamentId: string,
//     teamId: string,
//   ) {
//     const registrations =
//       await this.registrationRepo
//         .findByTournamentForTenant(
//           tournamentId,
//           organizationId,
//         );

//     const found =
//       registrations.find(
//         (registration: any) =>
//           String(
//             registration.teamId,
//           ) === String(teamId),
//       );

//     if (!found) {
//       throw new BadRequestException(
//         `Team ${teamId} is not registered for this tournament`,
//       );
//     }

//     return found;
//   }

//   /**
//    * Delete organization team.
//    */
//   async remove(
//     organizationId: string,
//     id: string,
//   ) {
//     await this.findByIdOrThrow(
//       id,
//       organizationId,
//     );

//     return assertDeleted(
//       await this.teamRepo.deleteByIdForTenant(
//         id,
//         organizationId,
//       ),
//       'Team not found',
//     );
//   }

//   /**
//    * Public team name lookup.
//    */
//   async getPublicNamesMap(
//     teamIds: string[],
//   ) {
//     const unique = [
//       ...new Set(teamIds),
//     ];

//     const teams =
//       await this.teamRepo
//         .findNamesByIdsPublic(
//           unique,
//         );

//     return Object.fromEntries(
//       teams.map((team: any) => [
//         team.id,
//         team,
//       ]),
//     );
//   }
// }