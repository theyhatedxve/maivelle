import { createContext, useContext, useMemo } from 'react';
import { useColorScheme } from 'react-native';
import { colors, darkColors } from './colors.ts';

export type ThemeProviderProps = {
  children: import('react').ReactNode;
  appearance: 'light' | 'dark' | 'system';
};

const initial: {
  colors: typeof colors;
  dark: boolean;
} = {
  colors,
  dark: false,
};
const ThemeContext = createContext(initial);

export default function ThemeProvider({ children, appearance }: ThemeProviderProps) {
  const system = useColorScheme();
  const dark = appearance === 'dark' || (appearance === 'system' && system === 'dark');
  const value = useMemo(() => ({ colors: dark ? darkColors : colors, dark }), [dark]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
export const useTheme = () => useContext(ThemeContext);

export function useThemedStyles<T>(factory: (palette: typeof colors) => T): T {
  const { colors: palette } = useTheme();
  return useMemo(() => factory(palette), [factory, palette]);
}
