import { useCallback, useRef, useState } from 'react';
import { FlatList, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { Plus, Clock } from 'lucide-react-native';
import AppHeader from '../../../components/layout/AppHeader';
import AppCard from '../../../components/ui/AppCard';
import AppText from '../../../components/ui/AppText';
import AppButton from '../../../components/ui/AppButton';
import EmptyState from '../../../components/ui/EmptyState';
import { useDatabase } from '../../../database/DatabaseProvider';
import { timeError, useTimeData } from '../hooks/useTimeTracker';
import { formatDuration } from '../services/timeAnalytics';
import {
  ProjectPicker,
  TimeChip,
  TimeError,
  TimeField,
  TimeLoading,
  TimeStorageNotice,
} from './TimeControls';
import { styles } from './timeStyles';
import { instant } from '../validation/timeInput';

export default function SessionHistory() {
  const { timeTrackerService: service } = useDatabase();
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [projectId, setProjectId] = useState('');
  const [type, setType] = useState('all');
  const [rows, setRows] = useState(
    /** @type {Awaited<ReturnType<typeof service.history>>} */ ([])
  );
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [more, setMore] = useState(false);
  const [applied, setApplied] = useState(
    /** @type {import('../../../database/repositories/timeTrackerRepository.js').HistoryQuery} */ ({})
  );
  const sequence = useRef(0);
  const busy = useRef(false);
  const projectLoad = useCallback(() => service.projects(), [service]);
  const projects = useTimeData(projectLoad);
  const load = useCallback(
    async (offset = 0) => {
      if (offset && busy.current) return;
      const request = offset ? sequence.current : ++sequence.current;
      busy.current = true;
      setLoading(true);
      try {
        const records = await service.history({
          ...applied,
          offset,
          limit: 50,
        });
        if (request === sequence.current) {
          setRows((old) =>
            offset
              ? [
                  ...old,
                  ...records.filter((r) => !old.some((o) => o.id === r.id)),
                ]
              : records
          );
          setMore(records.length === 50);
          setError('');
        }
      } catch (failure) {
        if (request === sequence.current) {
          setError(timeError(failure));
          setMore(false);
        }
      } finally {
        if (request === sequence.current) {
          setLoading(false);
          busy.current = false;
        }
      }
    },
    [service, applied]
  );
  useFocusEffect(
    useCallback(() => {
      const first = setTimeout(() => void load(), 0);
      const unsubscribe = service.subscribe(() => void load());
      return () => {
        clearTimeout(first);
        unsubscribe();
        sequence.current++;
        busy.current = false;
      };
    }, [load, service])
  );
  function apply() {
    try {
      const start = from ? instant(from) : 0;
      const end = to ? instant(to) : 253402300799999;
      if (end <= start) throw new Error('Range end must be after its start.');
      setApplied({
        from: start,
        to: end,
        projectId: projectId || undefined,
        type,
      });
    } catch (failure) {
      setError(timeError(failure));
    }
  }
  return (
    <SafeAreaView
      style={styles.safe}
      edges={['top', 'left', 'right', 'bottom']}
    >
      <FlatList
        data={rows}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        refreshing={loading && rows.length > 0}
        onRefresh={() => void load()}
        onEndReached={() => {
          if (more && !error) void load(rows.length);
        }}
        onEndReachedThreshold={0.3}
        ListHeaderComponent={
          <View style={styles.section}>
            <AppHeader
              title="Session history"
              subtitle="All saved sessions on this device"
              back
            />
            <TimeStorageNotice />
            <AppButton
              label="Add manual time"
              icon={Plus}
              onPress={() => router.push('/timer/new')}
            />
            <ProjectPicker
              projects={projects.data ?? []}
              value={projectId}
              onChange={setProjectId}
              filter
              includeArchived
            />
            <View style={styles.row}>
              {['all', 'timer', 'manual'].map((value) => (
                <TimeChip
                  key={value}
                  label={`${value[0].toUpperCase()}${value.slice(1)} sessions`}
                  selected={type === value}
                  onPress={() => setType(value)}
                />
              ))}
            </View>
            <TimeField
              label="Range start (UTC, optional)"
              value={from}
              onChange={setFrom}
            />
            <TimeField
              label="Range end (UTC, exclusive, optional)"
              value={to}
              onChange={setTo}
            />
            <AppButton
              label="Apply history filters"
              variant="secondary"
              onPress={apply}
            />
            <AppText variant="caption" tone="muted">
              Times use YYYY-MM-DDTHH:mm:ss.sssZ. Matching sessions show their
              complete active duration.
            </AppText>
            <TimeError message={error} onRetry={() => void load()} />
            <TimeError message={projects.error} onRetry={projects.refresh} />
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.section}>
            <AppCard
              onPress={() =>
                router.push({
                  pathname: '/timer/[id]',
                  params: { id: item.id },
                })
              }
              accessibilityLabel={`Edit session ${item.title}`}
            >
              <AppText variant="title">{item.title}</AppText>
              <AppText>
                {item.project_name} ·{' '}
                {item.type === 'manual' ? 'Manual entry' : 'Timer session'}
              </AppText>
              <AppText tone="primary">
                {formatDuration(item.duration_ms)}
              </AppText>
              <AppText variant="caption" tone="muted">
                {new Date(item.start_ms).toLocaleString()} —{' '}
                {new Date(item.end_ms).toLocaleString()}
              </AppText>
            </AppCard>
          </View>
        )}
        ListEmptyComponent={
          loading ? (
            <TimeLoading />
          ) : !error ? (
            <EmptyState
              icon={Clock}
              title="No sessions"
              description="Start a timer or add a manual entry. Try another filter if you have history."
            />
          ) : undefined
        }
        ListFooterComponent={
          loading && rows.length ? <TimeLoading /> : undefined
        }
      />
    </SafeAreaView>
  );
}
