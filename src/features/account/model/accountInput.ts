export type Profile = { name: string; nickname: string };
export type SignUpInput = Profile & { password: string; pin: string };

export function profileInput(name: string, nickname: string): Profile {
  const profile = { name: name.trim(), nickname: nickname.trim() };
  if (!profile.name || profile.name.length > 80 || /[\u0000-\u001f]/.test(profile.name))
    throw new Error('Enter your name using 1–80 characters.');
  if (!/^[a-zA-Z0-9_.-]{3,32}$/.test(profile.nickname))
    throw new Error('Use a nickname of 3–32 letters, numbers, dots, underscores or hyphens.');
  return profile;
}

export function validatePassword(password: string) {
  if (Array.from(password).length < 12 || new TextEncoder().encode(password).length > 900)
    throw new Error('Use a password of at least 12 characters (up to 900 UTF-8 bytes).');
}

export function validatePin(pin: string) {
  if (!/^\d{6,12}$/.test(pin)) throw new Error('Use a PIN of 6–12 digits.');
}
