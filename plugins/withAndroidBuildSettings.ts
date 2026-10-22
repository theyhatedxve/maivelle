import {
  withGradleProperties,
  withAndroidManifest,
  AndroidConfig,
  type ConfigPlugin,
} from 'expo/config-plugins';
// CMake 3.22.1 ships Ninja 1.10.2, which fails on Router's generated paths
// on Windows. SDK 58's root Gradle plugin applies this version to all modules.

const withAndroidBuildSettings: ConfigPlugin = function withAndroidBuildSettings(config) {
  config = withGradleProperties(config, (mod) => {
    const key = 'android.cmakeVersion';
    mod.modResults = mod.modResults.filter(
      (entry) => entry.type !== 'property' || entry.key !== key,
    );
    mod.modResults.push({ type: 'property', key, value: '3.31.1' });
    return mod;
  });
  // RN 0.88 forwards font configuration changes to the existing Fabric surface.
  // Keep a single Router root; system font scaling remains enabled.
  return withAndroidManifest(config, (mod) => {
    const activity = AndroidConfig.Manifest.getMainActivityOrThrow(mod.modResults);
    const changes = new Set((activity.$['android:configChanges'] ?? '').split('|').filter(Boolean));
    changes.add('fontScale');
    activity.$['android:configChanges'] = [...changes].join('|');
    return mod;
  });
};
export default withAndroidBuildSettings;
