import { Redirect } from 'expo-router';
import HomeDashboard from '../../dashboard/components/HomeDashboard.tsx';
import { useSettings } from '../../settings/providers/SettingsProvider.tsx';
import { useLocalAccount } from '../../account/providers/LocalAccountProvider.tsx';

/** Keep the existing Home URL and dashboard intact after the introduction. */
export default function HomeEntry() {
  const { preferences } = useSettings();
  const { state } = useLocalAccount();
  if (!state.ready) return null;
  if (!state.profile)
    return <Redirect href={preferences.welcomeCompleted ? '/sign-up' : '/welcome'} />;
  return <HomeDashboard />;
}
