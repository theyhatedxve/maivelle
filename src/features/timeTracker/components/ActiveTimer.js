import { useCallback, useRef, useState } from 'react';
import { Alert, View } from 'react-native';
import { router } from 'expo-router';
import {
  Play,
  Pause,
  Square,
  History,
  ChartColumn,
  Folder,
} from 'lucide-react-native';
import { useDatabase } from '../../../database/DatabaseProvider';
import ScreenContainer from '../../../components/layout/ScreenContainer';
import AppHeader from '../../../components/layout/AppHeader';
import AppText from '../../../components/ui/AppText';
import AppButton from '../../../components/ui/AppButton';
import AppCard from '../../../components/ui/AppCard';
import { timeError, useTimeData } from '../hooks/useTimeTracker';
import {
  ProjectPicker,
  TimeError,
  TimeField,
  TimeLoading,
  TimeStorageNotice,
} from './TimeControls';
import TimerDisplay from './TimerDisplay';
import { styles } from './timeStyles';

export default function ActiveTimer() {
  const { timeTrackerService: service } = useDatabase();
  const load = useCallback(
    async () => ({
      active: await service.active(),
      projects: await service.projects(),
    }),
    [service]
  );
  const state = useTimeData(load);
  const [projectId, setProjectId] = useState('');
  const [title, setTitle] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const busy = useRef(false);
  const [recovery, setRecovery] = useState('');
  /** @param {()=>Promise<unknown>} action */
  async function run(action) {
    if (busy.current) return;
    busy.current = true;
    setSaving(true);
    setError('');
    try {
      await action();
      state.refresh();
    } catch (failure) {
      setError(timeError(failure));
    } finally {
      busy.current = false;
      setSaving(false);
    }
  }
  const active = state.data?.active;
  return (
    <ScreenContainer>
      <AppHeader
        title="Time Tracker"
        subtitle="One focused moment at a time"
        back
      />
      <TimeStorageNotice />
      <View style={styles.row}>
        <AppButton
          label="Activities"
          icon={Folder}
          variant="secondary"
          onPress={() => router.push('/timer/projects')}
        />
        <AppButton
          label="History"
          icon={History}
          variant="secondary"
          onPress={() => router.push('/timer/history')}
        />
        <AppButton
          label="Statistics"
          icon={ChartColumn}
          variant="secondary"
          onPress={() => router.push('/timer/statistics')}
        />
      </View>
      <TimeError message={state.error} onRetry={state.refresh} />
      <TimeError message={error} />
      {state.loading && <TimeLoading />}
      {state.data && (
        <View style={styles.section}>
          {active ? (
            <AppCard>
              <AppText variant="title">{active.title}</AppText>
              <AppText tone="muted">{active.project_name}</AppText>
              <TimerDisplay key={active.id} session={active} />
              <View style={styles.row}>
                <AppButton
                  label={
                    saving
                      ? 'Saving…'
                      : active.status === 'running'
                        ? 'Pause'
                        : 'Resume'
                  }
                  icon={active.status === 'running' ? Pause : Play}
                  disabled={saving}
                  onPress={() =>
                    void run(() =>
                      service.transition(
                        active,
                        active.status === 'running' ? 'pause' : 'resume'
                      )
                    )
                  }
                />
                <AppButton
                  label="Stop"
                  icon={Square}
                  variant="secondary"
                  disabled={saving}
                  onPress={() =>
                    void run(() => service.transition(active, 'stop'))
                  }
                />
                <AppButton
                  label="Discard session"
                  variant="secondary"
                  disabled={saving}
                  onPress={() =>
                    Alert.alert(
                      'Discard active session?',
                      'All time segments in this active session will be permanently removed.',
                      [
                        { text: 'Keep session', style: 'cancel' },
                        {
                          text: 'Discard',
                          style: 'destructive',
                          onPress: () =>
                            void run(() => service.remove(active, true)),
                        },
                      ]
                    )
                  }
                />
              </View>
              {active.status === 'running' && (
                <View style={styles.notice}>
                  <AppText variant="label">Recovery and clock accuracy</AppText>
                  <AppText>
                    Running time includes time while Maivelle is closed or the
                    phone is off. After reopening or rebooting, review this
                    estimate. Clock changes can affect it; no background service
                    measures time.
                  </AppText>
                  <AppText variant="caption">
                    Running segment started{' '}
                    {new Date(
                      active.segments.find((s) => s.end_ms === null)
                        ?.start_ms ?? 0
                    ).toISOString()}
                  </AppText>
                  <TimeField
                    label="Recovery end (UTC)"
                    value={recovery}
                    onChange={setRecovery}
                    disabled={saving}
                  />
                  <AppButton
                    label="Use current time"
                    variant="secondary"
                    disabled={saving}
                    onPress={() =>
                      setRecovery(
                        new Date(
                          Math.max(
                            Date.now(),
                            active.segments.find((s) => s.end_ms === null)
                              ?.start_ms ?? 0
                          )
                        ).toISOString()
                      )
                    }
                  />
                  <AppButton
                    label="End at reviewed time"
                    variant="secondary"
                    disabled={saving}
                    onPress={() =>
                      Alert.alert(
                        'End recovered session?',
                        'Save the running segment up to the UTC end time you entered.',
                        [
                          { text: 'Cancel', style: 'cancel' },
                          {
                            text: 'Save end time',
                            onPress: () =>
                              void run(() => service.recover(active, recovery)),
                          },
                        ]
                      )
                    }
                  />
                </View>
              )}
            </AppCard>
          ) : (
            <AppCard>
              <AppText variant="title">Ready to focus?</AppText>
              <ProjectPicker
                projects={state.data.projects}
                value={projectId}
                onChange={setProjectId}
                disabled={saving}
              />
              <TimeField
                label="Session title"
                value={title}
                onChange={setTitle}
                disabled={saving}
              />
              <AppButton
                label={saving ? 'Starting…' : 'Start timer'}
                icon={Play}
                disabled={saving || !!state.error}
                onPress={() => void run(() => service.start(projectId, title))}
              />
            </AppCard>
          )}
        </View>
      )}
      <AppButton
        label="Add manual time"
        variant="secondary"
        onPress={() => router.push('/timer/new')}
      />
    </ScreenContainer>
  );
}
