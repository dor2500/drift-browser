# Drift language packs

English and Hebrew are built into Drift. Every other language lives here and is downloaded by Drift when someone picks it in Settings → Language.

To add a language:

1. Copy `en.json` to `<code>.json` (for example `fr.json`) and translate the values. Keep `{placeholders}` as they are.
2. Add `{ "code": "fr", "name": "French", "native": "Français" }` to `index.json`.
3. Open a pull request. Missing strings fall back to English, so a partial translation still works.

Right-to-left languages (Arabic, Persian, Urdu and others) flip Drift's layout automatically.
