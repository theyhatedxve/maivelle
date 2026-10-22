import { useThemedStyles } from '../../../theme/ThemeProvider.tsx';
import { useCallback, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { LockKeyhole, Plus, Settings, Star } from 'lucide-react-native';
import AppHeader from '../../../components/layout/AppHeader.tsx';
import AppText from '../../../components/ui/AppText.tsx';
import AppButton from '../../../components/ui/AppButton.tsx';
import AppCard from '../../../components/ui/AppCard.tsx';
import { spacing } from '../../../theme/index.ts';
import VaultField from './VaultField.tsx';
import { useVault } from '../providers/VaultProvider.tsx';
export default function VaultLibrary() {
  const styles = useThemedStyles(makeStyles);
  const { service } = useVault();
  const [items, setItems] = useState([] as Awaited<ReturnType<typeof service.list>>);
  const [search, setSearch] = useState('');
  const [favorites, setFavorites] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoading(true);
      const timer = setTimeout(() => {
        service
          .list()
          .then((rows) => {
            if (active) {
              setItems(rows);
              setError('');
            }
          })
          .catch((failure) => {
            if (active)
              setError(failure instanceof Error ? failure.message : 'Vault could not load.');
          })
          .finally(() => {
            if (active) setLoading(false);
          });
      }, 0);
      return () => {
        active = false;
        clearTimeout(timer);
        setItems([]);
        setSearch('');
      };
    }, [service]),
  );
  const needle = search.toLocaleLowerCase();
  const shown = items.filter(
    (item) =>
      (!favorites || item.favorite) &&
      [item.accountName, item.username, item.email, item.category].some((value) =>
        value.toLocaleLowerCase().includes(needle),
      ),
  );
  return (
    <SafeAreaView style={styles.safe}>
      <FlatList
        data={shown}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <View style={styles.header}>
            <AppHeader title="Vault" back />
            <AppText variant="heading">Your accounts</AppText>
            <AppText tone="muted">
              Encrypted payloads · Fictional records only until broader security review.
            </AppText>
            <VaultField
              label="Search unlocked accounts"
              value={search}
              onChange={setSearch}
              maxLength={320}
            />
            <AppButton
              label={favorites ? 'Show all accounts' : 'Favorites only'}
              icon={Star}
              variant="secondary"
              onPress={() => setFavorites(!favorites)}
            />
            <AppButton
              label="Create credential"
              icon={Plus}
              onPress={() => router.push('/vault/new')}
            />
            <AppButton
              label="Vault security and backup"
              icon={Settings}
              variant="secondary"
              onPress={() => router.push('/vault/security')}
            />
            <AppButton
              label="Lock Vault"
              icon={LockKeyhole}
              variant="secondary"
              onPress={() => service.lock()}
            />
            {!!error && <AppText>{error}</AppText>}
          </View>
        }
        ListEmptyComponent={
          <AppText>
            {loading
              ? 'Decrypting accounts…'
              : error
                ? 'Unlock again or investigate damaged data. No records were reset.'
                : 'No matching accounts. Create your first fictional credential.'}
          </AppText>
        }
        renderItem={({ item }) => (
          <AppCard
            style={styles.card}
            onPress={() => router.push(`/vault/${item.id}`)}
            accessibilityLabel={`Open credential ${item.accountName}`}
          >
            <AppText variant="heading">
              {item.favorite ? '★ ' : ''}
              {item.accountName}
            </AppText>
            <AppText>{item.username || 'No username'}</AppText>
            <AppText tone="muted">{item.category || 'Uncategorized'}</AppText>
          </AppCard>
        )}
      />
    </SafeAreaView>
  );
}

const makeStyles = (colors: typeof import('../../../theme/colors').colors) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    content: { padding: spacing.xl, gap: spacing.md },
    header: { gap: spacing.md },
    card: { gap: spacing.sm },
  });
