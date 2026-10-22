/** Validate the exported Android graph, not just TypeScript's host resolution. */
const { readFileSync, readdirSync, statSync } = require('node:fs');
const { join } = require('node:path');
const { createHash } = require('node:crypto');

const outputDirectory = process.argv[2];
if (!outputDirectory) {
  throw new Error('Usage: node scripts/verify-android-export.cts <Expo Android export directory>');
}
const directory = join(outputDirectory, '_expo/static/js/android');
const bundles: string[] = readdirSync(directory).filter((name: string) => name.endsWith('.hbc'));
if (bundles.length !== 1) throw new Error('Expected exactly one Android Hermes bundle.');
const bundle = join(directory, bundles[0]);
const map: { sources?: unknown } = JSON.parse(readFileSync(`${bundle}.map`, 'utf8'));
if (!Array.isArray(map.sources) || !map.sources.every((source) => typeof source === 'string')) {
  throw new Error('Android source map has no valid source inventory.');
}
const sources: string[] = map.sources.map((source: string) => source.replaceAll('\\', '/'));
if (
  !sources.some((source) => source.endsWith('/services/security/vaultKdf.native.ts')) ||
  sources.some((source) => source.endsWith('/services/security/vaultKdf.ts'))
) {
  throw new Error('Android must include the native KDF and exclude the Node-only reference.');
}
console.log(
  JSON.stringify(
    {
      nativeKdfSelected: true,
      hostReferenceExcluded: true,
      bytes: statSync(bundle).size,
      sha256: createHash('sha256').update(readFileSync(bundle)).digest('hex'),
      mappedSources: sources.length,
    },
    null,
    2,
  ),
);
