import { useCallback, useRef, useState } from 'react';
import { Alert, View } from 'react-native';
import { usePreventRemove } from 'expo-router';
import ScreenContainer from '../../../components/layout/ScreenContainer';
import AppHeader from '../../../components/layout/AppHeader';
import AppCard from '../../../components/ui/AppCard';
import AppText from '../../../components/ui/AppText';
import AppButton from '../../../components/ui/AppButton';
import { useDatabase } from '../../../database/DatabaseProvider';
import { timeError, useTimeData } from '../hooks/useTimeTracker';
import { formatDuration } from '../services/timeAnalytics';
import {
  TimeChip,
  TimeError,
  TimeField,
  TimeLoading,
  TimeStorageNotice,
} from './TimeControls';
import { styles } from './timeStyles';

const blank = { name: '', description: '', color: '#6D42C7', archived: false };
export default function ProjectManager() {
  const { timeTrackerService: service } = useDatabase();
  const load = useCallback(() => service.projects(), [service]);
  const state = useTimeData(load);
  const [id, setId] = useState(/** @type {string|null} */ (null));
  const [form, setForm] = useState(blank);
  const [original, setOriginal] = useState(blank);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const busy = useRef(false);
  const dirty = JSON.stringify(form) !== JSON.stringify(original);
  usePreventRemove(!leaving && (dirty || saving), ({ repeat }) => {
    if (busy.current) return;
    Alert.alert(
      'Discard activity changes?',
      'Unsaved activity changes will be lost.',
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
  });
  /** @param {()=>Promise<unknown>} action */
  async function run(action) {
    if (busy.current) return;
    busy.current = true;
    setSaving(true);
    setError('');
    try {
      await action();
      setId(null);
      setForm(blank);
      setOriginal(blank);
      state.refresh();
    } catch (failure) {
      setError(timeError(failure));
    } finally {
      busy.current = false;
      setSaving(false);
    }
  }
  /** @param {()=>void} action */
  function replaceForm(action) {
    if (saving) return;
    if (!dirty) {
      action();
      return;
    }
    Alert.alert('Discard activity changes?', 'Unsaved changes will be lost.', [
      { text: 'Keep editing', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: action },
    ]);
  }
  return (
    <ScreenContainer>
      <AppHeader
        title="Activities"
        subtitle="Organize your tracked time"
        back
      />
      <TimeStorageNotice />
      <TimeError message={state.error} onRetry={state.refresh} />
      <TimeError message={error} />
      {state.loading && <TimeLoading />}
      <View style={styles.section}>
        <AppText variant="title">
          {id ? 'Edit activity' : 'New activity'}
        </AppText>
        <TimeField
          label="Activity name"
          value={form.name}
          onChange={(name) => setForm({ ...form, name })}
          disabled={saving}
        />
        <TimeField
          label="Activity description"
          value={form.description}
          onChange={(description) => setForm({ ...form, description })}
          multiline
          disabled={saving}
        />
        <TimeField
          label="Activity color (#RRGGBB)"
          value={form.color}
          onChange={(color) => setForm({ ...form, color })}
          disabled={saving}
        />
        <View style={styles.row}>
          {['#6D42C7', '#8B5CF6', '#2563EB', '#15803D', '#B45309'].map(
            (color) => (
              <TimeChip
                key={color}
                label={color}
                selected={form.color === color}
                disabled={saving}
                onPress={() => setForm({ ...form, color })}
              />
            )
          )}
        </View>
        <AppButton
          label={saving ? 'Saving…' : 'Save activity'}
          disabled={saving || state.loading || !!state.error}
          onPress={() => void run(() => service.saveProject(id, form))}
        />
        {id && (
          <AppButton
            label="New activity instead"
            variant="secondary"
            disabled={saving}
            onPress={() =>
              replaceForm(() => {
                setId(null);
                setForm(blank);
                setOriginal(blank);
              })
            }
          />
        )}
      </View>
      {!state.loading && !state.error && !state.data?.length && (
        <AppText tone="muted">
          No activities yet. Create one above to start tracking.
        </AppText>
      )}
      {state.data?.map((project) => (
        <View key={project.id} style={styles.section}>
          <AppCard>
            <View style={styles.row}>
              <View
                style={[styles.color, { backgroundColor: project.color }]}
              />
              <AppText variant="title">{project.name}</AppText>
            </View>
            <AppText>{project.description}</AppText>
            <AppText tone="muted">
              {formatDuration(project.total_ms)} tracked ·{' '}
              {project.archived ? 'Archived' : 'Active'}
            </AppText>
            <View style={styles.row}>
              <AppButton
                label={`Edit ${project.name}`}
                variant="secondary"
                disabled={saving}
                onPress={() =>
                  replaceForm(() => {
                    const value = {
                      name: project.name,
                      description: project.description,
                      color: project.color,
                      archived: !!project.archived,
                    };
                    setId(project.id);
                    setForm(value);
                    setOriginal(value);
                  })
                }
              />
              <AppButton
                label={
                  project.archived ? 'Restore activity' : 'Archive activity'
                }
                variant="secondary"
                disabled={saving}
                onPress={() =>
                  replaceForm(
                    () =>
                      void run(() =>
                        service.saveProject(project.id, {
                          ...project,
                          archived: !project.archived,
                        })
                      )
                  )
                }
              />
              <AppButton
                label="Delete activity"
                variant="secondary"
                disabled={saving}
                onPress={() =>
                  replaceForm(() =>
                    Alert.alert(
                      'Delete activity?',
                      'Session history will remain with the original activity name. An active timer must be stopped first.',
                      [
                        { text: 'Cancel', style: 'cancel' },
                        {
                          text: 'Delete',
                          style: 'destructive',
                          onPress: () =>
                            void run(() => service.deleteProject(project.id)),
                        },
                      ]
                    )
                  )
                }
              />
            </View>
          </AppCard>
        </View>
      ))}
    </ScreenContainer>
  );
}
