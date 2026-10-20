import { useEffect, useRef, useState } from 'react';
import { Alert, View } from 'react-native';
import { router, usePreventRemove } from 'expo-router';
import ScreenContainer from '../../../components/layout/ScreenContainer';
import AppHeader from '../../../components/layout/AppHeader';
import AppText from '../../../components/ui/AppText';
import AppButton from '../../../components/ui/AppButton';
import { useDatabase } from '../../../database/DatabaseProvider';
import { timeError } from '../hooks/useTimeTracker';
import {
  ProjectPicker,
  TimeError,
  TimeField,
  TimeLoading,
  TimeStorageNotice,
} from './TimeControls';
import { styles } from './timeStyles';

/** @param {{id:string|null}} props */
export default function SessionEditor({ id }) {
  const { timeTrackerService: service } = useDatabase();
  const [form, setForm] = useState(
    /** @type {import('../validation/timeInput.js').SessionInput} */ ({
      title: '',
      projectId: '',
      segments: [],
    })
  );
  const [original, setOriginal] = useState('');
  const [projects, setProjects] = useState(
    /** @type {import('../../../database/repositories/timeTrackerRepository.js').TimeProject[]} */ ([])
  );
  const [session, setSession] = useState(
    /** @type {import('../../../database/repositories/timeTrackerRepository.js').TimeSession|null} */ (
      null
    )
  );
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const busy = useRef(false);
  const dirty = loaded && JSON.stringify(form) !== original;
  const disable = usePreventRemove(
    !leaving && (dirty || saving),
    ({ repeat }) => {
      if (busy.current) return;
      Alert.alert(
        'Discard session changes?',
        'Your unsaved changes will be lost.',
        [
          { text: 'Keep editing', style: 'cancel' },
          {
            text: 'Discard',
            style: 'destructive',
            onPress: () => {
              setLeaving(true);
              repeat();
            },
          },
        ]
      );
    }
  );
  useEffect(() => {
    let active = true;
    Promise.all([
      id !== null && /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(id)
        ? service.get(id)
        : Promise.resolve(null),
      service.projects(),
    ])
      .then(([record, groups]) => {
        if (!active) return;
        if (id !== null && !record) {
          setNotFound(true);
          return;
        }
        if (record && record.status !== 'completed') {
          setError('Stop the active timer before editing its history.');
          return;
        }
        const end = Date.now();
        const value = {
          title: record?.title ?? '',
          projectId: record?.project_id ?? '',
          segments: record
            ? record.segments.map((s) => ({
                start: new Date(s.start_ms).toISOString(),
                end: new Date(s.end_ms ?? s.start_ms).toISOString(),
              }))
            : [
                {
                  start: new Date(end - 1800000).toISOString(),
                  end: new Date(end).toISOString(),
                },
              ],
        };
        setSession(record);
        setProjects(groups);
        setForm(value);
        setOriginal(JSON.stringify(value));
        setLoaded(true);
        setError('');
      })
      .catch((failure) => {
        if (active) setError(timeError(failure));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id, service, attempt]);
  async function save() {
    if (busy.current || !loaded) return;
    busy.current = true;
    setSaving(true);
    setError('');
    try {
      await service.saveSession(id, session?.revision ?? null, form);
      setLeaving(true);
      disable();
      router.dismissTo('/timer/history');
    } catch (failure) {
      setError(timeError(failure));
    } finally {
      busy.current = false;
      setSaving(false);
    }
  }
  function remove() {
    if (!session || busy.current) return;
    const record = session;
    Alert.alert(
      'Delete session?',
      'This permanently deletes the session and all its segments.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            if (busy.current) return;
            busy.current = true;
            setSaving(true);
            try {
              await service.remove(record);
              setLeaving(true);
              disable();
              router.dismissTo('/timer/history');
            } catch (failure) {
              setError(timeError(failure));
            } finally {
              busy.current = false;
              setSaving(false);
            }
          },
        },
      ]
    );
  }
  return (
    <ScreenContainer>
      <AppHeader
        title={id ? 'Edit session' : 'Manual time entry'}
        subtitle="Local session history"
        back
      />
      <TimeStorageNotice />
      <TimeError
        message={error}
        onRetry={
          !loaded
            ? () => {
                setLoading(true);
                setAttempt((n) => n + 1);
              }
            : undefined
        }
      />
      {loading && <TimeLoading />}
      {notFound && <AppText>Session not found. Return to History.</AppText>}
      {loaded && (
        <View style={styles.section}>
          <TimeField
            label="Session title"
            value={form.title}
            onChange={(title) => setForm({ ...form, title })}
            disabled={saving}
          />
          {session && !session.project_id && (
            <AppText>
              The original activity was deleted. Choose an activity to reassign
              this session when saving.
            </AppText>
          )}
          <ProjectPicker
            projects={projects}
            retainArchivedSelection={!!session}
            value={form.projectId}
            onChange={(projectId) => setForm({ ...form, projectId })}
            disabled={saving}
          />
          <AppText variant="label">
            {session?.type === 'timer'
              ? 'Timer segments (pauses remain excluded)'
              : 'Manual time span'}
          </AppText>
          <AppText tone="muted">
            Enter UTC instants as YYYY-MM-DDTHH:mm:ss.sssZ. Z means UTC, not
            local time. Equal start/end records zero time. Future or overlapping
            segments are rejected.
          </AppText>
          {form.segments.map((segment, index) => (
            <View key={index} style={styles.notice}>
              <AppText variant="label">Segment {index + 1}</AppText>
              <TimeField
                label={`Segment ${index + 1} start (UTC)`}
                value={segment.start}
                disabled={saving}
                onChange={(start) =>
                  setForm({
                    ...form,
                    segments: form.segments.map((s, i) =>
                      i === index ? { ...s, start } : s
                    ),
                  })
                }
              />
              <TimeField
                label={`Segment ${index + 1} end (UTC)`}
                value={segment.end}
                disabled={saving}
                onChange={(end) =>
                  setForm({
                    ...form,
                    segments: form.segments.map((s, i) =>
                      i === index ? { ...s, end } : s
                    ),
                  })
                }
              />
            </View>
          ))}
          <AppButton
            label={saving ? 'Saving…' : 'Save session'}
            disabled={saving}
            onPress={() => void save()}
          />
          {session && (
            <AppButton
              label="Delete session"
              disabled={saving}
              variant="secondary"
              onPress={remove}
            />
          )}
          <AppButton
            label="Manage activities"
            variant="secondary"
            disabled={saving}
            onPress={() => router.push('/timer/projects')}
          />
        </View>
      )}
    </ScreenContainer>
  );
}
