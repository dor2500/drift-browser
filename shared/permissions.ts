// Human-readable names for permission kinds, shared by the prompt card and
// the site-permissions menu.
//
// A "kind" is what gets remembered per site. It is usually Electron's
// permission name, except that media is split into camera and microphone,
// and external-app links are kept per protocol ("openExternal:mailto").

const LABELS: Record<string, string> = {
  camera: 'Use your camera',
  microphone: 'Use your microphone',
  geolocation: 'Know your location',
  notifications: 'Show notifications',
  'clipboard-read': 'See text and images you copy',
  midi: 'Use your MIDI devices',
  midiSysex: 'Fully control your MIDI devices',
  'idle-detection': 'Know when you are using this device',
  'storage-access': 'Use its cookies while embedded on other sites',
  'top-level-storage-access': 'Use its cookies on related sites',
  'window-management': 'Manage windows on all your displays',
  keyboardLock: 'Capture your keyboard',
  'speaker-selection': 'Choose your audio output',
  fileSystem: 'Edit files on your device',
};

export function permissionLabel(kind: string): string {
  if (kind.startsWith('openExternal:')) return `Open ${kind.slice('openExternal:'.length)}: links in another app`;
  return LABELS[kind] ?? kind;
}

export function permissionShortName(kind: string): string {
  if (kind.startsWith('openExternal:')) return `${kind.slice('openExternal:'.length)}: links`;
  const short: Record<string, string> = {
    camera: 'Camera',
    microphone: 'Microphone',
    geolocation: 'Location',
    notifications: 'Notifications',
    'clipboard-read': 'Clipboard',
    midi: 'MIDI devices',
    midiSysex: 'MIDI control',
    'idle-detection': 'Idle detection',
    'storage-access': 'Embedded cookies',
    'top-level-storage-access': 'Related-site cookies',
    'window-management': 'Window management',
    keyboardLock: 'Keyboard lock',
    'speaker-selection': 'Audio output',
    fileSystem: 'File editing',
  };
  return short[kind] ?? kind;
}

export function hostOf(origin: string): string {
  try {
    return new URL(origin).host || origin;
  } catch {
    return origin;
  }
}
