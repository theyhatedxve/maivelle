import { useLocalSearchParams } from 'expo-router';
import CredentialEditor from '../../features/vault/components/CredentialEditor.tsx';
export default function CredentialRoute() {
  const { id } = useLocalSearchParams();
  return <CredentialEditor id={typeof id === 'string' ? id : ''} />;
}
