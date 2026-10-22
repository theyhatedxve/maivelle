import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CalendarDays, ChevronDown, Clock3 } from 'lucide-react-native';
import AppText from '../../../components/ui/AppText.tsx';
import AppButton from '../../../components/ui/AppButton.tsx';
import { useTheme } from '../../../theme/ThemeProvider.tsx';
import { addMonths, localToday, validateDate, visibleRange } from '../services/calendarDates.ts';
import { planDateLabel, planTime } from '../services/planPresentation.ts';
import { calendarError } from '../hooks/useCalendar.ts';
import CalendarBoard from './CalendarBoard.tsx';
import EventTimePicker from './EventTimePicker.tsx';
import { PlanDateNavigation } from './PlanControls.tsx';
import { usePlanStyles } from './planStyles.ts';

type Props = {
  label: string;
  value: string;
  kind: 'date' | 'time';
  onChange: (value: string) => void;
  disabled: boolean;
};
export default function EventDateTimeField({ label, value, kind, onChange, disabled }: Props) {
  const styles = usePlanStyles();
  const { colors } = useTheme();
  const [visible, setVisible] = useState(false);
  const [draft, setDraft] = useState(value);
  const [month, setMonth] = useState(() => localToday());
  const [error, setError] = useState('');
  const Icon = kind === 'date' ? CalendarDays : Clock3;
  function open() {
    setDraft(value);
    setError('');
    if (kind === 'date') {
      try {
        setMonth(validateDate(value));
      } catch {
        setMonth(localToday());
      }
    }
    setVisible(true);
  }
  function apply() {
    try {
      if (kind === 'date') validateDate(draft);
      else if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(draft))
        throw new Error('Enter a 24-hour time as HH:mm, for example 14:30.');
      onChange(draft);
      setVisible(false);
    } catch (failure) {
      setError(calendarError(failure));
    }
  }
  return (
    <View style={styles.formGroup}>
      <AppText variant="label">{label}</AppText>
      <Pressable
        style={styles.fieldRow}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${value}`}
        onPress={open}
        disabled={disabled}
        accessibilityState={{ disabled }}
      >
        <View style={styles.fieldIcon}>
          <Icon color={colors.primary} size={20} accessible={false} />
        </View>
        <AppText style={styles.dateValue}>
          {kind === 'date' ? planDateLabel(value) : planTime(`2000-01-01T${value}`)}
        </AppText>
        <ChevronDown color={colors.muted} size={16} accessible={false} />
      </Pressable>
      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={() => setVisible(false)}
      >
        <SafeAreaView style={styles.safe}>
          <KeyboardAvoidingView
            style={styles.modalBackdrop}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          >
            <View style={styles.modal}>
              <ScrollView
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={styles.section}
              >
                <AppText variant="heading" accessibilityRole="header">
                  {label}
                </AppText>
                {kind === 'date' ? (
                  <>
                    <PlanDateNavigation
                      mode="month"
                      label={visibleRange('month', month).label}
                      onNavigate={(direction) => {
                        try {
                          setMonth(validateDate(addMonths(month, direction)));
                          setError('');
                        } catch (failure) {
                          setError(calendarError(failure));
                        }
                      }}
                      onToday={() => {
                        setMonth(localToday());
                        setDraft(localToday());
                      }}
                    />
                    <CalendarBoard
                      days={visibleRange('month', month).days}
                      displayMonth={month.slice(0, 7)}
                      selected={draft}
                      entries={[]}
                      categories={[]}
                      onSelect={(day) => {
                        try {
                          validateDate(day);
                          setDraft(day);
                          setError('');
                        } catch (failure) {
                          setError(calendarError(failure));
                        }
                      }}
                    />
                  </>
                ) : null}
                {kind === 'date' ? (
                  <>
                    <AppText variant="caption" tone="muted">
                      Or enter a date as YYYY-MM-DD.
                    </AppText>
                    <TextInput
                      accessibilityLabel={`${label} YYYY-MM-DD`}
                      value={draft}
                      onChangeText={setDraft}
                      maxLength={10}
                      style={[styles.fieldRow, { color: colors.text }]}
                      placeholder="YYYY-MM-DD"
                      placeholderTextColor={colors.muted}
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                  </>
                ) : (
                  <EventTimePicker value={draft} onChange={setDraft} />
                )}
                {error ? <AppText accessibilityRole="alert">{error}</AppText> : null}
                <AppButton label="Apply" onPress={apply} />
                <AppButton label="Cancel" variant="secondary" onPress={() => setVisible(false)} />
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </View>
  );
}
