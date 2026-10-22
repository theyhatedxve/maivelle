import SettingsFrame, { useSettingsAction } from './SettingsFrame.tsx';
import { useSettings } from '../providers/SettingsProvider.tsx';
import { useTheme } from '../../../theme/ThemeProvider.tsx';
import AppText from '../../../components/ui/AppText.tsx';
import AppButton from '../../../components/ui/AppButton.tsx';
import AppCard from '../../../components/ui/AppCard.tsx';
export default function AppearanceSettings() {
  const { preferences, save } = useSettings();
  const { dark } = useTheme();
  const action = useSettingsAction();
  return (
    <SettingsFrame title="Appearance">
      <AppText tone="muted">
        Choose a theme, or follow Android. Purple accents remain consistent across modules.
      </AppText>
      {['light', 'dark', 'system'].map((theme) => (
        <AppButton
          key={theme}
          label={`${theme[0].toUpperCase() + theme.slice(1)}${preferences.appearance === theme ? ' — selected' : ''}`}
          variant={preferences.appearance === theme ? 'primary' : 'secondary'}
          disabled={action.busy}
          onPress={() => {
            void action.run(() => save('appearance', theme));
          }}
        />
      ))}
      <AppCard>
        <AppText variant="title">Maivelle</AppText>
        <AppText>Preview: {dark ? 'Dark' : 'Light'}</AppText>
        <AppText tone="muted">Soft surfaces, clear text and familiar purple controls.</AppText>
      </AppCard>
      <AppText accessibilityLiveRegion="polite">{action.message}</AppText>
    </SettingsFrame>
  );
}
