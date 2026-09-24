import fs from 'node:fs';

const requiredChecks = [
  ['src/settings.ts', /@peterwestermann\/homebridge-harvia/],
  ['src/accessories/TemperatureSensorAccessory.ts', /class TemperatureSensorAccessory/],
  ['src/HarviaPlatform.ts', /enableTemperatureSensor/],
  ['src/HarviaPlatform.ts', /device\.id\}-temperature|\['temperature'/],
  ['config.schema.json', /enableTemperatureSensor/],
];

let failed = false;

for (const [path, pattern] of requiredChecks) {
  const content = fs.readFileSync(path, 'utf8');
  if (!pattern.test(content)) {
    console.error(`PW integrity check failed: ${path} does not match ${pattern}`);
    failed = true;
  }
}

const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
if (pkg.name !== '@peterwestermann/homebridge-harvia') {
  console.error(`PW integrity check failed: unexpected package name "${pkg.name}"`);
  failed = true;
}

if (!/-pw\./.test(pkg.version)) {
  console.error(`PW integrity check failed: package version "${pkg.version}" is not marked as a PW prerelease`);
  failed = true;
}

if (failed) {
  process.exit(1);
}

console.log('PW integrity check passed.');
