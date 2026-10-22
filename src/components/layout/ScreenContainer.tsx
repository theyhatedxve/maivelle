import { useThemedStyles } from '../../theme/ThemeProvider.tsx';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { spacing } from '../../theme/index.ts';

export type ScreenContainerProps = {
  children: import('react').ReactNode;
  tabScreen?: boolean;
};

export default function ScreenContainer({ children, tabScreen = false }: ScreenContainerProps) {
  const styles = useThemedStyles(makeStyles);
  return (
    <SafeAreaView
      style={styles.safe}
      edges={tabScreen ? ['top', 'left', 'right'] : ['top', 'left', 'right', 'bottom']}
    >
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.content}>{children}</View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const makeStyles = (colors: typeof import('../../theme/colors').colors) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    flex: { flex: 1 },
    scroll: { flexGrow: 1, padding: spacing.xl },
    content: { width: '100%', maxWidth: 960, alignSelf: 'center' },
  });
