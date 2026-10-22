import { useState } from 'react';
import type { LucideIcon } from 'lucide-react-native';
import { Eye, EyeOff } from 'lucide-react-native';
import { Pressable, Text, TextInput, View } from 'react-native';
import type { TextInputProps } from 'react-native';
import { accountStyles as styles } from './accountStyles.ts';
import { useAccountLayout } from './AccountLayout.tsx';

type Props = TextInputProps & { label: string; icon: LucideIcon; secret?: boolean };

export default function AccountField({ label, icon: Icon, secret, ...input }: Props) {
  const [visible, setVisible] = useState(false);
  const { compressed } = useAccountLayout();
  return (
    <View style={[styles.field, compressed && styles.fieldCompact]}>
      {!compressed ? (
        <View style={styles.fieldIcon}>
          <Icon size={24} color="#7433D9" accessible={false} />
        </View>
      ) : null}
      <View style={[styles.fieldCopy, compressed && styles.fieldCopyCompact]}>
        <Text style={[styles.fieldLabel, compressed && styles.fieldLabelCompact]}>{label}</Text>
        <TextInput
          {...input}
          accessibilityLabel={label}
          style={[styles.input, compressed && styles.inputCompact]}
          placeholderTextColor="#8A7AAB"
          secureTextEntry={secret && !visible}
          autoCorrect={false}
        />
      </View>
      {secret ? (
        <Pressable
          onPress={() => setVisible((value) => !value)}
          accessibilityRole="button"
          accessibilityLabel={`${visible ? 'Hide' : 'Show'} ${label.toLowerCase()}`}
          style={styles.eye}
        >
          {visible ? (
            <EyeOff size={22} color="#78659B" accessible={false} />
          ) : (
            <Eye size={22} color="#78659B" accessible={false} />
          )}
        </Pressable>
      ) : null}
    </View>
  );
}
