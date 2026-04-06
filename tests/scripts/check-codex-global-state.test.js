/**
 * Source-level tests for scripts/codex/check-codex-global-state.sh
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const scriptPath = path.join(__dirname, '..', '..', 'scripts', 'codex', 'check-codex-global-state.sh');
const source = fs.readFileSync(scriptPath, 'utf8').replace(/\r\n/g, '\n');

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    return true;
  } catch (error) {
    console.log(`  ✗ ${name}`);
    console.log(`    Error: ${error.message}`);
    return false;
  }
}

function runTests() {
  console.log('\n=== Testing check-codex-global-state.sh ===\n');

  let passed = 0;
  let failed = 0;

  if (test('checks Codex-installed skills directories before legacy agents path', () => {
    assert.ok(source.includes('CODEX_AGENT_SKILLS_DIR="$CODEX_HOME/.agents/skills"'), 'Expected Codex .agents skills path');
    assert.ok(source.includes('CODEX_SKILLS_DIR="$CODEX_HOME/skills"'), 'Expected Codex skills path');
    assert.ok(source.includes('LEGACY_SKILLS_DIR="${AGENTS_HOME:-$HOME/.agents}/skills"'), 'Expected legacy skills path fallback');
  })) passed++; else failed++;

  if (test('verifies required skills across multiple roots', () => {
    assert.ok(source.includes('for skill_root in "${skill_roots[@]}"; do'), 'Expected skills search across discovered roots');
    assert.ok(source.includes('if [[ -d "$skill_root/$skill" ]]; then'), 'Expected per-root skill existence checks');
    assert.ok(source.includes('All 16 ECC skills are present across:'), 'Expected success message to mention combined roots');
  })) passed++; else failed++;

  if (test('warns only when no candidate skills directories exist', () => {
    assert.ok(source.includes('No skills directories found (checked:'), 'Expected missing-directory warning to enumerate checked roots');
  })) passed++; else failed++;

  console.log(`\nResults: Passed: ${passed}, Failed: ${failed}`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests();
