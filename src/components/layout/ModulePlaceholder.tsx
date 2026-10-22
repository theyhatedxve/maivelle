import { router } from 'expo-router';
import AppHeader from './AppHeader.tsx';
import ScreenContainer from './ScreenContainer.tsx';
import AppButton from '../ui/AppButton.tsx';
import AppCard from '../ui/AppCard.tsx';
import AppText from '../ui/AppText.tsx';
import EmptyState from '../ui/EmptyState.tsx';

export type ModulePlaceholderProps = {
  title: string;
  icon: import('lucide-react-native').LucideIcon;
  description: string;
  tabScreen?: boolean;
  action?: import('react').ReactNode;
};

export default function ModulePlaceholder({
  title,
  icon,
  description,
  tabScreen = false,
  action,
}: ModulePlaceholderProps) {
  return (
    <ScreenContainer tabScreen={tabScreen}>
      <AppHeader title={title} subtitle="Your personal space" back={!tabScreen} />
      <AppCard>
        <AppText variant="caption" tone="primary">
          PHASE 2 · UI PREVIEW
        </AppText>
        <EmptyState
          icon={icon}
          title={`${title}, ready for what's next`}
          description={description}
          action={
            action || (
              <AppButton
                label="Back to Home"
                variant="secondary"
                onPress={() => router.replace('/')}
              />
            )
          }
        />
        <AppText variant="caption" tone="muted">
          This is a placeholder. No records are stored or processed yet.
        </AppText>
      </AppCard>
    </ScreenContainer>
  );
}
