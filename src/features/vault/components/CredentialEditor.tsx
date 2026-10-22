import { useEffect, useState } from 'react';
import { router, usePreventRemove } from 'expo-router';
import ScreenContainer from '../../../components/layout/ScreenContainer.tsx';
import AppHeader from '../../../components/layout/AppHeader.tsx';
import AppText from '../../../components/ui/AppText.tsx';
import AppButton from '../../../components/ui/AppButton.tsx';
import VaultField from './VaultField.tsx';
import { confirmVaultAction } from './confirmVaultAction.ts';
import { useVault } from '../providers/VaultProvider.tsx';
import { copyVaultPassword } from '../../../services/security/vaultClipboard.native.ts';

export type CredentialEditorProps = {
  id?: string;
};

const empty = {
  accountName: '',
  username: '',
  email: '',
  password: '',
  website: '',
  notes: '',
  category: '',
  favorite: false,
};

export default function CredentialEditor({ id }: CredentialEditorProps) {
  const { service, state } = useVault();
  const [value, setValue] = useState({ ...empty });
  const [dirty, setDirty] = useState(false);
  const [record, setRecord] = useState(
    null as Pick<
      import('../services/types').CredentialItem,
      'id' | 'revision' | 'createdAt' | 'updatedAt'
    > | null,
  );
  const [loading, setLoading] = useState(!!id);
  const [error, setError] = useState('');
  const [visible, setVisible] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [length, setLength] = useState('24');
  const [groups, setGroups] = useState(['lower', 'upper', 'digits', 'symbols']);
  useEffect(() => {
    let active = true;
    if (id)
      service
        .get(id)
        .then((item) => {
          if (!active) return;
          if (!item) {
            setError('Credential not found.');
            return;
          }
          setRecord({
            id: item.id,
            revision: item.revision,
            createdAt: item.createdAt,
            updatedAt: item.updatedAt,
          });
          const { id: ignoredId, revision, createdAt, updatedAt, ...fields } = item;
          void ignoredId;
          void revision;
          void createdAt;
          void updatedAt;
          setValue(fields);
          setDirty(false);
        })
        .catch((failure) => {
          if (active)
            setError(failure instanceof Error ? failure.message : 'Could not load credential.');
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    return () => {
      active = false;
    };
  }, [id, service]);
  // Lock must always be able to remove secret screens; only user navigation asks.
  const disablePrevention = usePreventRemove(dirty && !leaving && !state.locked, ({ repeat }) =>
    confirmVaultAction(service, {
      title: 'Discard unsaved changes?',
      message: 'Your unsaved credential changes will be lost.',
      label: 'Discard',
      action: () => {
        setLeaving(true);
        repeat();
      },
    }),
  );

  const change = (field: keyof typeof empty, text: string | boolean) => {
    setDirty(true);
    setValue((current) => ({ ...current, [field]: text }));
  };
  async function save() {
    setError('');
    try {
      await service.save(value, record ? { id: record.id, revision: record.revision } : null);
      setDirty(false);
      setLeaving(true);
      disablePrevention();
      router.dismissTo('/vault');
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Could not save credential.');
    }
  }
  async function generate() {
    try {
      const password = await service.generatePassword(Number(length), groups);
      setDirty(true);
      setValue((current) => ({ ...current, password }));
      setVisible(false);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Generation failed.');
    }
  }
  const blocked = loading || state.busy || (!!id && !record);
  return (
    <ScreenContainer>
      <AppHeader title={id ? 'Credential details' : 'Create credential'} back />
      <AppText variant="heading">
        {loading ? 'Loading credential…' : id ? 'View and edit account' : 'New fictional account'}
      </AppText>
      {!!error && <AppText accessibilityLiveRegion="polite">{error}</AppText>}
      {Object.entries({
        accountName: 'Account name',
        username: 'Username',
        email: 'Email',
        password: 'Password',
        website: 'Website',
        notes: 'Notes',
        category: 'Category',
      }).map(([field, label]) => (
        <VaultField
          key={field}
          label={label}
          value={value[field as Exclude<keyof typeof empty, 'favorite'>]}
          onChange={(text) => change(field as keyof typeof empty, text)}
          secret={field === 'password' && !visible}
          multiline={field === 'notes'}
          maxLength={
            field === 'notes'
              ? 20000
              : field === 'website'
                ? 2048
                : field === 'accountName'
                  ? 120
                  : field === 'category'
                    ? 80
                    : field === 'password'
                      ? 1024
                      : 320
          }
          editable={!blocked}
        />
      ))}
      <AppButton
        label={visible ? 'Hide password' : 'Reveal password'}
        disabled={blocked}
        variant="secondary"
        onPress={() => setVisible(!visible)}
      />
      <AppButton
        label="Copy password for up to 30 seconds"
        disabled={blocked || !value.password}
        variant="secondary"
        onPress={() => {
          copyVaultPassword(value.password, () => !service.getState().locked)
            .then(() =>
              setError(
                'Password copied. Clipboard cleanup is best effort and preserves replacement content.',
              ),
            )
            .catch(() => setError('Could not copy securely. No fallback was used.'));
        }}
      />
      <AppText tone="muted">
        Android and other apps may retain clipboard content. Avoid copying real secrets in this
        development build.
      </AppText>
      <AppButton
        label={value.favorite ? 'Remove favorite' : 'Mark favorite'}
        disabled={blocked}
        variant="secondary"
        onPress={() => change('favorite', !value.favorite)}
      />
      <AppText variant="heading">Password generator</AppText>
      <VaultField
        label="Generated password length (16–128)"
        value={length}
        onChange={setLength}
        maxLength={3}
      />
      {['lower', 'upper', 'digits', 'symbols'].map((group) => (
        <AppButton
          key={group}
          label={`${groups.includes(group) ? 'Included' : 'Excluded'}: ${group}`}
          variant="secondary"
          disabled={blocked}
          onPress={() =>
            setGroups((current) =>
              current.includes(group) ? current.filter((g) => g !== group) : [...current, group],
            )
          }
        />
      ))}
      <AppButton
        label="Generate secure password"
        variant="secondary"
        disabled={blocked}
        onPress={() => {
          void generate();
        }}
      />
      <AppButton
        label={state.busy ? 'Saving encrypted credential…' : 'Save credential'}
        disabled={blocked}
        onPress={() => {
          void save();
        }}
      />
      {!!record && (
        <>
          <AppText tone="muted">
            Created {new Date(record.createdAt).toLocaleDateString()} · Modified{' '}
            {new Date(record.updatedAt).toLocaleDateString()}
          </AppText>
          <AppButton
            label="Delete credential"
            disabled={blocked}
            variant="secondary"
            onPress={() =>
              confirmVaultAction(service, {
                title: 'Delete credential?',
                message:
                  'This permanently deletes this encrypted record. Existing backups may still contain it.',
                label: 'Delete',
                action: () => {
                  service
                    .remove(record.id, record.revision)
                    .then(() => {
                      setDirty(false);
                      setLeaving(true);
                      disablePrevention();
                      router.dismissTo('/vault');
                    })
                    .catch(() => setError('Delete failed. Reload before retrying.'));
                },
              })
            }
          />
        </>
      )}
      <AppButton label="Lock Vault" variant="secondary" onPress={() => service.lock()} />
    </ScreenContainer>
  );
}
