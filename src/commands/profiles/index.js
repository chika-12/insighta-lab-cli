import { Command } from 'commander';
import fs from 'fs';
import path from 'path';
import client from '../../api/client.js';
import { hasTokens } from '../../auth/tokenStore.js';

function requireAuth() {
  if (!hasTokens()) {
    console.error('\n✖  Not logged in. Run: insighta login\n');
    process.exit(1);
  }
}

function printTable(profiles) {
  if (!profiles.length) {
    console.log('\n  (no profiles found)\n');
    return;
  }

  const cols = ['name', 'email', 'role', 'jobTitle', 'createdAt'];
  const rows = profiles.map((p) =>
    cols.map((c) => {
      const val = p[c] ?? '—';
      return c === 'createdAt' ? new Date(val).toLocaleDateString() : val;
    })
  );

  const widths = cols.map((c, i) =>
    Math.max(c.length, ...rows.map((r) => String(r[i]).length))
  );

  const sep = widths.map((w) => '─'.repeat(w + 2)).join('┼');
  const header = cols.map((c, i) => ` ${c.padEnd(widths[i])} `).join('│');

  console.log(`\n┌${sep}┐`);
  console.log(`│${header}│`);
  console.log(`├${sep}┤`);
  rows.forEach((row) => {
    const line = row
      .map((v, i) => ` ${String(v).padEnd(widths[i])} `)
      .join('│');
    console.log(`│${line}│`);
  });
  console.log(`└${sep}┘\n`);
}

async function listProfiles(opts) {
  requireAuth();
  try {
    const params = {};
    if (opts.page) params.page = opts.page;
    if (opts.limit) params.limit = opts.limit;
    if (opts.role) params.role = opts.role;
    if (opts.sort) params.sort = opts.sort;
    if (opts.search) params.search = opts.search;

    const { data } = await client.get('/profiles', { params });
    const profiles = data.data ?? data.profiles ?? data;

    console.log(`\n📋  Profiles  (page ${opts.page ?? 1})`);
    printTable(Array.isArray(profiles) ? profiles : []);

    if (data.pagination) {
      const p = data.pagination;
      console.log(
        `    Page ${p.page} of ${p.totalPages}  |  Total: ${p.total}\n`
      );
    }
  } catch (err) {
    console.error(`\n✖  ${err.response?.data?.message ?? err.message}\n`);
    process.exit(1);
  }
}

async function getProfile(id) {
  requireAuth();
  try {
    const { data } = await client.get(`/profiles/${id}`);
    const profile = data.data ?? data;
    console.log('\n👤  Profile Details\n');
    Object.entries(profile).forEach(([k, v]) => {
      if (v !== null && v !== undefined) {
        console.log(`  ${k.padEnd(16)} ${v}`);
      }
    });
    console.log();
  } catch (err) {
    console.error(`\n✖  ${err.response?.data?.message ?? err.message}\n`);
    process.exit(1);
  }
}

async function exportProfiles(opts) {
  requireAuth();
  try {
    console.log('\n⏳  Downloading CSV export…');
    const response = await client.get('/profiles/export', {
      responseType: 'text',
      params: opts.role ? { role: opts.role } : undefined,
    });

    const filename = opts.output ?? `insighta-profiles-${Date.now()}.csv`;
    const dest = path.resolve(filename);
    fs.writeFileSync(dest, response.data, 'utf-8');
    console.log(`\n✔  Exported to: ${dest}\n`);
  } catch (err) {
    if (err.response?.status === 403) {
      console.error('\n✖  Access denied — admin role required.\n');
    } else {
      console.error(`\n✖  ${err.response?.data?.message ?? err.message}\n`);
    }
    process.exit(1);
  }
}

export function registerProfilesCommand(program) {
  const profiles = program
    .command('profiles')
    .description('Manage user profiles');

  profiles
    .command('list')
    .description('List profiles with optional filters')
    .option('-p, --page <n>', 'Page number', '1')
    .option('-l, --limit <n>', 'Results per page', '20')
    .option('-r, --role <role>', 'Filter by role (admin|analyst)')
    .option('-s, --sort <field>', 'Sort field (e.g. createdAt, name)')
    .option('-q, --search <q>', 'Natural language search query')
    .action(listProfiles);

  profiles
    .command('get <id>')
    .description('Get a single profile by ID')
    .action(getProfile);

  profiles
    .command('export')
    .description('Export all profiles to CSV (admin only)')
    .option('-o, --output <file>', 'Output filename')
    .option('-r, --role <role>', 'Filter export by role')
    .action(exportProfiles);
}
