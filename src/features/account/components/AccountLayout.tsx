import { createContext, useContext } from 'react';
import type { PropsWithChildren } from 'react';
import { Text } from 'react-native';
import { accountStyles } from './accountStyles.ts';

export const AccountLayoutContext = createContext({ compressed: false, typing: false });
export const useAccountLayout = () => useContext(AccountLayoutContext);

/** Optional explanation yields room to inputs and actions when the keyboard is open. */
export function AccountHint({ children }: PropsWithChildren) {
  const { typing } = useAccountLayout();
  return typing ? null : <Text style={accountStyles.message}>{children}</Text>;
}
