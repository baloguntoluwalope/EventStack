import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../app.module';

// Navigation fix: step out of `scripts/` into `identity/`
import type { IUserRepository } from '../identity/users/interface/users-repository.interface';
import { USER_REPOSITORY } from '../identity/users/interface/users-repository.interface';

/**
 * Platform admin management — intentionally CLI-only, never exposed via
 * HTTP. Run with: npm run admin -- <command> [email]
 *
 * Commands:
 *   grant <email>    Set platformAdmin = true for the given user
 *   revoke <email>   Set platformAdmin = false for the given user
 *   list             List all users with platformAdmin = true
 */
async function run() {
  const [command, email] = process.argv.slice(2);

  if (!command || !['grant', 'revoke', 'list'].includes(command)) {
    console.error('Usage: npm run admin -- <grant|revoke|list> [email]');
    process.exit(1);
  }

  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  const userRepo = app.get<IUserRepository>(USER_REPOSITORY);

  try {
    if (command === 'list') {
      const admins = await userRepo.findMany({ platformAdmin: true });
      if (admins.length === 0) {
        console.log('No platform admins found.');
      } else {
        console.log(`Platform admins (${admins.length}):`);
        admins.forEach((u) => {
          const userId = (u as any).id?.toString() || (u as any)._id?.toString();
          console.log(`  - ${u.email} (${userId})`);
        });
      }
      return;
    }

    if (!email) {
      console.error(`Usage: npm run admin -- ${command} <email>`);
      process.exit(1);
    }

    const user = await userRepo.findByEmail(email);
    if (!user) {
      console.error(`No user found with email: ${email}`);
      process.exit(1);
    }

    const userId = (user as any).id?.toString() || (user as any)._id?.toString();
    const grant = command === 'grant';

    await userRepo.updateById(userId, { platformAdmin: grant } as any);
    console.log(`${grant ? 'Granted' : 'Revoked'} platform admin for ${email}.`);
  } finally {
    await app.close();
  }
}

run().catch((err) => {
  console.error('Script failed:', err.message);
  process.exit(1);
});