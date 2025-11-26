#!/usr/bin/env node

/**
 * Script to update all hardcoded API URLs to use centralized config
 * This script will:
 * 1. Find all .js/.jsx files with hardcoded http://127.0.0.1:8000
 * 2. Add import for API_BASE_URL if not present
 * 3. Replace hardcoded URLs with ${API_BASE_URL}
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Color codes for terminal output
const colors = {
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m',
  reset: '\x1b[0m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function findFilesWithHardcodedUrl(srcDir) {
  try {
    const result = execSync(
      `grep -rl "http://127.0.0.1:8000" "${srcDir}" --include="*.js" --include="*.jsx"`,
      { encoding: 'utf-8' }
    );
    return result.trim().split('\n').filter(f => f);
  } catch (error) {
    // grep returns non-zero exit code if no matches found
    return [];
  }
}

function getRelativeImportPath(filePath) {
  const fileDir = path.dirname(filePath);
  const configPath = path.join(process.cwd(), 'src/config.js');

  // Calculate relative path from file to config.js
  const relativePath = path.relative(fileDir, configPath);

  // Convert to Unix-style path and remove .js extension
  return relativePath.replace(/\\/g, '/').replace('.js', '');
}

function updateFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf-8');
  let modified = false;

  // Check if file already imports API_BASE_URL
  const hasImport = /import\s+.*API_BASE_URL.*from\s+['"].*config['"]/.test(content);

  if (!hasImport) {
    // Calculate relative import path
    const importPath = getRelativeImportPath(filePath);
    const importStatement = `import API_BASE_URL from '${importPath}';\n`;

    // Find the best place to insert the import
    // Look for existing imports
    const importRegex = /^import\s+.*from\s+['"].*['"];?\s*$/gm;
    const imports = content.match(importRegex);

    if (imports && imports.length > 0) {
      // Add after the last import
      const lastImport = imports[imports.length - 1];
      const lastImportIndex = content.lastIndexOf(lastImport);
      const insertPosition = lastImportIndex + lastImport.length;
      content = content.slice(0, insertPosition) + '\n' + importStatement + content.slice(insertPosition);
    } else {
      // No imports found, add at the beginning (after any comments)
      const firstLineOfCode = content.search(/^[^/\s]/m);
      if (firstLineOfCode > 0) {
        content = content.slice(0, firstLineOfCode) + importStatement + '\n' + content.slice(firstLineOfCode);
      } else {
        content = importStatement + '\n' + content;
      }
    }
    modified = true;
  }

  // Replace all hardcoded URLs
  const originalContent = content;

  // Replace URLs in template literals: `http://127.0.0.1:8000...` -> `${API_BASE_URL}...`
  content = content.replace(/`http:\/\/127\.0\.0\.1:8000/g, '`${API_BASE_URL}');

  // Replace URLs with single quotes: 'http://127.0.0.1:8000' -> `${API_BASE_URL}`
  content = content.replace(/'http:\/\/127\.0\.0\.1:8000'/g, '`${API_BASE_URL}`');

  // Replace URLs with double quotes: "http://127.0.0.1:8000" -> `${API_BASE_URL}`
  content = content.replace(/"http:\/\/127\.0\.0\.1:8000"/g, '`${API_BASE_URL}`');

  if (content !== originalContent) {
    modified = true;
  }

  if (modified) {
    fs.writeFileSync(filePath, content, 'utf-8');
    return true;
  }

  return false;
}

function main() {
  const srcDir = path.join(process.cwd(), 'src');

  log('\n🔍 Searching for files with hardcoded API URLs...', 'blue');

  const files = findFilesWithHardcodedUrl(srcDir);

  if (files.length === 0) {
    log('✅ No files found with hardcoded URLs!', 'green');
    return;
  }

  log(`\n📝 Found ${files.length} files to update\n`, 'yellow');

  let updatedCount = 0;

  files.forEach((file, index) => {
    const relativePath = path.relative(process.cwd(), file);
    process.stdout.write(`[${index + 1}/${files.length}] Updating ${relativePath}... `);

    try {
      const wasUpdated = updateFile(file);
      if (wasUpdated) {
        log('✓', 'green');
        updatedCount++;
      } else {
        log('⊘ (no changes needed)', 'yellow');
      }
    } catch (error) {
      log(`✗ (${error.message})`, 'red');
    }
  });

  log(`\n✅ Successfully updated ${updatedCount} files!`, 'green');
  log(`\n💡 Next steps:`, 'blue');
  log(`   1. Review the changes: git diff`, 'reset');
  log(`   2. Test the app: npm run dev`, 'reset');
  log(`   3. Build for production: npm run build`, 'reset');
}

main();
