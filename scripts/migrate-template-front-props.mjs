#!/usr/bin/env node

import postgres from 'postgres';

const connection = process.env.DATABASE_URL;

if (!connection) {
  console.error('DATABASE_URL is required for template migration.');
  process.exit(1);
}

const dryRun = !process.argv.includes('--apply');
const sql = postgres(connection, { max: 1 });

async function main() {
  try {
    const rows = await sql`select instance_id, component_id, front_props from panel_components`;

    let total = 0;
    let changed = 0;

    for (const row of rows) {
      total += 1;
      let parsed;
      try {
        parsed = JSON.parse(row.front_props ?? '{}');
      } catch {
        parsed = {};
      }

      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        parsed = {};
      }

      if (typeof parsed.template_contract_version === 'number' && Number.isFinite(parsed.template_contract_version)) {
        continue;
      }

      parsed.template_contract_version = 1;
      changed += 1;

      if (!dryRun) {
        await sql`
          update panel_components
          set front_props = ${JSON.stringify(parsed)}, updated_at = now()
          where instance_id = ${row.instance_id}
        `;
      }
    }

    console.log(`Scanned ${total} component instance(s).`);
    if (dryRun) {
      console.log(`Would update ${changed} instance(s). Run with --apply to persist.`);
    } else {
      console.log(`Updated ${changed} instance(s).`);
    }
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((err) => {
  console.error('Template migration failed:', err);
  process.exit(1);
});
