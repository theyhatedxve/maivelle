import { defineConfig } from 'eslint/config';
import expoConfig from 'eslint-config-expo/flat.js';
import globals from 'globals';

// Expo's installed preset enumerates .ts/.tsx; include native Node TS harnesses too.
const typedExpoConfig = expoConfig.map((configuration) =>
  configuration.files?.some(
    (pattern) => typeof pattern === 'string' && pattern.includes('*.ts'),
  )
    ? { ...configuration, files: [...configuration.files, '**/*.cts', '**/*.mts'] }
    : configuration,
);

export default defineConfig([
  typedExpoConfig,
  { ignores: ['android/**', 'ios/**', '.expo/**', 'dist/**'] },
  {
    // .cts keeps the existing Node CommonJS test/benchmark execution contract.
    files: ['tests/**/*.cts', 'scripts/**/*.cts'],
    languageOptions: { globals: globals.node },
    rules: { '@typescript-eslint/no-require-imports': 'off' },
  },
  {
    // Preserve the verified lazy native loading boundary; eager imports can block startup.
    files: [
      'src/services/security/**/*.ts',
      'src/features/vault/services/vaultFiles.native.ts',
      'src/testing/screens/vault-security-check.tsx',
      'src/testing/screens/vault-diagnostics.tsx',
    ],
    rules: { '@typescript-eslint/no-require-imports': 'off' },
  },
]);
