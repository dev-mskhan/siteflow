#!/usr/bin/env node
// OKF v0.2 Conformance Validator
// Validates bundle structure against https://github.com/GoogleCloudPlatform/knowledge-catalog/blob/main/okf/SPEC.md

import { readFile, readdir } from 'fs/promises';
import { join, basename } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const BUNDLE_ROOT = __dirname;

const errors = [];
const warnings = [];

// Extract YAML frontmatter
function extractFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return null;
  
  const yaml = match[1];
  const frontmatter = {};
  
  for (const line of yaml.split('\n')) {
    const colonIndex = line.indexOf(':');
    if (colonIndex === -1) continue;
    
    const key = line.slice(0, colonIndex).trim();
    const value = line.slice(colonIndex + 1).trim();
    
    frontmatter[key] = value;
  }
  
  return frontmatter;
}

// Check if file is an index
function isIndexFile(filename) {
  return basename(filename) === 'index.md';
}

// Check if file is log
function isLogFile(filename) {
  return basename(filename) === 'log.md';
}

// Validate concept file
async function validateConceptFile(filepath, relativePath) {
  const content = await readFile(filepath, 'utf-8');
  const frontmatter = extractFrontmatter(content);
  
  if (!frontmatter) {
    errors.push(`${relativePath}: Missing YAML frontmatter`);
    return;
  }
  
  if (!frontmatter.type) {
    errors.push(`${relativePath}: Missing required 'type' field in frontmatter`);
  }
  
  // Validate trust tier signals
  if (frontmatter.verified) {
    if (!frontmatter.verified.includes('human:')) {
      warnings.push(`${relativePath}: 'verified' field exists but no human actor - will be 'machine-confirmed' tier`);
    }
  } else if (frontmatter.generated) {
    warnings.push(`${relativePath}: Has 'generated' but no 'verified' - will be 'unverified' tier`);
  }
  
  // Check attested computation required fields
  if (frontmatter.type === 'Attested Computation') {
    const required = ['runtime', 'parameters', 'executor', 'attester'];
    for (const field of required) {
      if (!frontmatter[field]) {
        errors.push(`${relativePath}: Attested Computation missing required field '${field}'`);
      }
    }
  }
  
  return frontmatter;
}

// Validate index file
async function validateIndexFile(filepath, relativePath) {
  const content = await readFile(filepath, 'utf-8');
  
  if (relativePath === 'index.md') {
    // Root index MUST have okf_version
    const frontmatter = extractFrontmatter(content);
    if (!frontmatter || !frontmatter.okf_version) {
      errors.push(`${relativePath}: Root index.md must have 'okf_version' in frontmatter`);
    }
  } else {
    // Non-root index.md MUST NOT have frontmatter (except okf_version in root)
    const frontmatter = extractFrontmatter(content);
    if (frontmatter && Object.keys(frontmatter).length > 0) {
      warnings.push(`${relativePath}: Non-root index.md should not have frontmatter`);
    }
  }
  
  // Check for section headings and links
  const hasHeadings = /^##\s+/m.test(content);
  const hasLinks = /\[.*?\]\(.*?\.md\)/.test(content);
  
  if (!hasHeadings) {
    warnings.push(`${relativePath}: No section headings found (expected ## headers)`);
  }
  if (!hasLinks) {
    warnings.push(`${relativePath}: No markdown links found (expected links to concepts)`);
  }
}

// Validate log file
async function validateLogFile(filepath, relativePath) {
  const content = await readFile(filepath, 'utf-8');
  
  // Check for date headings (YYYY-MM-DD)
  const dateHeadings = content.match(/^##\s+\d{4}-\d{2}-\d{2}/gm);
  if (!dateHeadings || dateHeadings.length === 0) {
    errors.push(`${relativePath}: log.md must have date headings (## YYYY-MM-DD)`);
  }
  
  // Check that dates are in reverse chronological order (newest first)
  if (dateHeadings && dateHeadings.length > 1) {
    const dates = dateHeadings.map(h => h.replace('## ', ''));
    for (let i = 0; i < dates.length - 1; i++) {
      if (dates[i] < dates[i + 1]) {
        warnings.push(`${relativePath}: Dates not in reverse chronological order (newest first)`);
        break;
      }
    }
  }
}

// Walk directory recursively
async function walkDirectory(dir, relativePath = '') {
  const entries = await readdir(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    const relPath = relativePath ? `${relativePath}/${entry.name}` : entry.name;
    
    if (entry.isDirectory()) {
      await walkDirectory(fullPath, relPath);
    } else if (entry.name.endsWith('.md')) {
      if (isIndexFile(entry.name)) {
        await validateIndexFile(fullPath, relPath);
      } else if (isLogFile(entry.name)) {
        await validateLogFile(fullPath, relPath);
      } else {
        await validateConceptFile(fullPath, relPath);
      }
    }
  }
}

// Main validation
async function validate() {
  console.log('🔍 Validating OKF v0.2 bundle at:', BUNDLE_ROOT);
  console.log('');
  
  await walkDirectory(BUNDLE_ROOT);
  
  console.log('📊 Validation Results:\n');
  
  if (errors.length === 0 && warnings.length === 0) {
    console.log('✅ Bundle is fully OKF v0.2 conformant!\n');
    return 0;
  }
  
  if (errors.length > 0) {
    console.log(`❌ ${errors.length} error(s) found:\n`);
    errors.forEach(err => console.log(`  - ${err}`));
    console.log('');
  }
  
  if (warnings.length > 0) {
    console.log(`⚠️  ${warnings.length} warning(s):\n`);
    warnings.forEach(warn => console.log(`  - ${warn}`));
    console.log('');
  }
  
  return errors.length > 0 ? 1 : 0;
}

validate().then(code => process.exit(code)).catch(err => {
  console.error('Validation failed:', err);
  process.exit(1);
});
