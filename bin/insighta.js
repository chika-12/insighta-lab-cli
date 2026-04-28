#!/usr/bin/env node

import { Command } from 'commander';
import { loginAction } from '../src/commands/login.js';
import { logoutAction } from '../src/commands/logout.js';
import { registerProfilesCommand } from '../src/commands/profiles/index.js';

const program = new Command();

program
  .name('insighta')
  .description('Insighta Labs+ CLI — manage profiles from your terminal')
  .version('1.0.0');

program
  .command('login')
  .description('Authenticate via GitHub OAuth')
  .action(async () => {
    try {
      await loginAction();
    } catch (err) {
      console.error(`\n✖  Login failed: ${err.message}\n`);
      process.exit(1);
    }
  });

program
  .command('logout')
  .description('Clear your local session')
  .action(async () => {
    try {
      await logoutAction();
    } catch (err) {
      console.error(`\n✖  Logout error: ${err.message}\n`);
      process.exit(1);
    }
  });

program
  .command('whoami')
  .description('Show the currently logged in user')
  .action(async () => {
    const { hasTokens } = await import('../src/auth/tokenStore.js');
    if (!hasTokens()) {
      console.log('\nNot logged in. Run: insighta login\n');
      return;
    }
    try {
      const client = (await import('../src/api/client.js')).default;
      const { data } = await client.get('/auth/me');
      const user = data.data ?? data;
      console.log(
        `\n👤  ${user.name ?? user.username}  (${user.email ?? '—'})`
      );
      console.log(`    Role: ${user.role}`);
      console.log(`    ID:   ${user._id ?? user.id}\n`);
    } catch (err) {
      console.error(`\n✖  ${err.response?.data?.message ?? err.message}\n`);
      process.exit(1);
    }
  });

registerProfilesCommand(program);

program.parse(process.argv);

if (!process.argv.slice(2).length) {
  program.outputHelp();
}
