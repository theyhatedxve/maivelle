import { Redirect } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import ScreenContainer from '../components/layout/ScreenContainer';
import AppHeader from '../components/layout/AppHeader';
import AppButton from '../components/ui/AppButton';
import AppText from '../components/ui/AppText';
import { readRestartProbe, runNativeDatabaseChecks, seedRestartProbe } from '../database/testing/nativeDiagnostics';
import { runNativeTaskChecks } from '../database/testing/nativeTaskDiagnostics';
import { runNativeCalendarChecks } from '../database/testing/nativeCalendarDiagnostics';
import { runNativeMedicineChecks } from '../database/testing/nativeMedicineDiagnostics';
import { runNativeTimeTrackerChecks } from '../database/testing/nativeTimeTrackerDiagnostics';
import { spacing } from '../theme';

export default function DatabaseDiagnosticsScreen() {
  const [output, setOutput] = useState('Ready for synthetic database checks.');
  const [busy, setBusy] = useState(false);
  if (!__DEV__) return <Redirect href="/" />;
  /** @param {() => Promise<string | string[]>} operation */
  async function run(operation) {
    setBusy(true);
    try {
      const result = await operation();
      setOutput(Array.isArray(result) ? result.join('\n') : result);
    } catch (error) {
      setOutput(`FAILED: ${error instanceof Error ? error.message : 'Database check failed.'}`);
    } finally { setBusy(false); }
  }
  return (
    <ScreenContainer>
      <AppHeader title="Database diagnostics" back />
      <View style={styles.content}>
        <AppText>Development only. Synthetic fixtures only. This is not the Notes feature and is not secure storage for real information.</AppText>
        <AppButton label="Run native database checks" disabled={busy} onPress={() => run(runNativeDatabaseChecks)} />
        <AppButton label="Run native task checks" disabled={busy} onPress={() => run(runNativeTaskChecks)} />
        <AppButton label="Run native calendar checks" disabled={busy} onPress={() => run(runNativeCalendarChecks)} />
        <AppButton label="Run native medicine checks" disabled={busy} onPress={() => run(runNativeMedicineChecks)} />
        <AppButton label="Run native time tracker checks" disabled={busy} onPress={() => run(runNativeTimeTrackerChecks)} />
        <AppButton label="Save synthetic restart probe" disabled={busy} variant="secondary" onPress={() => run(seedRestartProbe)} />
        <AppButton label="Read saved restart probe" disabled={busy} variant="secondary" onPress={() => run(readRestartProbe)} />
        <AppText accessibilityLiveRegion="polite" selectable>{busy ? 'Running database checks…' : output}</AppText>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({ content: { gap: spacing.lg } });
