import { useEffect, useState } from 'react';
import type { BrowserState, VpnStatus } from '../../shared/types';
import type { VpnLocationId } from '../../shared/settings';
import { cmd, cx } from '../lib';
import { Icon } from './Icon';
import { VPN_LOCATIONS } from '../../electron/vpn';
import { VPN_URL } from '../../shared/url';

interface Props {
  state: BrowserState;
  onClose: () => void;
}

export function VpnPanel({ state, onClose }: Props) {
  const vpn = state.settings.vpn;
  const [status, setStatus] = useState<VpnStatus | null>(null);

  useEffect(() => {
    let active = true;
    const fetchStatus = () => {
      window.drift.getVpnStatus?.().then((res) => {
        if (active && res) setStatus(res);
      });
    };
    fetchStatus();
    const interval = setInterval(fetchStatus, 2500);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [vpn.enabled, vpn.mode, vpn.builtinLocation]);

  const toggleVpn = () => {
    cmd({
      type: 'settings:set',
      patch: { vpn: { enabled: !vpn.enabled } },
    });
  };

  const changeLocation = (locId: VpnLocationId) => {
    cmd({
      type: 'settings:set',
      patch: { vpn: { builtinLocation: locId, mode: 'builtin', enabled: true } },
    });
  };

  const openFullManager = () => {
    onClose();
    cmd({ type: 'tab:new', url: VPN_URL });
  };

  const locationsList = Object.values(VPN_LOCATIONS);
  const activeLoc = VPN_LOCATIONS[vpn.builtinLocation] || VPN_LOCATIONS['ch-zurich'];

  return (
    <div className="vpn-popover" dir="rtl">
      <div className="vpn-popover-header">
        <div className="vpn-popover-title">
          <span className={cx('vpn-shield-icon', vpn.enabled && 'active')}>
            <Icon name="shield" size={18} />
          </span>
          <div>
            <div className="vpn-heading">Drift Secure VPN & Proxy</div>
            <div className="vpn-subheading">
              {vpn.enabled
                ? vpn.mode === 'custom'
                  ? 'מחובר דרך שרת VPN פרטי'
                  : `מחובר דרך ${activeLoc.countryHe} (${activeLoc.cityHe})`
                : 'הגנת ה-VPN מושבתת כרגע'}
            </div>
          </div>
        </div>
        <button className="vpn-close-btn" onClick={onClose} title="סגור חלונית">
          <Icon name="x" size={14} />
        </button>
      </div>

      <div className="vpn-power-card">
        <div className="vpn-power-status">
          <span className={cx('vpn-dot', vpn.enabled && 'online')} />
          <span className="vpn-status-text">
            {vpn.enabled ? 'מצב הגנה מירבי: פעיל' : 'מצב גלישה: ישיר (ללא הצפנה)'}
          </span>
        </div>
        <button
          className={cx('vpn-toggle-button', vpn.enabled && 'on')}
          onClick={toggleVpn}
          title={vpn.enabled ? 'השבת VPN' : 'הפעל VPN'}
        >
          <span className="vpn-switch-slider" />
          <span className="vpn-switch-label">{vpn.enabled ? 'מופעל' : 'כבוי'}</span>
        </button>
      </div>

      {vpn.enabled && status && (
        <div className="vpn-live-info-box">
          <div className="vpn-stat-row">
            <span className="vpn-stat-label">כתובת IP וירטואלית:</span>
            <span className="vpn-stat-val mono">{status.ip}</span>
          </div>
          <div className="vpn-stat-row">
            <span className="vpn-stat-label">פרוטוקול והצפנה:</span>
            <span className="vpn-stat-val">{vpn.mode === 'custom' ? `${vpn.customServer.protocol.toUpperCase()} Tunnel` : 'WireGuard Pro (ChaCha20)'}</span>
          </div>
          <div className="vpn-stat-row">
            <span className="vpn-stat-label">זמן חיבור (Uptime):</span>
            <span className="vpn-stat-val mono">
              {Math.floor(status.uptimeSeconds / 60)} דק' {status.uptimeSeconds % 60} שנ'
            </span>
          </div>
          <div className="vpn-stat-row">
            <span className="vpn-stat-label">מהירות ושיהוי (Ping):</span>
            <span className="vpn-stat-val ping">{status.pingMs}ms</span>
          </div>
        </div>
      )}

      {vpn.mode === 'builtin' && (
        <div className="vpn-locations-section">
          <div className="vpn-section-title">
            <span>בחר מיקום שרת:</span>
            <span className="vpn-nodes-count">{locationsList.length} שרתים זמינים</span>
          </div>
          <div className="vpn-locations-list">
            {locationsList.map((loc) => {
              const isSelected = vpn.builtinLocation === loc.id;
              return (
                <button
                  key={loc.id}
                  className={cx('vpn-location-chip', isSelected && 'active')}
                  onClick={() => changeLocation(loc.id as VpnLocationId)}
                >
                  <span className="loc-flag">{loc.flag}</span>
                  <div className="loc-text">
                    <span className="loc-name">{loc.countryHe}</span>
                    <span className="loc-city">{loc.cityHe}</span>
                  </div>
                  <span className="loc-ping">{loc.ping}ms</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {vpn.mode === 'custom' && (
        <div className="vpn-custom-badge">
          <Icon name="sliders" size={14} />
          <span>מוגדר חיבור שרת VPN / פרוקסי פרטי:</span>
          <strong>{vpn.customServer.host || 'לא הוזן שרת'}</strong>
        </div>
      )}

      <div className="vpn-popover-footer">
        <button className="vpn-full-settings-btn" onClick={openFullManager}>
          <Icon name="gear" size={13} />
          <span>הגדרות VPN מתקדמות וחיבור פרטי</span>
        </button>
      </div>
    </div>
  );
}
