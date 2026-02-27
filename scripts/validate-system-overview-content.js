#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const contentRoot = path.join(repoRoot, 'src', 'content', 'system-overview');
const productsRoot = path.join(contentRoot, 'products');

const requiredManifestFields = [
  'sections:',
  'executiveSummary:',
  'ecosystemMap:',
  'products:',
  'backendServices:',
  'dataCollections:',
  'integrations:',
  'flows:',
  'ownershipMatrix:',
  'risksAndGaps:',
  'glossary:',
];

const requiredFeatureFields = [
  'id:',
  'name:',
  'persona:',
  'outcome:',
  'entryPoints:',
  'dependentServices:',
  'firestoreCollections:',
  'integrations:',
  'owner:',
  'releaseChannel:',
  'status:',
  'sourceRefs:',
];

function readFile(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function validateManifestShape(errors) {
  const manifestPath = path.join(contentRoot, 'manifest.ts');
  const content = readFile(manifestPath);

  requiredManifestFields.forEach((field) => {
    if (!content.includes(field)) {
      errors.push(`manifest.ts missing required field token: ${field}`);
    }
  });
}

function validateProductFiles(errors) {
  const productFiles = fs
    .readdirSync(productsRoot)
    .filter((fileName) => fileName.endsWith('.ts'))
    .map((fileName) => path.join(productsRoot, fileName));

  if (productFiles.length === 0) {
    errors.push('No product handbook files found in src/content/system-overview/products.');
    return;
  }

  productFiles.forEach((filePath) => {
    const content = readFile(filePath);
    const [, featureSegment = ''] = content.split('featureInventory:');
    const featureIdMatches = featureSegment.match(/\bid:\s*'[^']+'/g) || [];
    const featureCount = featureIdMatches.length;

    if (featureCount === 0) {
      errors.push(`${path.relative(repoRoot, filePath)} has zero feature inventory entries.`);
      return;
    }

    requiredFeatureFields.forEach((field) => {
      const matches = featureSegment.match(new RegExp(`\\b${field.replace(':', '\\:')}`, 'g')) || [];
      if (matches.length < featureCount) {
        errors.push(
          `${path.relative(repoRoot, filePath)} appears to have incomplete feature blocks for field "${field}" (features=${featureCount}, fieldCount=${matches.length}).`
        );
      }
    });
  });
}

function validateSourcePaths(errors) {
  const filesToScan = [
    path.join(contentRoot, 'manifest.ts'),
    path.join(contentRoot, 'flows.ts'),
    ...fs
      .readdirSync(productsRoot)
      .filter((fileName) => fileName.endsWith('.ts'))
      .map((fileName) => path.join(productsRoot, fileName)),
  ];

  const missingPaths = [];

  filesToScan.forEach((filePath) => {
    const content = readFile(filePath);
    const regex = /path:\s*'([^']+)'/g;
    let match;

    while ((match = regex.exec(content)) !== null) {
      const declaredPath = match[1];
      const resolvedPath = path.resolve(repoRoot, declaredPath);

      if (!fs.existsSync(resolvedPath)) {
        missingPaths.push({
          file: path.relative(repoRoot, filePath),
          declaredPath,
        });
      }
    }
  });

  if (missingPaths.length > 0) {
    missingPaths.forEach((entry) => {
      errors.push(`Missing source reference path in ${entry.file}: ${entry.declaredPath}`);
    });
  }
}

function main() {
  const errors = [];

  if (!fs.existsSync(contentRoot)) {
    console.error('System overview content folder not found.');
    process.exit(1);
  }

  validateManifestShape(errors);
  validateProductFiles(errors);
  validateSourcePaths(errors);

  if (errors.length > 0) {
    console.error('System overview content validation failed:\n');
    errors.forEach((error) => console.error(`- ${error}`));
    process.exit(1);
  }

  console.log('System overview content validation passed.');
}

main();
