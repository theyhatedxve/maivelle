import { ActivityIndicator, Pressable, TextInput, View } from 'react-native';
import AppText from '../../../components/ui/AppText';
import AppButton from '../../../components/ui/AppButton';
import { colors } from '../../../theme';
import { styles } from './timeStyles';

/** @param {{label:string,value:string,onChange:(value:string)=>void,multiline?:boolean,disabled?:boolean}} props */
export function TimeField({
  label,
  value,
  onChange,
  multiline = false,
  disabled = false,
}) {
  return (
    <View style={styles.section}>
      <AppText variant="label">{label}</AppText>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChange}
        style={styles.input}
        multiline={multiline}
        editable={!disabled}
        autoCapitalize="none"
        autoCorrect={false}
      />
    </View>
  );
}
/** @param {{label:string,selected:boolean,onPress:()=>void,disabled?:boolean}} props */
export function TimeChip({ label, selected, onPress, disabled = false }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[styles.chip, selected && styles.selected]}
    >
      <AppText tone={selected ? 'primary' : 'text'}>{label}</AppText>
    </Pressable>
  );
}
/** @param {{projects:import('../../../database/repositories/timeTrackerRepository.js').TimeProject[],value:string,onChange:(value:string)=>void,filter?:boolean,disabled?:boolean,includeArchived?:boolean,retainArchivedSelection?:boolean}} props */
export function ProjectPicker({
  projects,
  value,
  onChange,
  filter = false,
  disabled = false,
  includeArchived = false,
  retainArchivedSelection = false,
}) {
  const choices = projects.filter(
    (p) =>
      includeArchived ||
      !p.archived ||
      (retainArchivedSelection && p.id === value)
  );
  return (
    <View style={styles.section}>
      <AppText variant="label">Activity</AppText>
      <View style={styles.row}>
        {filter && (
          <TimeChip
            label="All activities"
            selected={!value}
            onPress={() => onChange('')}
            disabled={disabled}
          />
        )}
        {choices.map((p) => (
          <TimeChip
            key={p.id}
            label={`${p.name}${p.archived ? ' (archived)' : ''}`}
            selected={value === p.id}
            onPress={() => onChange(p.id)}
            disabled={disabled}
          />
        ))}
      </View>
      {!choices.length && (
        <AppText tone="muted">Create an activity first.</AppText>
      )}
      {!choices.length && projects.length > 0 && (
        <AppText tone="muted">
          Or restore an archived activity in Activities.
        </AppText>
      )}
    </View>
  );
}
export function TimeStorageNotice() {
  return (
    <View style={styles.notice}>
      <AppText variant="caption" tone="muted">
        Development storage is not encrypted. Use nonsensitive test activities
        only.
      </AppText>
    </View>
  );
}
/** @param {{message:string,onRetry?:()=>void}} props */
export function TimeError({ message, onRetry }) {
  return message ? (
    <View style={styles.notice} accessibilityLiveRegion="polite">
      <AppText>{message}</AppText>
      {onRetry && (
        <AppButton label="Try again" variant="secondary" onPress={onRetry} />
      )}
    </View>
  ) : null;
}
export function TimeLoading() {
  return (
    <ActivityIndicator
      accessibilityLabel="Loading time tracker"
      color={colors.primary}
    />
  );
}
