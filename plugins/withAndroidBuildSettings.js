const { withGradleProperties } = require('expo/config-plugins');

// CMake 3.22.1 ships Ninja 1.10.2, which fails on Router's generated paths
// on Windows. SDK 58's root Gradle plugin applies this version to all modules.
/** @type {import('expo/config-plugins').ConfigPlugin} */
module.exports = function withAndroidBuildSettings(config) {
  return withGradleProperties(config, (mod) => {
    const key = 'android.cmakeVersion';
    mod.modResults = mod.modResults.filter((entry) => entry.type !== 'property' || entry.key !== key);
    mod.modResults.push({ type: 'property', key, value: '3.31.1' });
    return mod;
  });
};
