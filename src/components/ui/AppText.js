import { Text } from 'react-native';
import { colors, typography } from '../../theme';

/** @param {import('react-native').TextProps & {variant?: keyof typeof typography, tone?: keyof typeof colors}} props */
export default function AppText({ variant = 'body', tone = 'text', style, ...props }) {
  return <Text {...props} style={[typography[variant], { color: colors[tone] }, style]} />;
}
