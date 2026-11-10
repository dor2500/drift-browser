import { useEffect, useMemo, useState } from 'react';
import type { BrowserState, CredentialEntry } from '../../shared/types';
import { cmd, cx } from '../lib';
import { Icon } from './Icon';

interface Props {
  state: BrowserState;
}

export function PasswordsPage({ state: _state }: Props) {
  const [passwords, setPasswords] = useState<CredentialEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [visiblePasswords, setVisiblePasswords] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<string | null>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [modalUrl, setModalUrl] = useState('');
  const [modalUsername, setModalUsername] = useState('');
  const [modalPassword, setModalPassword] = useState('');
  const [modalNotes, setModalNotes] = useState('');

  // Generator State
  const [showGenerator, setShowGenerator] = useState(false);
  const [genLength, setGenLength] = useState(16);
  const [genUpper, setGenUpper] = useState(true);
  const [genLower, setGenLower] = useState(true);
  const [genDigits, setGenDigits] = useState(true);
  const [genSymbols, setGenSymbols] = useState(true);
  const [generatedPass, setGeneratedPass] = useState('');

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const loadAll = async () => {
    setLoading(true);
    try {
      const list = await window.drift.getSavedPasswords();
      setPasswords(list);
    } catch (err) {
      console.error('[drift] failed to load passwords', err);
    } finally {
      setLoading(false);
    }
  };

  const handleExportCsv = () => {
    if (passwords.length === 0) {
      showToast('אין סיסמאות שמורות לייצוא');
      return;
    }
    const headers = 'name,url,username,password,note';
    const rows = passwords.map((p) => {
      const name = p.url.replace(/^https?:\/\//i, '').replace(/\/.*$/, '');
      const escape = (val: string) => `"${(val || '').replace(/"/g, '""')}"`;
      return `${escape(name)},${escape(p.url)},${escape(p.username)},${escape(p.password)},${escape(p.notes || '')}`;
    });
    const csvContent = [headers, ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `drift-passwords-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(`יוצאו ${passwords.length} סיסמאות לקובץ CSV`);
  };

  const handleImportCsv = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        if (!text) return;
        const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
        if (lines.length < 2) return;
        let count = 0;
        for (let i = 1; i < lines.length; i++) {
          const parts = lines[i].split(',').map((p) => p.replace(/^"|"$/g, '').trim());
          if (parts.length >= 4) {
            const [, url, username, password, notes] = parts;
            if (url && username && password) {
              await window.drift.savePassword({ url, username, password, notes: notes || '' });
              count++;
            }
          }
        }
        await loadAll();
        showToast(`יובאו ${count} סיסמאות מקובץ CSV בהצלחה!`);
      } catch {
        showToast('שגיאה בקריאת קובץ CSV');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  useEffect(() => {
    void loadAll();
  }, []);

  // Password Generator
  const generateNewPassword = () => {
    let charset = '';
    if (genUpper) charset += 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    if (genLower) charset += 'abcdefghijkmnpqrstuvwxyz';
    if (genDigits) charset += '23456789';
    if (genSymbols) charset += '!@#$%^&*()_+-=[]{}|;:,.<>?';
    if (!charset) charset = 'abcdefghijkmnpqrstuvwxyz23456789';

    const arr = new Uint32Array(genLength);
    window.crypto.getRandomValues(arr);
    let result = '';
    for (let i = 0; i < genLength; i++) {
      result += charset[arr[i] % charset.length];
    }
    setGeneratedPass(result);
  };

  useEffect(() => {
    generateNewPassword();
  }, [genLength, genUpper, genLower, genDigits, genSymbols]);

  const toggleShowPassword = (id: string) => {
    setVisiblePasswords((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const copyToClipboard = (text: string, label: string) => {
    void navigator.clipboard.writeText(text);
    showToast(`${label} הועתק ללוח!`);
  };

  const openAddModal = () => {
    setEditingId(null);
    setModalUrl('');
    setModalUsername('');
    setModalPassword('');
    setModalNotes('');
    setIsModalOpen(true);
  };

  const openEditModal = (item: CredentialEntry) => {
    setEditingId(item.id);
    setModalUrl(item.url);
    setModalUsername(item.username);
    setModalPassword(item.password);
    setModalNotes(item.notes || '');
    setIsModalOpen(true);
  };

  const handleSaveModal = async () => {
    if (!modalUrl.trim() || !modalPassword.trim()) {
      showToast('נא להזין כתובת אתר וסיסמה');
      return;
    }
    try {
      await window.drift.savePassword({
        id: editingId || undefined,
        url: modalUrl.trim(),
        username: modalUsername.trim(),
        password: modalPassword,
        notes: modalNotes.trim() || undefined,
      });
      setIsModalOpen(false);
      showToast(editingId ? 'פרטי הסיסמה עודכנו בהצלחה!' : 'סיסמה חדשה נשמרה בצורה מוצפנת!');
      await loadAll();
    } catch (err) {
      console.error(err);
      showToast('שגיאה בשמירת הסיסמה');
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('האם אתה בטוח שברצון למחוק סיסמה שמורה זו?')) {
      await window.drift.deletePassword(id);
      setPasswords((prev) => prev.filter((p) => p.id !== id));
      showToast('הסיסמה נמחקה בהצלחה.');
    }
  };

  // Password Security Analysis
  const passwordStats = useMemo(() => {
    let weakCount = 0;
    const passCountMap = new Map<string, number>();

    for (const p of passwords) {
      if (p.password.length < 8) weakCount++;
      passCountMap.set(p.password, (passCountMap.get(p.password) || 0) + 1);
    }

    let reusedCount = 0;
    for (const count of passCountMap.values()) {
      if (count > 1) reusedCount += count;
    }

    const secureCount = Math.max(0, passwords.length - weakCount);
    const score = passwords.length === 0 ? 100 : Math.round((secureCount / passwords.length) * 100);

    return { weakCount, reusedCount, secureCount, score };
  }, [passwords]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return passwords;
    return passwords.filter(
      (p) =>
        p.url.toLowerCase().includes(q) ||
        p.username.toLowerCase().includes(q) ||
        (p.notes && p.notes.toLowerCase().includes(q))
    );
  }, [passwords, search]);

  const getDomain = (url: string) => {
    try {
      const u = url.startsWith('http') ? url : `https://${url}`;
      return new URL(u).hostname.replace(/^www\./, '');
    } catch {
      return url;
    }
  };

  return (
    <div className="passwords-hub-page" dir="rtl">
      {/* Header */}
      <header className="passwords-hub-header">
        <div className="passwords-header-left">
          <div className="passwords-header-icon">
            <Icon name="lock" size={26} />
          </div>
          <div>
            <h1 className="passwords-title">מנהל הסיסמאות והאימות (Password Manager)</h1>
            <p className="passwords-subtitle">
              הצפנה מקומית חזקה ברמת מערכת ההפעלה (safeStorage / DPAPI), בדיקת דליפות ומחולל סיסמאות
            </p>
          </div>
        </div>

        <div className="passwords-header-actions">
          <button className="btn primary passwords-action-btn" onClick={openAddModal}>
            <Icon name="plus" size={15} />
            <span>הוסף סיסמה חדשה</span>
          </button>
          <button
            className={cx('btn passwords-action-btn', showGenerator && 'active')}
            onClick={() => setShowGenerator((v) => !v)}
          >
            <Icon name="bolt" size={15} />
            <span>מחולל סיסמאות</span>
          </button>
          <button
            className="btn passwords-action-btn"
            onClick={handleExportCsv}
            title="ייצוא סיסמאות לקובץ CSV תואם Google Chrome"
          >
            <Icon name="download" size={15} />
            <span>ייצוא CSV</span>
          </button>
          <label className="btn passwords-action-btn" title="ייבוא סיסמאות מקובץ CSV של כרום או דפדפן אחר" style={{ cursor: 'pointer' }}>
            <Icon name="folder" size={15} />
            <span>ייבוא CSV</span>
            <input type="file" accept=".csv" onChange={handleImportCsv} style={{ display: 'none' }} />
          </label>
        </div>
      </header>

      {/* Security Health Dashboard */}
      <div className="passwords-health-bar">
        <div className="health-card main-score">
          <span className="health-label">ציון אבטחת סיסמאות</span>
          <div className="health-score-value">
            <span className="score-num">{passwordStats.score}%</span>
            <span className="score-desc">
              {passwordStats.score >= 90
                ? 'מעולה ומאובטח 🛡️'
                : passwordStats.score >= 70
                ? 'טוב, יש מה לשפר'
                : 'דורש חיזוק סיסמאות ⚠️'}
            </span>
          </div>
        </div>

        <div className="health-card">
          <span className="health-label">סה"כ סיסמאות שמורות</span>
          <span className="health-val">{passwords.length}</span>
        </div>

        <div className="health-card">
          <span className="health-label">סיסמאות חלשות (&lt;8 תווים)</span>
          <span className={cx('health-val', passwordStats.weakCount > 0 && 'warning-text')}>
            {passwordStats.weakCount}
          </span>
        </div>

        <div className="health-card">
          <span className="health-label">סיסמאות בשימוש חוזר</span>
          <span className={cx('health-val', passwordStats.reusedCount > 0 && 'warning-text')}>
            {passwordStats.reusedCount}
          </span>
        </div>
      </div>

      {/* Password Generator Drawer */}
      {showGenerator && (
        <div className="passwords-generator-card">
          <div className="gen-header">
            <div className="gen-title-wrap">
              <Icon name="bolt" size={18} />
              <h3>מחולל סיסמאות חזקות (Strong Password Generator)</h3>
            </div>
            <button className="gen-close-btn" onClick={() => setShowGenerator(false)}>
              <Icon name="x" size={14} />
            </button>
          </div>

          <div className="gen-display-box">
            <input type="text" readOnly value={generatedPass} className="gen-output-field" />
            <button
              className="btn small primary"
              onClick={() => copyToClipboard(generatedPass, 'סיסמה חדשה')}
            >
              <Icon name="copy" size={14} />
              <span>העתק</span>
            </button>
            <button className="btn small" onClick={generateNewPassword} title="צור סיסמה חדשה">
              <Icon name="reload" size={14} />
            </button>
          </div>

          <div className="gen-controls-row">
            <div className="gen-slider-wrap">
              <label>אורך סיסמה: <strong>{genLength} תווים</strong></label>
              <input
                type="range"
                min="8"
                max="36"
                value={genLength}
                onChange={(e) => setGenLength(Number(e.target.value))}
                className="gen-slider"
              />
            </div>

            <div className="gen-options-checks">
              <label className="gen-check-label">
                <input
                  type="checkbox"
                  checked={genUpper}
                  onChange={(e) => setGenUpper(e.target.checked)}
                />
                A-Z
              </label>
              <label className="gen-check-label">
                <input
                  type="checkbox"
                  checked={genLower}
                  onChange={(e) => setGenLower(e.target.checked)}
                />
                a-z
              </label>
              <label className="gen-check-label">
                <input
                  type="checkbox"
                  checked={genDigits}
                  onChange={(e) => setGenDigits(e.target.checked)}
                />
                0-9
              </label>
              <label className="gen-check-label">
                <input
                  type="checkbox"
                  checked={genSymbols}
                  onChange={(e) => setGenSymbols(e.target.checked)}
                />
                !@#$
              </label>
            </div>
          </div>
        </div>
      )}

      {/* Search Input */}
      <div className="passwords-search-strip">
        <div className="passwords-search-box">
          <Icon name="search" size={16} />
          <input
            type="text"
            className="passwords-search-input"
            placeholder="חפש בסיסמאות השמורות לפי אתר, שם משתמש או אימייל... (Search Passwords)"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button className="passwords-search-clear" onClick={() => setSearch('')}>
              <Icon name="x" size={13} />
            </button>
          )}
        </div>
      </div>

      {/* Passwords List */}
      <div className="passwords-list-scroll">
        {loading ? (
          <div className="passwords-empty-state">
            <Icon name="lock" size={40} />
            <p>טוען סיסמאות מוצפנות...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="passwords-empty-state">
            <Icon name="lock" size={48} />
            <h3>{search ? 'לא נמצאו סיסמאות תואמות לחיפוש' : 'אין סיסמאות שמורות כרגע'}</h3>
            <p>
              {search
                ? 'בדוק את מונחי החיפוש או נקה את שורת החיפוש.'
                : 'סיסמאות שתשמור יאוחסנו בהצפנה מקומית חזקה ברמת ה-OS Keychain/DPAPI.'}
            </p>
            {passwords.length === 0 && (
              <button className="btn small primary" onClick={openAddModal}>
                הוסף סיסמה ראשונה עכשיו
              </button>
            )}
          </div>
        ) : (
          <div className="passwords-cards-grid">
            {filtered.map((item) => {
              const domain = getDomain(item.url);
              const isVisible = visiblePasswords.has(item.id);
              return (
                <div key={item.id} className="password-card-row">
                  <div className="pwd-col-site">
                    <img
                      className="pwd-favicon"
                      src={`https://www.google.com/s2/favicons?domain=${domain}&sz=32`}
                      alt=""
                      onError={(e) => {
                        (e.currentTarget as HTMLElement).style.display = 'none';
                      }}
                    />
                    <div className="pwd-site-meta">
                      <span className="pwd-site-domain">{domain}</span>
                      <button
                        className="pwd-site-link"
                        onClick={() =>
                          cmd({
                            type: 'tab:new',
                            url: item.url.startsWith('http') ? item.url : `https://${item.url}`,
                          })
                        }
                        title={`פתח את ${item.url}`}
                      >
                        {item.url}
                      </button>
                    </div>
                  </div>

                  <div className="pwd-col-user">
                    <span className="pwd-username-val">{item.username || 'ללא שם משתמש'}</span>
                    <button
                      className="pwd-mini-copy"
                      title="העתק שם משתמש"
                      onClick={() => copyToClipboard(item.username, 'שם משתמש')}
                    >
                      <Icon name="copy" size={12} />
                    </button>
                  </div>

                  <div className="pwd-col-pass">
                    <span className={cx('pwd-value-text', !isVisible && 'masked')}>
                      {isVisible ? item.password : '••••••••••••'}
                    </span>
                    <button
                      className="pwd-mini-btn"
                      title={isVisible ? 'הסתר סיסמה' : 'הצג סיסמה'}
                      onClick={() => toggleShowPassword(item.id)}
                    >
                      <Icon name={isVisible ? 'moon' : 'sparkles'} size={13} />
                    </button>
                    <button
                      className="pwd-mini-btn"
                      title="העתק סיסמה"
                      onClick={() => copyToClipboard(item.password, 'סיסמה')}
                    >
                      <Icon name="copy" size={13} />
                    </button>
                  </div>

                  <div className="pwd-col-actions">
                    <button
                      className="btn small ghost-btn"
                      title="ערוך"
                      onClick={() => openEditModal(item)}
                    >
                      ערוך
                    </button>
                    <button
                      className="btn small ghost-btn danger-hover"
                      title="מחק"
                      onClick={() => void handleDelete(item.id)}
                    >
                      <Icon name="trash" size={13} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add / Edit Modal */}
      {isModalOpen && (
        <div className="drift-modal-backdrop" onClick={() => setIsModalOpen(false)}>
          <div className="drift-modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="drift-modal-header">
              <div className="modal-title-wrap">
                <Icon name="lock" size={20} />
                <h3>{editingId ? 'עריכת סיסמה שמורה' : 'הוספת סיסמה חדשה'}</h3>
              </div>
              <button className="drift-modal-close" onClick={() => setIsModalOpen(false)}>
                <Icon name="x" size={16} />
              </button>
            </div>

            <div className="drift-modal-body">
              <div className="modal-field-group">
                <label className="modal-label">כתובת אתר (Website URL):</label>
                <input
                  type="text"
                  className="modal-select"
                  placeholder="לדוגמה: github.com או https://google.com"
                  value={modalUrl}
                  onChange={(e) => setModalUrl(e.target.value)}
                />
              </div>

              <div className="modal-field-group">
                <label className="modal-label">שם משתמש או דוא"ל (Username / Email):</label>
                <input
                  type="text"
                  className="modal-select"
                  placeholder="name@example.com או שם משתמש"
                  value={modalUsername}
                  onChange={(e) => setModalUsername(e.target.value)}
                />
              </div>

              <div className="modal-field-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label className="modal-label">סיסמה (Password):</label>
                  <button
                    className="btn ghost-btn small"
                    style={{ fontSize: 11 }}
                    onClick={() => {
                      generateNewPassword();
                      setModalPassword(generatedPass);
                    }}
                  >
                    הגרל סיסמה חזקה
                  </button>
                </div>
                <input
                  type="text"
                  className="modal-select"
                  placeholder="הזן סיסמה"
                  value={modalPassword}
                  onChange={(e) => setModalPassword(e.target.value)}
                />
              </div>

              <div className="modal-field-group">
                <label className="modal-label">הערות נוספות (Notes - Optional):</label>
                <input
                  type="text"
                  className="modal-select"
                  placeholder="הערה פרטית אופציונלית"
                  value={modalNotes}
                  onChange={(e) => setModalNotes(e.target.value)}
                />
              </div>
            </div>

            <div className="drift-modal-footer">
              <button className="btn" onClick={() => setIsModalOpen(false)}>
                ביטול
              </button>
              <button className="btn primary" onClick={() => void handleSaveModal()}>
                שמור סיסמה בהצפנה
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Toast */}
      {toast && (
        <div className="passwords-toast">
          <Icon name="check" size={14} />
          <span>{toast}</span>
        </div>
      )}
    </div>
  );
}

