#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const contractPath = path.join(root, 'lib/config/component-template.ts');
const resolverPath = path.join(root, 'logline/crates/logline-daemon/src/main.rs');

const contract = fs.readFileSync(contractPath, 'utf8');
const resolver = fs.readFileSync(resolverPath, 'utf8');

const requiredContractTokens = [
  'export const TEMPLATE_CONTRACT_VERSION = 1',
  'export function normalizeTemplateFrontProps',
  'export function isAllowedConnectionType',
  'export function isCliCommandAllowed',
  'export function mobilePriorityRank',
  'template_contract_version',
];

const requiredResolverTokens = [
  'resolve_scoped_app_layer',
  'should_override_cascade',
  'parse_imported_tags(&instance_layer, "import_app_tags")',
  'parse_imported_tags(&instance_layer, "import_tab_tags")',
  'app_scope',
];

const missing = [];
for (const token of requiredContractTokens) {
  if (!contract.includes(token)) missing.push(`component-template.ts missing: ${token}`);
}
for (const token of requiredResolverTokens) {
  if (!resolver.includes(token)) missing.push(`daemon effective-config missing: ${token}`);
}

if (missing.length > 0) {
  console.error('Template contract tests failed:');
  for (const m of missing) console.error(`- ${m}`);
  process.exit(1);
}

console.log('Template contract tests passed.');
