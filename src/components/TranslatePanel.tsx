import { useState } from 'react';
import type { BrowserState, TabState } from '../../shared/types';
import { cmd, cx } from '../lib';
import { Icon } from './Icon';

interface Props {
  activeTab?: TabState;
  state: BrowserState;
  onClose: () => void;
}

interface LanguageOption {
  code: string;
  name: string;
  native: string;
}

const POPULAR_LANGUAGES: LanguageOption[] = [
  { code: 'he', name: 'עברית', native: 'עברית' },
  { code: 'en', name: 'אנגלית', native: 'English' },
  { code: 'ar', name: 'ערבית', native: 'العربية' },
  { code: 'ru', name: 'רוסית', native: 'Русский' },
  { code: 'es', name: 'ספרדית', native: 'Español' },
  { code: 'fr', name: 'צרפתית', native: 'Français' },
  { code: 'de', name: 'גרמנית', native: 'Deutsch' },
  { code: 'it', name: 'איטלקית', native: 'Italiano' },
  { code: 'ja', name: 'יפנית', native: '日本語' },
  { code: 'zh-CN', name: 'סינית', native: '简体中文' },
  { code: 'tr', name: 'טורקית', native: 'Türkçe' },
  { code: 'uk', name: 'אוקראינית', native: 'Українська' },
];

export function TranslatePanel({ activeTab, state: _state, onClose }: Props) {
  const [targetLang, setTargetLang] = useState('he');
  const [translated, setTranslated] = useState(false);
  const [alwaysTranslate, setAlwaysTranslate] = useState(false);

  const handleTranslateInPage = () => {
    setTranslated(true);
    cmd({ type: 'page:translate', targetLang, mode: 'inpage' });
  };

  const handleRevertOriginal = () => {
    setTranslated(false);
    cmd({ type: 'page:revertTranslate' });
  };

  const handleOpenInNewTab = () => {
    onClose();
    cmd({ type: 'page:translate', targetLang, mode: 'tab' });
  };

  const selectedTarget = POPULAR_LANGUAGES.find((l) => l.code === targetLang) || POPULAR_LANGUAGES[0];

  return (
    <div className="translate-popover-card" dir="rtl">
      {/* Header */}
      <div className="translate-header">
        <div className="translate-header-title">
          <div className="translate-logo-icon">
            <Icon name="globe" size={18} />
          </div>
          <div>
            <h3>תרגום דף (Google Translate)</h3>
            <span className="translate-sub">תרגום חי ישירות בתוך הדף</span>
          </div>
        </div>
        <button className="translate-close-btn" onClick={onClose} title="סגור חלונית">
          <Icon name="x" size={14} />
        </button>
      </div>

      {/* Language Tabs (Original vs Target) */}
      <div className="translate-tabs-strip">
        <button
          className={cx('translate-tab-btn', !translated && 'active')}
          onClick={handleRevertOriginal}
        >
          המקור (Original)
        </button>
        <button
          className={cx('translate-tab-btn', translated && 'active')}
          onClick={handleTranslateInPage}
        >
          {selectedTarget.name} ({selectedTarget.native})
        </button>
      </div>

      {/* Target Language Selector */}
      <div className="translate-selector-row">
        <label className="translate-field-label">בחר שפת יעד לתרגום:</label>
        <select
          className="translate-lang-select"
          value={targetLang}
          onChange={(e) => {
            const next = e.target.value;
            setTargetLang(next);
            if (translated) {
              cmd({ type: 'page:translate', targetLang: next, mode: 'inpage' });
            }
          }}
        >
          {POPULAR_LANGUAGES.map((l) => (
            <option key={l.code} value={l.code}>
              {l.name} — {l.native}
            </option>
          ))}
        </select>
      </div>

      {/* Action Buttons */}
      <div className="translate-actions-box">
        <button
          className={cx('btn primary translate-main-action', translated && 'done')}
          onClick={handleTranslateInPage}
        >
          <Icon name="check" size={14} />
          <span>{translated ? 'עודכן לתרגום בדף' : 'תרגם דף זה כעת (In-Page)'}</span>
        </button>

        {translated && (
          <button className="btn ghost-btn small" onClick={handleRevertOriginal}>
            הצג שוב מקור (Show Original)
          </button>
        )}
      </div>

      {/* Footer Options */}
      <div className="translate-footer">
        <label className="translate-checkbox-label">
          <input
            type="checkbox"
            checked={alwaysTranslate}
            onChange={(e) => setAlwaysTranslate(e.target.checked)}
          />
          <span>תרגם תמיד אתרים בשפה זו</span>
        </label>

        {activeTab && (
          <button className="translate-external-link" onClick={handleOpenInNewTab}>
            <span>פתח ב-Google Translate מלא בטאב נפרד</span>
            <Icon name="tab" size={12} />
          </button>
        )}
      </div>
    </div>
  );
}

