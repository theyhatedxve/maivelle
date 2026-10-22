import { useTheme } from '../../theme/ThemeProvider.tsx';
import { Text } from 'react-native';
import { typography } from '../../theme/index.ts';

export type AppTextProps = import('react-native').TextProps & {
  variant?: keyof typeof typography;
  tone?: keyof typeof import('../../theme/colors.ts').colors;
};

export default function AppText({
  variant = 'body',
  tone = 'text',
  style,
  ...props
}: AppTextProps) {
  const { colors } = useTheme();
  return <Text {...props} style={[typography[variant], { color: colors[tone] }, style]} />;
}
