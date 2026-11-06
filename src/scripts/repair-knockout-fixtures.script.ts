import { NestFactory } from '@nestjs/core';
import { Types } from 'mongoose';
import { AppModule } from '../app.module';
import { KnockoutService } from '../modules/sports/knockout/knockout.service';

async function run() {
  const [tournamentId, organizationId] = process.argv.slice(2);

  if (
    !Types.ObjectId.isValid(tournamentId) ||
    !Types.ObjectId.isValid(organizationId)
  ) {
    throw new Error(
      'Usage: ts-node -r tsconfig-paths/register src/scripts/repair-knockout-fixtures.script.ts <tournamentId> <organizationId>',
    );
  }

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: false,
  });

  try {
    const knockoutService = app.get(KnockoutService);
    const result = await knockoutService.repairResolvedFixtures(
      tournamentId,
      organizationId,
    );
    const bracket = await knockoutService.listForTournament(
      tournamentId,
      organizationId,
    );
    const final = bracket.find((match) => match.stage === 'final');
    console.log(
      `Repaired ${result.repairedMatchIds.length} knockout match slot(s): ${result.repairedMatchIds.join(', ') || 'none'}`,
    );
    console.log(
      `Final fixture: ${final?.fixtureId?.toString() ?? 'not created'}; status: ${final?.status ?? 'not found'}`,
    );
  } finally {
    await app.close();
  }
}

run().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
