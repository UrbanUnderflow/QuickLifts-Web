const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const bundlePath = path.resolve(
  process.cwd(),
  process.env.LOCAL_SETUP_BUNDLE_INPUT || '.setup/local-machine-setup.bundle.enc.json'
);
const envOutputPath = path.resolve(process.cwd(), '.env.local');
const googleCredentialsOutputPath = path.resolve(
  process.cwd(),
  '.local-secrets/google-application-credentials.json'
);

function ensureDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function parseEnvValue(rawValue) {
  let value = rawValue.trim();

  if (value.startsWith('"') && value.endsWith('"')) {
    try {
      const parsed = JSON.parse(value);
      return typeof parsed === 'string' ? parsed.replace(/\\n/g, '\n') : String(parsed);
    } catch (_error) {
      value = value.slice(1, -1);
    }
  } else if (value.startsWith("'") && value.endsWith("'")) {
    value = value.slice(1, -1);
  }

  return value.replace(/\\n/g, '\n');
}

function requirePassphrase() {
  const passphrase = process.env.SETUP_BUNDLE_PASSPHRASE || process.env.LOCAL_SETUP_BUNDLE_PASSPHRASE;
  if (!passphrase) {
    throw new Error('Set SETUP_BUNDLE_PASSPHRASE before importing the encrypted setup bundle.');
  }
  return passphrase;
}

function decryptBundle(bundle, passphrase) {
  if (bundle.version !== 1) {
    throw new Error(`Unsupported bundle version: ${bundle.version}`);
  }

  const salt = Buffer.from(bundle.salt, 'base64');
  const iv = Buffer.from(bundle.iv, 'base64');
  const authTag = Buffer.from(bundle.authTag, 'base64');
  const ciphertext = Buffer.from(bundle.ciphertext, 'base64');
  const key = crypto.scryptSync(passphrase, salt, 32);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return JSON.parse(plaintext.toString('utf8'));
}

function readExistingEnvFile(filePath) {
  const env = {};
  if (!fs.existsSync(filePath)) {
    return env;
  }

  const content = fs.readFileSync(filePath, 'utf8');
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const separatorIndex = line.indexOf('=');
    if (separatorIndex <= 0) continue;

    const key = line.slice(0, separatorIndex).trim();
    const value = parseEnvValue(line.slice(separatorIndex + 1));
    env[key] = value;
  }

  return env;
}

function quoteEnvValue(value) {
  return JSON.stringify(String(value).replace(/\r?\n/g, '\\n'));
}

function writeEnvFile(filePath, env) {
  const lines = Object.keys(env)
    .sort()
    .map((key) => `${key}=${quoteEnvValue(env[key])}`);

  ensureDir(filePath);
  fs.writeFileSync(filePath, `${lines.join('\n')}\n`, 'utf8');
}

async function main() {
  if (!fs.existsSync(bundlePath)) {
    throw new Error(`Encrypted setup bundle not found at ${bundlePath}`);
  }

  const passphrase = requirePassphrase();
  const bundle = JSON.parse(fs.readFileSync(bundlePath, 'utf8'));
  const payload = decryptBundle(bundle, passphrase);

  const env = {
    ...readExistingEnvFile(envOutputPath),
    ...(payload.env || {}),
  };

  if (payload.files?.googleApplicationCredentials) {
    ensureDir(googleCredentialsOutputPath);
    fs.writeFileSync(
      googleCredentialsOutputPath,
      payload.files.googleApplicationCredentials,
      'utf8'
    );
    env.GOOGLE_APPLICATION_CREDENTIALS = googleCredentialsOutputPath;
  }

  writeEnvFile(envOutputPath, env);

  console.log('');
  console.log('Local machine setup bundle imported.');
  console.log(`Wrote env file: ${envOutputPath}`);
  if (payload.files?.googleApplicationCredentials) {
    console.log(`Wrote Google credentials file: ${googleCredentialsOutputPath}`);
  }
  console.log('Next steps:');
  console.log('1. npm run test:e2e:bootstrap:check');
  console.log('2. npm run test:e2e:auth');
  console.log('3. source .playwright/bootstrap.env');
  console.log('');
}

main().catch((error) => {
  console.error('');
  console.error('Failed to import local machine setup bundle:', error.message || error);
  process.exit(1);
});
