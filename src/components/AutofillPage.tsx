import { useEffect, useMemo, useState } from 'react';
import type { AutofillData, BrowserState, SavedAddress, SavedCreditCard } from '../../shared/types';
import { cmd, cx } from '../lib';
import { Icon } from './Icon';

export function AutofillPage({ state }: { state: BrowserState }) {
  const [autofillData, setAutofillData] = useState<AutofillData>({ cards: [], addresses: [] });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'payments' | 'addresses'>('payments');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [editingCard, setEditingCard] = useState<{
    id?: string;
    cardNumber: string;
    nameOnCard: string;
    expMonth: string;
    expYear: string;
    nickname?: string;
  } | null>(null);

  const [editingAddress, setEditingAddress] = useState<{
    id?: string;
    fullName: string;
    company?: string;
    streetAddress: string;
    city: string;
    stateProvince?: string;
    postalCode: string;
    country: string;
    phone?: string;
    email?: string;
  } | null>(null);

  const [cardToDelete, setCardToDelete] = useState<SavedCreditCard | null>(null);
  const [addressToDelete, setAddressToDelete] = useState<SavedAddress | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const data = await window.drift.getAutofillData();
      setAutofillData(data || { cards: [], addresses: [] });
    } catch (e) {
      console.error('Failed to load autofill data:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const saveAndFillPayments = state.settings.autofill?.saveAndFillPayments ?? true;
  const saveAndFillAddresses = state.settings.autofill?.saveAndFillAddresses ?? true;

  const handleTogglePayments = (val: boolean) => {
    cmd({ type: 'settings:set', patch: { autofill: { saveAndFillPayments: val } } });
    showToast(val ? 'מילוי אוטומטי של אמצעי תשלום הופעל' : 'מילוי אוטומטי של אמצעי תשלום הושבת');
  };

  const handleToggleAddresses = (val: boolean) => {
    cmd({ type: 'settings:set', patch: { autofill: { saveAndFillAddresses: val } } });
    showToast(val ? 'מילוי אוטומטי של כתובות הופעל' : 'מילוי אוטומטי של כתובות הושבת');
  };

  // Card Operations
  const handleSaveCard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCard || !editingCard.cardNumber.trim()) return;

    try {
      await window.drift.saveCreditCard({
        id: editingCard.id,
        cardNumber: editingCard.cardNumber,
        nameOnCard: editingCard.nameOnCard.trim() || 'CARDHOLDER',
        expMonth: editingCard.expMonth || '12',
        expYear: editingCard.expYear || '28',
        nickname: editingCard.nickname?.trim() || undefined,
      });
      showToast('פרטי כרטיס האשראי נשמרו בהצפנה מלאה!');
      setEditingCard(null);
      await loadData();
    } catch (err) {
      console.error(err);
      alert('שגיאה בשמירת כרטיס האשראי');
    }
  };

  const handleConfirmDeleteCard = async () => {
    if (!cardToDelete) return;
    await window.drift.deleteCreditCard(cardToDelete.id);
    showToast('הכרטיס נמחק בהצלחה');
    setCardToDelete(null);
    await loadData();
  };

  // Address Operations
  const handleSaveAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAddress || !editingAddress.fullName.trim() || !editingAddress.streetAddress.trim()) return;

    try {
      await window.drift.saveAddress({
        id: editingAddress.id,
        fullName: editingAddress.fullName.trim(),
        company: editingAddress.company?.trim(),
        streetAddress: editingAddress.streetAddress.trim(),
        city: editingAddress.city.trim(),
        stateProvince: editingAddress.stateProvince?.trim(),
        postalCode: editingAddress.postalCode.trim(),
        country: editingAddress.country.trim() || 'ישראל',
        phone: editingAddress.phone?.trim(),
        email: editingAddress.email?.trim(),
      });
      showToast('הכתובת נשמרה בהצלחה!');
      setEditingAddress(null);
      await loadData();
    } catch (err) {
      console.error(err);
      alert('שגיאה בשמירת הכתובת');
    }
  };

  const handleConfirmDeleteAddress = async () => {
    if (!addressToDelete) return;
    await window.drift.deleteAddress(addressToDelete.id);
    showToast('הכתובת נמחקה בהצלחה');
    setAddressToDelete(null);
    await loadData();
  };

  const filteredCards = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return autofillData.cards;
    return autofillData.cards.filter(
      (c) =>
        c.nameOnCard.toLowerCase().includes(q) ||
        c.lastFour.includes(q) ||
        (c.nickname && c.nickname.toLowerCase().includes(q))
    );
  }, [autofillData.cards, searchQuery]);

  const filteredAddresses = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return autofillData.addresses;
    return autofillData.addresses.filter(
      (a) =>
        a.fullName.toLowerCase().includes(q) ||
        a.city.toLowerCase().includes(q) ||
        a.streetAddress.toLowerCase().includes(q) ||
        (a.email && a.email.toLowerCase().includes(q)) ||
        (a.company && a.company.toLowerCase().includes(q))
    );
  }, [autofillData.addresses, searchQuery]);

  const formatCardNumberDisplay = (lastFour: string) => `•••• •••• •••• ${lastFour}`;

  return (
    <div className="autofill-page">
      {/* Toast */}
      {toastMessage && (
        <div className="autofill-toast">
          <Icon name="check" size={16} />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <div className="autofill-header">
        <div className="header-titles">
          <div className="header-breadcrumb">
            <button className="crumb-link" onClick={() => cmd({ type: 'settings:open' })}>
              הגדרות
            </button>
            <span className="crumb-sep">/</span>
            <span>מילוי אוטומטי</span>
            <span className="crumb-sep">/</span>
            <span className="crumb-current">אמצעי תשלום וכתובות</span>
          </div>
          <h2>מילוי אוטומטי, אמצעי תשלום וכתובות (Autofill & Payments)</h2>
          <p className="header-subtitle">
            ניהול מאובטח של כרטיסי אשראי, חשבונות תשלום, כתובות מגורים ופרטי התקשרות. כל הנתונים הרגישים מוצפנים ברמת מערכת ההפעלה.
          </p>
        </div>

        <div className="header-actions">
          {activeTab === 'payments' ? (
            <button
              className="btn primary small"
              onClick={() =>
                setEditingCard({
                  cardNumber: '',
                  nameOnCard: '',
                  expMonth: '12',
                  expYear: '28',
                  nickname: '',
                })
              }
            >
              <Icon name="plus" size={14} />
              <span>+ הוסף כרטיס אשראי</span>
            </button>
          ) : (
            <button
              className="btn primary small"
              onClick={() =>
                setEditingAddress({
                  fullName: '',
                  company: '',
                  streetAddress: '',
                  city: 'תל אביב',
                  postalCode: '',
                  country: 'ישראל',
                  phone: '',
                  email: '',
                })
              }
            >
              <Icon name="plus" size={14} />
              <span>+ הוסף כתובת חדשה</span>
            </button>
          )}
        </div>
      </div>

      {/* Navigation Tabs Bar */}
      <div className="autofill-nav-bar">
        <div className="tab-buttons">
          <button
            className={cx('tab-btn', activeTab === 'payments' && 'active')}
            onClick={() => setActiveTab('payments')}
          >
            <Icon name="key" size={15} />
            <span>אמצעי תשלום וכרטיסי אשראי ({autofillData.cards.length})</span>
          </button>
          <button
            className={cx('tab-btn', activeTab === 'addresses' && 'active')}
            onClick={() => setActiveTab('addresses')}
          >
            <Icon name="location" size={15} />
            <span>כתובות ופרטי קשר ({autofillData.addresses.length})</span>
          </button>
        </div>

        <div className="tab-search">
          <Icon name="search" size={15} />
          <input
            type="text"
            placeholder={activeTab === 'payments' ? 'חיפוש כרטיס לפי שם או 4 ספרות...' : 'חיפוש כתובת לפי שם, עיר, רחוב...'}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button className="btn-clear-search" onClick={() => setSearchQuery('')}>
              <Icon name="x" size={13} />
            </button>
          )}
        </div>
      </div>

      {/* Content Body */}
      <div className="autofill-body">
        {loading ? (
          <div className="autofill-loading">
            <Icon name="reload" size={24} />
            <span>טוען נתונים מוצפנים...</span>
          </div>
        ) : activeTab === 'payments' ? (
          /* SECTION 1: PAYMENTS */
          <div className="payments-section">
            <div className="section-toggle-card">
              <div className="toggle-info">
                <strong>שמור ומלא אמצעי תשלום באופן אוטומטי (Save and fill payment methods)</strong>
                <span>מאפשר מילוי מיידי ומאובטח של פרטי כרטיס אשראי בטפסי רכישה ותשלום ברשת</span>
              </div>
              <input
                type="checkbox"
                className="switch"
                checked={saveAndFillPayments}
                onChange={(e) => handleTogglePayments(e.target.checked)}
              />
            </div>

            {filteredCards.length === 0 ? (
              <div className="autofill-empty-card">
                <div className="empty-circle-icon">
                  <Icon name="key" size={32} />
                </div>
                <h3>אין כרטיסי אשראי שמורים</h3>
                <p>הוסף כרטיס אשראי לתשלום מהיר ונוח בלחיצה אחת באתרים.</p>
                <button
                  className="btn primary"
                  onClick={() =>
                    setEditingCard({
                      cardNumber: '',
                      nameOnCard: '',
                      expMonth: '12',
                      expYear: '28',
                      nickname: '',
                    })
                  }
                >
                  + הוסף כרטיס עכשיו
                </button>
              </div>
            ) : (
              <div className="cards-grid">
                {filteredCards.map((card) => {
                  const brandClass = `card-brand-${card.brand}`;
                  return (
                    <div key={card.id} className={cx('virtual-credit-card', brandClass)}>
                      <div className="card-top-header">
                        <div className="chip-graphic" />
                        <span className="brand-logo-text">{card.brand.toUpperCase()}</span>
                      </div>

                      <div className="card-number-row">
                        <span>{formatCardNumberDisplay(card.lastFour)}</span>
                      </div>

                      <div className="card-meta-row">
                        <div className="cardholder-wrap">
                          <span className="card-meta-label">בעל הכרטיס</span>
                          <span className="cardholder-name">{card.nameOnCard}</span>
                        </div>
                        <div className="card-exp-wrap">
                          <span className="card-meta-label">תוקף</span>
                          <span className="card-exp-date">{card.expMonth}/{card.expYear}</span>
                        </div>
                      </div>

                      {card.nickname && <div className="card-nickname-tag">{card.nickname}</div>}

                      <div className="card-overlay-actions">
                        <button
                          className="btn-card-action"
                          title="ערוך כרטיס"
                          onClick={() =>
                            setEditingCard({
                              id: card.id,
                              cardNumber: card.cardNumber,
                              nameOnCard: card.nameOnCard,
                              expMonth: card.expMonth,
                              expYear: card.expYear,
                              nickname: card.nickname,
                            })
                          }
                        >
                          <Icon name="sliders" size={13} />
                          <span>ערוך</span>
                        </button>
                        <button
                          className="btn-card-action delete"
                          title="מחק כרטיס"
                          onClick={() => setCardToDelete(card)}
                        >
                          <Icon name="trash" size={13} />
                          <span>מחק</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          /* SECTION 2: ADDRESSES */
          <div className="addresses-section">
            <div className="section-toggle-card">
              <div className="toggle-info">
                <strong>שמור ומלא כתובות באופן אוטומטי (Save and fill addresses)</strong>
                <span>ממלא אוטומטית כתובות משלוח, מספרי טלפון ודוא״ל בעת ביצוע הזמנות מקוונות</span>
              </div>
              <input
                type="checkbox"
                className="switch"
                checked={saveAndFillAddresses}
                onChange={(e) => handleToggleAddresses(e.target.checked)}
              />
            </div>

            {filteredAddresses.length === 0 ? (
              <div className="autofill-empty-card">
                <div className="empty-circle-icon">
                  <Icon name="location" size={32} />
                </div>
                <h3>אין כתובות שמורות</h3>
                <p>הוסף כתובת משלוח ומגורים למילוי אוטומטי בטפסים מקוונים.</p>
                <button
                  className="btn primary"
                  onClick={() =>
                    setEditingAddress({
                      fullName: '',
                      company: '',
                      streetAddress: '',
                      city: 'תל אביב',
                      postalCode: '',
                      country: 'ישראל',
                      phone: '',
                      email: '',
                    })
                  }
                >
                  + הוסף כתובת עכשיו
                </button>
              </div>
            ) : (
              <div className="addresses-grid">
                {filteredAddresses.map((addr) => (
                  <div key={addr.id} className="address-card">
                    <div className="address-card-header">
                      <div className="addr-avatar">
                        <Icon name="user" size={16} />
                      </div>
                      <div className="addr-title-wrap">
                        <strong className="addr-fullname">{addr.fullName}</strong>
                        {addr.company && <span className="addr-company">{addr.company}</span>}
                      </div>
                    </div>

                    <div className="address-lines">
                      <div className="addr-line street">
                        <Icon name="location" size={13} />
                        <span>{addr.streetAddress}</span>
                      </div>
                      <div className="addr-line city-zip">
                        <span>{addr.city}, {addr.postalCode}</span>
                        {addr.country && <span className="addr-country">({addr.country})</span>}
                      </div>
                      {addr.phone && (
                        <div className="addr-line phone">
                          <Icon name="devices" size={13} />
                          <span dir="ltr">{addr.phone}</span>
                        </div>
                      )}
                      {addr.email && (
                        <div className="addr-line email">
                          <Icon name="send" size={13} />
                          <span>{addr.email}</span>
                        </div>
                      )}
                    </div>

                    <div className="address-card-actions">
                      <button
                        className="btn ghost small"
                        onClick={() =>
                          setEditingAddress({
                            id: addr.id,
                            fullName: addr.fullName,
                            company: addr.company,
                            streetAddress: addr.streetAddress,
                            city: addr.city,
                            stateProvince: addr.stateProvince,
                            postalCode: addr.postalCode,
                            country: addr.country,
                            phone: addr.phone,
                            email: addr.email,
                          })
                        }
                      >
                        ערוך כתובת
                      </button>
                      <button
                        className="btn danger-ghost small"
                        onClick={() => setAddressToDelete(addr)}
                      >
                        מחק
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* MODAL: ADD / EDIT CREDIT CARD */}
      {editingCard && (
        <div className="modal-backdrop" onClick={() => setEditingCard(null)}>
          <div className="modal-content card-editor-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingCard.id ? 'עריכת כרטיס אשראי' : 'הוספת כרטיס אשראי מאובטח'}</h3>
              <button className="btn-icon" onClick={() => setEditingCard(null)}>
                <Icon name="x" size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveCard}>
              <div className="modal-body">
                <div className="field-group">
                  <label className="field-label">מספר כרטיס אשראי (Card Number):</label>
                  <input
                    type="text"
                    className="field-input mono"
                    placeholder="4580 0000 0000 0000"
                    value={editingCard.cardNumber}
                    onChange={(e) => setEditingCard({ ...editingCard, cardNumber: e.target.value })}
                    required
                    autoFocus
                  />
                </div>

                <div className="field-group">
                  <label className="field-label">שם בעל הכרטיס (Name on Card):</label>
                  <input
                    type="text"
                    className="field-input"
                    placeholder="ISRAEL ISRAELI"
                    value={editingCard.nameOnCard}
                    onChange={(e) => setEditingCard({ ...editingCard, nameOnCard: e.target.value })}
                    required
                  />
                </div>

                <div className="field-row">
                  <div className="field-group" style={{ flex: 1 }}>
                    <label className="field-label">חודש תפוגה:</label>
                    <select
                      className="field-input"
                      value={editingCard.expMonth}
                      onChange={(e) => setEditingCard({ ...editingCard, expMonth: e.target.value })}
                    >
                      {Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0')).map((m) => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  </div>

                  <div className="field-group" style={{ flex: 1 }}>
                    <label className="field-label">שנת תפוגה:</label>
                    <select
                      className="field-input"
                      value={editingCard.expYear}
                      onChange={(e) => setEditingCard({ ...editingCard, expYear: e.target.value })}
                    >
                      {Array.from({ length: 14 }, (_, i) => String(25 + i)).map((y) => (
                        <option key={y} value={y}>20{y}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="field-group">
                  <label className="field-label">כינוי כרטיס (Nickname - אופציונלי):</label>
                  <input
                    type="text"
                    className="field-input"
                    placeholder="לדוגמה: כרטיס ראשי, כרטיס עבודה"
                    value={editingCard.nickname || ''}
                    onChange={(e) => setEditingCard({ ...editingCard, nickname: e.target.value })}
                  />
                </div>

                <div className="card-security-note">
                  <Icon name="lock" size={14} />
                  <span>כרטיס זה יישמר בהצפנת חומרה של Windows DPAPI (safeStorage) ולא ייחשף לגורמים חיצונים.</span>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn ghost" onClick={() => setEditingCard(null)}>
                  ביטול
                </button>
                <button type="submit" className="btn primary">
                  שמור כרטיס מאובטח
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ADD / EDIT ADDRESS */}
      {editingAddress && (
        <div className="modal-backdrop" onClick={() => setEditingAddress(null)}>
          <div className="modal-content address-editor-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingAddress.id ? 'עריכת כתובת' : 'הוספת כתובת חדשה'}</h3>
              <button className="btn-icon" onClick={() => setEditingAddress(null)}>
                <Icon name="x" size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveAddress}>
              <div className="modal-body">
                <div className="field-group">
                  <label className="field-label">שם מלא:</label>
                  <input
                    type="text"
                    className="field-input"
                    placeholder="ישראל ישראלי"
                    value={editingAddress.fullName}
                    onChange={(e) => setEditingAddress({ ...editingAddress, fullName: e.target.value })}
                    required
                    autoFocus
                  />
                </div>

                <div className="field-group">
                  <label className="field-label">חברה / ארגון (אופציונלי):</label>
                  <input
                    type="text"
                    className="field-input"
                    placeholder="חברה בע״מ"
                    value={editingAddress.company || ''}
                    onChange={(e) => setEditingAddress({ ...editingAddress, company: e.target.value })}
                  />
                </div>

                <div className="field-group">
                  <label className="field-label">רחוב ומספר בית (כולל דירה):</label>
                  <input
                    type="text"
                    className="field-input"
                    placeholder="רוטשילד 42, דירה 5"
                    value={editingAddress.streetAddress}
                    onChange={(e) => setEditingAddress({ ...editingAddress, streetAddress: e.target.value })}
                    required
                  />
                </div>

                <div className="field-row">
                  <div className="field-group" style={{ flex: 2 }}>
                    <label className="field-label">עיר:</label>
                    <input
                      type="text"
                      className="field-input"
                      placeholder="תל אביב"
                      value={editingAddress.city}
                      onChange={(e) => setEditingAddress({ ...editingAddress, city: e.target.value })}
                      required
                    />
                  </div>

                  <div className="field-group" style={{ flex: 1 }}>
                    <label className="field-label">מיקוד:</label>
                    <input
                      type="text"
                      className="field-input"
                      placeholder="6100000"
                      value={editingAddress.postalCode}
                      onChange={(e) => setEditingAddress({ ...editingAddress, postalCode: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="field-row">
                  <div className="field-group" style={{ flex: 1 }}>
                    <label className="field-label">מספר טלפון:</label>
                    <input
                      type="tel"
                      className="field-input"
                      placeholder="050-1234567"
                      value={editingAddress.phone || ''}
                      onChange={(e) => setEditingAddress({ ...editingAddress, phone: e.target.value })}
                    />
                  </div>

                  <div className="field-group" style={{ flex: 1 }}>
                    <label className="field-label">כתובת אימייל:</label>
                    <input
                      type="email"
                      className="field-input"
                      placeholder="israel@example.com"
                      value={editingAddress.email || ''}
                      onChange={(e) => setEditingAddress({ ...editingAddress, email: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn ghost" onClick={() => setEditingAddress(null)}>
                  ביטול
                </button>
                <button type="submit" className="btn primary">
                  שמור כתובת
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CONFIRM DELETE CARD MODAL */}
      {cardToDelete && (
        <div className="modal-backdrop" onClick={() => setCardToDelete(null)}>
          <div className="modal-content confirm-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>מחיקת כרטיס אשראי</h3>
              <button className="btn-icon" onClick={() => setCardToDelete(null)}>
                <Icon name="x" size={16} />
              </button>
            </div>
            <div className="modal-body">
              <p>האם אתה בטוח שברצונך למחוק את הכרטיס המסתים ב-<strong>{cardToDelete.lastFour}</strong>?</p>
              <p className="modal-hint">פעולה זו תמחק את הכרטיס המוצפן לצמיתות ולא ניתן יהיה למלא אותו אוטומטית.</p>
            </div>
            <div className="modal-footer">
              <button className="btn ghost" onClick={() => setCardToDelete(null)}>
                ביטול
              </button>
              <button className="btn danger" onClick={handleConfirmDeleteCard}>
                מחק כרטיס
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRM DELETE ADDRESS MODAL */}
      {addressToDelete && (
        <div className="modal-backdrop" onClick={() => setAddressToDelete(null)}>
          <div className="modal-content confirm-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>מחיקת כתובת</h3>
              <button className="btn-icon" onClick={() => setAddressToDelete(null)}>
                <Icon name="x" size={16} />
              </button>
            </div>
            <div className="modal-body">
              <p>האם אתה בטוח שברצונך למחוק את הכתובת של <strong>"{addressToDelete.fullName}"</strong> ({addressToDelete.streetAddress})?</p>
            </div>
            <div className="modal-footer">
              <button className="btn ghost" onClick={() => setAddressToDelete(null)}>
                ביטול
              </button>
              <button className="btn danger" onClick={handleConfirmDeleteAddress}>
                מחק כתובת
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
