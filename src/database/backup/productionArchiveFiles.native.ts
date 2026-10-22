import { FileMode } from 'expo-file-system';
import { MAX_PORTABLE_LINE } from './portableArchive.ts';
/** Format-2 bounded ASCII ciphertext reader. It does not reuse format 1's smaller
line policy. A footer must be followed by EOF, including an ending newline. */
export function portableFileReader(file: import('expo-file-system').File) {
  const handle = file.open(FileMode.ReadOnly);
  let pending = '';
  let ended = false;
  let total = 0;
  return {
    close: () => handle.close(),
    async nextLine() {
      while (true) {
        const separator = pending.indexOf('\n');
        if (separator >= 0) {
          if (separator > MAX_PORTABLE_LINE)
            throw new Error('Portable frame exceeds the file limit.');
          const line = pending.slice(0, separator);
          pending = pending.slice(separator + 1);
          return line;
        }
        if (ended) {
          if (pending) throw new Error('Portable backup is incomplete.');
          return null;
        }
        const bytes = await handle.readBytes(16 * 1024);
        total += bytes.length;
        if (total > 192 * 1024 * 1024 || bytes.some((byte) => byte > 127))
          throw new Error('Unsupported portable file size or encoding.');
        pending += new TextDecoder().decode(bytes);
        ended = bytes.length === 0;
        if (!pending.includes('\n') && pending.length > MAX_PORTABLE_LINE)
          throw new Error('Portable frame exceeds the file limit.');
      }
    },
  };
}
