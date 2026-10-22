import { useTheme } from '../../../theme/ThemeProvider.tsx';
import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Pill, Plus } from 'lucide-react-native';
import AppHeader from '../../../components/layout/AppHeader.tsx';
import AppCard from '../../../components/ui/AppCard.tsx';
import AppText from '../../../components/ui/AppText.tsx';
import AppButton from '../../../components/ui/AppButton.tsx';
import EmptyState from '../../../components/ui/EmptyState.tsx';
import { useDatabase } from '../../../database/DatabaseProvider.tsx';
import { useMedicineQuery } from '../hooks/useMedicine.ts';
import {
  MedicineChip,
  MedicineError,
  MedicineStorageNotice,
  ReminderPermissions,
} from './MedicineControls.tsx';
import { useMedicineStyles } from './medicineStyles.ts';
export default function MedicineLibrary() {
  const styles = useMedicineStyles();
  const { colors } = useTheme();
  const { medicineService } = useDatabase();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('active');
  const query = useMedicineQuery(
    useCallback(() => medicineService.list(search, filter), [medicineService, search, filter]),
  );
  return (
    <SafeAreaView style={styles.safe}>
      <FlatList
        data={query.data ?? []}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        refreshing={query.loading}
        onRefresh={() => {
          void query.refresh();
        }}
        initialNumToRender={10}
        renderItem={({ item }) => (
          <AppCard
            onPress={() => router.push({ pathname: '/medicine/[id]', params: { id: item.id } })}
            accessibilityLabel={`Open ${item.name}`}
          >
            <AppText variant="heading">{item.name}</AppText>
            <AppText tone="muted">
              {item.form || 'Medication'} · {item.active ? 'Active' : 'Inactive'}
            </AppText>
            {item.instructions ? <AppText>{item.instructions}</AppText> : null}
          </AppCard>
        )}
        ListHeaderComponent={
          <View style={styles.section}>
            <AppHeader title="My medicines" subtitle="Private, local medication tracking" back />
            <MedicineStorageNotice />
            <View style={styles.row}>
              <AppButton
                label="Today's medications"
                icon={Pill}
                onPress={() => router.push('/medicine/today')}
              />
              <AppButton
                label="Add medicine"
                icon={Plus}
                onPress={() => router.push('/medicine/new')}
              />
            </View>
            <TextInput
              accessibilityLabel="Search medicines"
              placeholder="Search medicines and notes"
              placeholderTextColor={colors.muted}
              style={styles.input}
              value={search}
              onChangeText={setSearch}
              maxLength={500}
            />
            <View style={styles.row}>
              {['active', 'inactive', 'all'].map((value) => (
                <MedicineChip
                  key={value}
                  label={value[0].toUpperCase() + value.slice(1)}
                  selected={filter === value}
                  onPress={() => setFilter(value)}
                />
              ))}
            </View>
            <ReminderPermissions />
            {query.error ? (
              <MedicineError
                message={query.error}
                retry={() => {
                  void query.refresh();
                }}
              />
            ) : null}
          </View>
        }
        ListEmptyComponent={
          query.loading ? (
            <ActivityIndicator color={colors.primary} />
          ) : !query.error ? (
            <EmptyState
              icon={Pill}
              title="No medicines here"
              description="Add a fictional test medicine, or change your filters."
            />
          ) : undefined
        }
      />
    </SafeAreaView>
  );
}
