import { useCallback, useRef, useState } from 'react';
import { AppState, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import AppText from '../../../components/ui/AppText';
import { formatDuration } from '../services/timeAnalytics.js';
import { styles } from './timeStyles';

/** Display-only interval; persisted segment starts and ends are the source of truth.
 * @param {{session:import('../../../database/repositories/timeTrackerRepository.js').TimeSession}} props */
export default function TimerDisplay({ session }) {
  const [now, setNow] = useState(() => Date.now());
  const [clockWarning, setClockWarning] = useState(false);
  const baseline = useRef(/** @type {{wall:number,mono:number}|null} */ (null));
  useFocusEffect(
    useCallback(() => {
      const tick = () => {
        const wall = Date.now();
        const mono = performance.now();
        if (!baseline.current) baseline.current = { wall, mono };
        if (
          Math.abs(
            wall - baseline.current.wall - (mono - baseline.current.mono)
          ) > 5000
        )
          setClockWarning(true);
        setNow(wall);
      };
      const first = setTimeout(tick, 0);
      let interval =
        AppState.currentState === 'active'
          ? setInterval(tick, 1000)
          : undefined;
      const subscription = AppState.addEventListener('change', (state) => {
        clearInterval(interval);
        interval = undefined;
        if (state === 'active') {
          tick();
          interval = setInterval(tick, 1000);
        }
      });
      return () => {
        clearTimeout(first);
        clearInterval(interval);
        subscription.remove();
      };
    }, [])
  );
  const duration = session.segments.reduce(
    (sum, segment) =>
      sum + Math.max(0, (segment.end_ms ?? now) - segment.start_ms),
    0
  );
  return (
    <View style={styles.section}>
      <AppText
        style={styles.clock}
        accessibilityLabel={`Elapsed ${formatDuration(duration)}`}
      >
        {formatDuration(duration)}
      </AppText>
      <AppText tone="primary">
        {session.status === 'running' ? 'Running' : 'Paused'}
      </AppText>
      {(clockWarning ||
        session.segments.some((segment) => segment.start_ms > now)) && (
        <AppText>
          Clock change detected. Elapsed time is provisional; review the end
          time below.
        </AppText>
      )}
    </View>
  );
}
