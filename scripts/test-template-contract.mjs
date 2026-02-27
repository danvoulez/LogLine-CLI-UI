#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const contractPath = path.join(root, 'lib/config/component-template.ts');
const resolverPath = path.join(root, 'lib/config/effective-config.ts');

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
  'resolveScopedAppLayer',
  'shouldOverrideCascade',
  "parseImportedTags(instanceLayer, 'import_app_tags')",
  "parseImportedTags(instanceLayer, 'import_tab_tags')",
  'app_scope',
];

const missing = [];
for (const token of requiredContractTokens) {
  if (!contract.includes(token)) missing.push(`component-template.ts missing: ${token}`);
}
for (const token of requiredResolverTokens) {
  if (!resolver.includes(token)) missing.push(`effective-config.ts missing: ${token}`);
}

if (missing.length > 0) {
  console.error('Template contract tests failed:');
  for (const m of missing) console.error(`- ${m}`);
  process.exit(1);
}

console.log('Template contract tests passed.');
