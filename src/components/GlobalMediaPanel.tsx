import { useState } from 'react';
import type { BrowserState, TabState } from '../../shared/types';
import { cmd, cx } from '../lib';
import { Icon } from './Icon';
import { Favicon } from './Favicon';
import { playAmbientSound, stopAmbientSound } from '../lib/ambientSound';

interface Props {
  state: BrowserState;
  onClose: () => void;
}

export function GlobalMediaPanel({ state, onClose }: Props) {
  const [boostLevel, setBoostLevel] = useState<number>(100);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1.0);
  const [isLooping, setIsLooping] = useState<boolean>(false);
  const [ambientPlaying, setAmbientPlaying] = useState<string | null>(null);

  // Find target media tab
  const mediaTabId = state.media?.tabId;
  const activeMediaTab =
    (mediaTabId && state.tabs.find((t) => t.id === mediaTabId)) ||
    state.tabs.find((t) => t.audible) ||
    state.tabs.find((t) => t.id === state.activeTabId);

  const isPlaying = state.media ? state.media.playing : !!activeMediaTab?.audible;

  // All tabs currently playing sound
  const audibleTabs = state.tabs.filter((t) => t.audible);

  const handleTogglePlay = (tab: TabState) => {
    cmd({ type: 'media:control', id: tab.id, action: 'toggle' });
  };

  const handlePrev = (tab: TabState) => {
    cmd({ type: 'media:control', id: tab.id, action: 'prev' });
  };

  const handleNext = (tab: TabState) => {
    cmd({ type: 'media:control', id: tab.id, action: 'next' });
  };

  const handleRewind10 = (tab: TabState) => {
    cmd({ type: 'media:control', id: tab.id, action: 'backward' });
  };

  const handleForward10 = (tab: TabState) => {
    cmd({ type: 'media:control', id: tab.id, action: 'forward' });
  };

  const handlePiP = (tab: TabState) => {
    cmd({ type: 'media:control', id: tab.id, action: 'pip' });
  };

  const handleLoop = (tab: TabState) => {
    setIsLooping((prev) => !prev);
    cmd({ type: 'media:control', id: tab.id, action: 'loop' });
  };

  const handleSetSpeed = (tab: TabState, speed: number) => {
    setPlaybackSpeed(speed);
    cmd({ type: 'media:control', id: tab.id, action: 'speed', value: speed });
  };

  const handleSetBoost = (tab: TabState, percent: number) => {
    setBoostLevel(percent);
    const gain = percent / 100;
    cmd({ type: 'media:control', id: tab.id, action: 'boost', value: gain });
  };

  const toggleAmbient = (type: 'rain' | 'ocean' | 'binaural') => {
    if (ambientPlaying === type) {
      stopAmbientSound();
      setAmbientPlaying(null);
    } else {
      playAmbientSound(type);
      setAmbientPlaying(type);
    }
  };

  const getDomain = (url: string) => {
    try {
      return new URL(url).hostname.replace(/^www\./, '');
    } catch {
      return url;
    }
  };

  return (
    <div className="global-media-panel" dir="rtl">
      {/* Header */}
      <header className="media-panel-header">
        <div className="media-header-title-wrap">
          <div className="media-header-icon">
            <Icon name="music" size={18} />
          </div>
          <div>
            <h2 className="media-panel-title">בקרת מדיה וסאונד גלובלית</h2>
            <span className="media-panel-subtitle">
              שליטה בנגנים, תמונה בתוך תמונה (PiP) ומגבר שמע 300%
            </span>
          </div>
        </div>
        <button className="media-close-btn" onClick={onClose} title="סגור חלונית">
          <Icon name="x" size={15} />
        </button>
      </header>

      {/* Main Playing Card */}
      {activeMediaTab ? (
        <div className="media-active-card">
          <div className="media-card-top">
            <div className="media-tab-info">
              <Favicon tab={activeMediaTab} />
              <div className="media-text-wrap">
                <button
                  className="media-tab-title"
                  title={activeMediaTab.title}
                  onClick={() => cmd({ type: 'tab:activate', id: activeMediaTab.id })}
                >
                  {activeMediaTab.title || 'נגן מדיה ללא כותרת'}
                </button>
                <span className="media-tab-domain">
                  {getDomain(activeMediaTab.url)} •{' '}
                  {isPlaying ? 'מנגן כעת (Playing)' : 'מושהה (Paused)'}
                </span>
              </div>
            </div>

            <button
              className={cx('media-pip-btn', 'btn small')}
              title="פתח וידאו בחלון צף (Picture-in-Picture)"
              onClick={() => handlePiP(activeMediaTab)}
            >
              <Icon name="pip" size={15} />
              <span>חלון צף (PiP)</span>
            </button>
          </div>

          {/* Equalizer Visualizer animation when playing */}
          <div className="media-equalizer-bar">
            {[40, 75, 55, 90, 65, 80, 45, 95, 70, 85, 50, 60].map((h, i) => (
              <span
                key={i}
                className={cx('eq-bar', isPlaying && 'animating')}
                style={{
                  height: isPlaying ? `${h}%` : '20%',
                  animationDelay: `${i * 0.08}s`,
                }}
              />
            ))}
          </div>

          {/* Playback Controls Row */}
          <div className="media-controls-row">
            <button
              className="media-ctrl-btn"
              title="קודם"
              onClick={() => handlePrev(activeMediaTab)}
            >
              <Icon name="prev" size={16} />
            </button>
            <button
              className="media-ctrl-btn"
              title="10 שניות אחורה"
              onClick={() => handleRewind10(activeMediaTab)}
            >
              <span className="skip-text">-10s</span>
            </button>
            <button
              className="media-play-main-btn"
              title={isPlaying ? 'השהה (Space)' : 'נגן (Space)'}
              onClick={() => handleTogglePlay(activeMediaTab)}
            >
              <Icon name={isPlaying ? 'pause' : 'play'} size={20} />
            </button>
            <button
              className="media-ctrl-btn"
              title="10 שניות קדימה"
              onClick={() => handleForward10(activeMediaTab)}
            >
              <span className="skip-text">+10s</span>
            </button>
            <button
              className="media-ctrl-btn"
              title="הבא"
              onClick={() => handleNext(activeMediaTab)}
            >
              <Icon name="next" size={16} />
            </button>
            <button
              className={cx('media-ctrl-btn', isLooping && 'active')}
              title={isLooping ? 'לולאה פעילה' : 'הפעל לולאה'}
              onClick={() => handleLoop(activeMediaTab)}
            >
              <Icon name="split" size={14} />
            </button>
            <button
              className={cx('media-ctrl-btn', activeMediaTab.muted && 'muted')}
              title={activeMediaTab.muted ? 'בטל השתקה' : 'השתק כרטיסייה זו'}
              onClick={() =>
                cmd({
                  type: 'tab:set',
                  id: activeMediaTab.id,
                  muted: !activeMediaTab.muted,
                })
              }
            >
              <Icon name={activeMediaTab.muted ? 'muted' : 'speaker'} size={15} />
            </button>
          </div>

          {/* Speed Presets */}
          <div className="media-sub-section">
            <div className="sub-section-header">
              <span className="sub-section-label">מהירות ניגון (Speed):</span>
              <span className="sub-section-val">{playbackSpeed}x</span>
            </div>
            <div className="speed-chips-row">
              {[0.5, 0.75, 1.0, 1.25, 1.5, 2.0].map((s) => (
                <button
                  key={s}
                  className={cx('speed-chip', playbackSpeed === s && 'active')}
                  onClick={() => handleSetSpeed(activeMediaTab, s)}
                >
                  {s === 1.0 ? '1.0x (רגיל)' : `${s}x`}
                </button>
              ))}
            </div>
          </div>

          {/* Volume Booster 300% */}
          <div className="media-sub-section booster-section">
            <div className="sub-section-header">
              <div className="booster-title-wrap">
                <Icon name="bolt" size={14} />
                <span className="sub-section-label">מגבר שמע דיגיטלי (Gain Booster):</span>
              </div>
              <span className={cx('booster-val-badge', boostLevel > 100 && 'boosted')}>
                {boostLevel}% {boostLevel > 100 ? '⚡ BOOST' : 'רגיל'}
              </span>
            </div>

            <input
              type="range"
              min="100"
              max="300"
              step="10"
              value={boostLevel}
              onChange={(e) => handleSetBoost(activeMediaTab, Number(e.target.value))}
              className="media-boost-slider"
            />

            <div className="boost-presets-row">
              {[
                { label: '100% רגיל', val: 100 },
                { label: '150% מוגבר', val: 150 },
                { label: '200% עוצמתי', val: 200 },
                { label: '300% מקסימום', val: 300 },
              ].map((p) => (
                <button
                  key={p.val}
                  className={cx('boost-preset-btn', boostLevel === p.val && 'active')}
                  onClick={() => handleSetBoost(activeMediaTab, p.val)}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="media-empty-state">
          <Icon name="music" size={36} />
          <p>אין כרטיסיות שמנגנות מדיה כרגע.</p>
        </div>
      )}

      {/* Other Audible Tabs */}
      {audibleTabs.length > 1 && (
        <div className="audible-tabs-list-section">
          <span className="audible-section-title">כרטיסיות נוספות שמשמיעות קול:</span>
          <div className="audible-tabs-list">
            {audibleTabs
              .filter((t) => t.id !== activeMediaTab?.id)
              .map((t) => (
                <div key={t.id} className="audible-tab-row">
                  <Favicon tab={t} />
                  <span className="audible-tab-name" title={t.title}>
                    {t.title}
                  </span>
                  <div className="audible-tab-actions">
                    <button
                      className="btn small"
                      onClick={() => cmd({ type: 'tab:activate', id: t.id })}
                    >
                      עבור לכרטיסייה
                    </button>
                    <button
                      className="btn small"
                      onClick={() => cmd({ type: 'tab:set', id: t.id, muted: !t.muted })}
                    >
                      <Icon name={t.muted ? 'muted' : 'speaker'} size={13} />
                    </button>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Built-in Zen Audio Focus Ambient Sounds */}
      <div className="zen-ambient-quick-section">
        <span className="audible-section-title">צלילי רקע ופוקוס מובנים (Drift Zen Aura):</span>
        <div className="ambient-buttons-grid">
          <button
            className={cx('ambient-quick-btn', ambientPlaying === 'rain' && 'playing')}
            onClick={() => toggleAmbient('rain')}
          >
            <Icon name={ambientPlaying === 'rain' ? 'pause' : 'play'} size={13} />
            <span>🌧️ גשם מרגיע (Pink Rain)</span>
          </button>
          <button
            className={cx('ambient-quick-btn', ambientPlaying === 'ocean' && 'playing')}
            onClick={() => toggleAmbient('ocean')}
          >
            <Icon name={ambientPlaying === 'ocean' ? 'pause' : 'play'} size={13} />
            <span>🌊 גלי אוקיינוס (Ocean)</span>
          </button>
          <button
            className={cx('ambient-quick-btn', ambientPlaying === 'binaural' && 'playing')}
            onClick={() => toggleAmbient('binaural')}
          >
            <Icon name={ambientPlaying === 'binaural' ? 'pause' : 'play'} size={13} />
            <span>🧠 גלי אלפא 10Hz (Focus)</span>
          </button>
        </div>
      </div>
    </div>
  );
}
