#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const strict = process.argv.includes('--strict');

const files = {
  appShell: path.join(root, 'components/shell/AppShell.tsx'),
  panelRenderer: path.join(root, 'components/panel/PanelRenderer.tsx'),
  componentRenderer: path.join(root, 'components/panel/ComponentRenderer.tsx'),
  templateContract: path.join(root, 'lib/config/component-template.ts'),
  effectiveConfig: path.join(root, 'logline/crates/logline-daemon/src/main.rs'),
  templateDoc: path.join(root, 'docs/TEMPLATE_CONTRACT.md'),
};

function read(file) {
  try {
    return fs.readFileSync(file, 'utf8');
  } catch {
    return '';
  }
}

function warn(warnings, message) {
  warnings.push(message);
}

function mustContain(warnings, content, needle, label) {
  if (!content.includes(needle)) {
    warn(warnings, `${label}: missing required pattern \`${needle}\``);
  }
}

const warnings = [];

const appShell = read(files.appShell);
const panelRenderer = read(files.panelRenderer);
const componentRenderer = read(files.componentRenderer);
const templateContract = read(files.templateContract);
const effectiveConfig = read(files.effectiveConfig);
const templateDoc = read(files.templateDoc);

if (!appShell) warn(warnings, 'AppShell file missing or unreadable');
if (!panelRenderer) warn(warnings, 'PanelRenderer file missing or unreadable');
if (!componentRenderer) warn(warnings, 'ComponentRenderer file missing or unreadable');
if (!templateContract) warn(warnings, 'Template contract file missing or unreadable');
if (!effectiveConfig) warn(warnings, 'Effective config resolver source missing or unreadable');
if (!templateDoc) warn(warnings, 'Template contract doc missing or unreadable');

// Rule group: header scope identity
mustContain(warnings, appShell, 'UBLX', 'Header scope rule');
mustContain(warnings, appShell, '&gt;', 'Header scope rule');

// Rule group: template contract must exist and include critical fields
[
  'export type ComponentTemplateContract',
  'TEMPLATE_CONTRACT_VERSION',
  'app_scope',
  'override_cascade',
  'template_size',
  'import_app_tags',
  'import_tab_tags',
  'connection_contract',
  'cli_contract',
  'mobile_priority',
].forEach((needle) => mustContain(warnings, templateContract, needle, 'Template contract rule'));

mustContain(warnings, templateDoc, 'template_contract_version = 1', 'Template docs rule');

// Rule group: panel uses template contract for sizing
mustContain(warnings, panelRenderer, 'resolveTemplateContract', 'Panel sizing rule');

// Rule group: component persists critical settings
[
  'template_size',
  'app_scope',
  'override_cascade',
  'import_app_tags',
  'import_tab_tags',
  'connection_type',
  'connection_ref',
  'cli_command',
].forEach((needle) => mustContain(warnings, componentRenderer, needle, 'Component persistence rule'));

// Rule group: resolver enforces scope and override semantics
[
  'resolve_scoped_app_layer',
  'should_override_cascade',
  'parse_imported_tags(&instance_layer, "import_app_tags")',
  'parse_imported_tags(&instance_layer, "import_tab_tags")',
  'app_scope',
].forEach((needle) => mustContain(warnings, effectiveConfig, needle, 'Cascade semantics rule'));

// Rule group: front face should stay essential (no heavy config copy)
const backFaceMarker = "style={{ transform: 'rotateY(180deg)' }}";
const markerIndex = componentRenderer.indexOf(backFaceMarker);
if (markerIndex === -1) {
  warn(warnings, 'Front-face rule: cannot locate back-face marker in ComponentRenderer');
} else {
  const frontFace = componentRenderer.slice(0, markerIndex).toLowerCase();
  const forbiddenFrontTokens = [
    'import app tags',
    'import tab tags',
    'connection + cli override',
    'override tab/app cascade',
    'missing tags:',
  ];
  for (const token of forbiddenFrontTokens) {
    if (frontFace.includes(token)) {
      warn(warnings, `Front-face rule: token appears on front face: \`${token}\``);
    }
  }
}

if (warnings.length === 0) {
  console.log('Template rules check: OK (no violations found).');
  process.exit(0);
}

console.log(`Template rules check: ${warnings.length} warning(s) found.`);
for (const [i, w] of warnings.entries()) {
  console.log(`${i + 1}. ${w}`);
}

if (strict) {
  process.exit(1);
}

process.exit(0);
