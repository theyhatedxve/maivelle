import { router } from 'expo-router';
import { MapPinOff } from 'lucide-react-native';
import ScreenContainer from '../components/layout/ScreenContainer.tsx';
import AppHeader from '../components/layout/AppHeader.tsx';
import AppButton from '../components/ui/AppButton.tsx';
import EmptyState from '../components/ui/EmptyState.tsx';
export default function NotFoundScreen() {
  return (
    <ScreenContainer>
      <AppHeader title="Page not found" back />
      <EmptyState
        icon={MapPinOff}
        title="Let's find your way home"
        description="This page doesn't exist in Maivelle."
        action={<AppButton label="Go to Home" onPress={() => router.replace('/')} />}
      />
    </ScreenContainer>
  );
}
