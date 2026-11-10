interface ArtworkProps {
  itemId: string;
  slideIdx?: number;
  className?: string;
}

export function StoreArtwork({ itemId, slideIdx = 0, className = '' }: ArtworkProps) {
  switch (itemId) {
    case 'drift-shield-pro':
      return slideIdx === 0 ? (
        /* Shield Pro - Screenshot 1: Multi-layer Fingerprint Defense HUD */
        <div className={`store-artwork-screen shield-screen-1 ${className}`}>
          <div className="art-window-bar">
            <span className="art-dot art-red" />
            <span className="art-dot art-yellow" />
            <span className="art-dot art-green" />
            <span className="art-bar-title">🛡️ Drift Shield Pro — Anti-Fingerprint Active Matrix</span>
          </div>
          <div className="art-screen-content shield-hud">
            <div className="shield-radar-box">
              <svg viewBox="0 0 100 100" className="shield-radar-svg">
                <circle cx="50" cy="50" r="45" fill="none" stroke="rgba(56, 189, 248, 0.2)" strokeWidth="1" />
                <circle cx="50" cy="50" r="30" fill="none" stroke="rgba(56, 189, 248, 0.3)" strokeWidth="1" />
                <circle cx="50" cy="50" r="15" fill="none" stroke="rgba(56, 189, 248, 0.4)" strokeWidth="1" />
                <line x1="5" y1="50" x2="95" y2="50" stroke="rgba(56, 189, 248, 0.2)" strokeWidth="1" />
                <line x1="50" y1="5" x2="50" y2="95" stroke="rgba(56, 189, 248, 0.2)" strokeWidth="1" />
                <path d="M 50 50 L 85 20 A 45 45 0 0 0 50 5 Z" fill="url(#radarGlow)" opacity="0.6" className="radar-sweep" />
                <circle cx="50" cy="50" r="6" fill="#38bdf8" />
                <defs>
                  <linearGradient id="radarGlow" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.8" />
                    <stop offset="100%" stopColor="#0284c7" stopOpacity="0" />
                  </linearGradient>
                </defs>
              </svg>
              <div className="shield-radar-pulse" />
              <div className="shield-radar-label">SAFE ZONE · 100% BLOCKED</div>
            </div>

            <div className="shield-metrics-col">
              <div className="shield-hud-item active">
                <span className="hud-badge-ok">ACTIVE</span>
                <span className="hud-text">Canvas 2D: Hash Spoofed (Deterministic Noise)</span>
              </div>
              <div className="shield-hud-item active">
                <span className="hud-badge-ok">ACTIVE</span>
                <span className="hud-text">WebGL: Apple M3 Max [Vendor Cloaked]</span>
              </div>
              <div className="shield-hud-item active">
                <span className="hud-badge-ok">ACTIVE</span>
                <span className="hud-text">AudioContext: 128-bit Frequency Jitter</span>
              </div>
              <div className="shield-hud-item active">
                <span className="hud-badge-ok">BLOCKED</span>
                <span className="hud-text">Battery Status API & Device Sensors</span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Shield Pro - Screenshot 2: Real-time IDN Homograph Phishing Blocker */
        <div className={`store-artwork-screen shield-screen-2 ${className}`}>
          <div className="art-window-bar">
            <span className="art-dot art-red" />
            <span className="art-dot art-yellow" />
            <span className="art-dot art-green" />
            <span className="art-bar-title">⚠️ Real-Time Threat Interception Alert</span>
          </div>
          <div className="art-screen-content phishing-hud">
            <div className="phishing-alert-box">
              <div className="phishing-icon">🚨</div>
              <div className="phishing-details">
                <div className="phishing-title">נחסמה גישה לאתר מתחזה (IDN Homograph Phishing)</div>
                <div className="phishing-url">
                  כתובת מקורית: <span className="clean-domain">paypal.com</span> | כתובת מזויפת שזוהתה:{' '}
                  <span className="fake-domain">pаypаl.com (Cyrillic 'а')</span>
                </div>
              </div>
            </div>
            <div className="phishing-actions-row">
              <span className="phishing-btn-safe">✓ חזור למקום מבטחים</span>
              <span className="phishing-status">0 דליפות מידע · הדפדפן מוגן</span>
            </div>
          </div>
        </div>
      );

    case 'drift-zen-aura':
      return slideIdx === 0 ? (
        /* Zen Aura - Screenshot 1: Ambient Focus Waveform Player */
        <div className={`store-artwork-screen zen-screen-1 ${className}`}>
          <div className="art-window-bar">
            <span className="art-dot art-red" />
            <span className="art-dot art-yellow" />
            <span className="art-dot art-green" />
            <span className="art-bar-title">🎧 Drift Zen Aura — 100% Offline Ambient Sound Engine</span>
          </div>
          <div className="art-screen-content zen-hud">
            <div className="zen-equalizer-bars">
              <span className="eq-bar bar-1" />
              <span className="eq-bar bar-2" />
              <span className="eq-bar bar-3" />
              <span className="eq-bar bar-4" />
              <span className="eq-bar bar-5" />
              <span className="eq-bar bar-6" />
              <span className="eq-bar bar-7" />
              <span className="eq-bar bar-8" />
              <span className="eq-bar bar-9" />
              <span className="eq-bar bar-10" />
              <span className="eq-bar bar-11" />
              <span className="eq-bar bar-12" />
            </div>
            <div className="zen-sound-info">
              <div className="zen-now-playing">🌧️ נגן גשם מרגיע (Natural Pink Noise)</div>
              <div className="zen-sub-playing">סינתזה בזמן אמת ב-Web Audio · ללא קבצים חיצוניים · פוקוס מרבי</div>
            </div>
            <div className="zen-slider-mock">
              <span className="slider-icon">🔈</span>
              <div className="slider-track"><div className="slider-fill" style={{ width: '65%' }} /></div>
              <span className="slider-val">65%</span>
            </div>
          </div>
        </div>
      ) : (
        /* Zen Aura - Screenshot 2: Binaural Alpha Beats 10Hz Focus */
        <div className={`store-artwork-screen zen-screen-2 ${className}`}>
          <div className="art-window-bar">
            <span className="art-dot art-red" />
            <span className="art-dot art-yellow" />
            <span className="art-dot art-green" />
            <span className="art-bar-title">🧠 10Hz Alpha Waves · Deep Study & Flow State</span>
          </div>
          <div className="art-screen-content binaural-hud">
            <svg viewBox="0 0 300 80" className="binaural-wave-svg">
              <path
                d="M 0 40 Q 37.5 10 75 40 T 150 40 T 225 40 T 300 40"
                fill="none"
                stroke="#e879f9"
                strokeWidth="3"
                className="wave-line-1"
              />
              <path
                d="M 0 40 Q 37.5 70 75 40 T 150 40 T 225 40 T 300 40"
                fill="none"
                stroke="#38bdf8"
                strokeWidth="2"
                strokeDasharray="4 4"
                className="wave-line-2"
              />
            </svg>
            <div className="binaural-caption">
              <span>אוזן שמאל: 200Hz</span>
              <span className="binaural-center-pill">גלי אלפא 10Hz מסונכרנים</span>
              <span>אוזן ימין: 210Hz</span>
            </div>
          </div>
        </div>
      );

    case 'drift-scratchpad':
      return slideIdx === 0 ? (
        /* Scratchpad - Screenshot 1: Dark Monokai Code Editor */
        <div className={`store-artwork-screen pad-screen-1 ${className}`}>
          <div className="art-window-bar">
            <span className="art-dot art-red" />
            <span className="art-dot art-yellow" />
            <span className="art-dot art-green" />
            <span className="art-bar-title">📝 quick-notes.ts — Local Storage Scratchpad</span>
          </div>
          <div className="art-screen-content pad-hud">
            <div className="pad-code-lines">
              <div className="code-line"><span className="ln">1</span><span className="kw">const</span> <span className="fn">task</span> = <span className="str">"לסיים את הפרויקט עד מחר בבוקר"</span>;</div>
              <div className="code-line"><span className="ln">2</span><span className="kw">const</span> <span className="fn">securityCheck</span> = <span className="bool">true</span>;</div>
              <div className="code-line"><span className="ln">3</span><span className="cm">// הערות וקוד נשמרים מקומית באופן מיידי ללא שרתים</span></div>
              <div className="code-line"><span className="ln">4</span><span className="kw">await</span> drift.<span className="fn">encryptAndSave</span>(task);</div>
            </div>
            <div className="pad-status-bar">
              <span>UTF-8</span>
              <span>TypeScript / Markdown</span>
              <span>✓ נשמר מקומית (0 שניות)</span>
            </div>
          </div>
        </div>
      ) : (
        /* Scratchpad - Screenshot 2: Interactive Checkable Todo List */
        <div className={`store-artwork-screen pad-screen-2 ${className}`}>
          <div className="art-window-bar">
            <span className="art-dot art-red" />
            <span className="art-dot art-yellow" />
            <span className="art-dot art-green" />
            <span className="art-bar-title">📋 רשימת משימות אישית ופתקים מהירים</span>
          </div>
          <div className="art-screen-content todo-hud">
            <div className="todo-row done">
              <span className="todo-check">✓</span>
              <span className="todo-text">הגדרת מערך אבטחה מקסימאלי בדפדפן</span>
            </div>
            <div className="todo-row done">
              <span className="todo-check">✓</span>
              <span className="todo-text">הפעלת מצב שמע ופוקוס לגלישה ללא הסחות דעת</span>
            </div>
            <div className="todo-row active">
              <span className="todo-check">○</span>
              <span className="todo-text">בדיקת אישורי SSL והצפנה בכל האתרים</span>
            </div>
          </div>
        </div>
      );

    case 'drift-focus-timer':
      return slideIdx === 0 ? (
        /* Pomodoro - Screenshot 1: Glowing Circular Timer Dial */
        <div className={`store-artwork-screen pomo-screen-1 ${className}`}>
          <div className="art-window-bar">
            <span className="art-dot art-red" />
            <span className="art-dot art-yellow" />
            <span className="art-dot art-green" />
            <span className="art-bar-title">⏱️ Pomodoro Sprint · 25 Minutes Deep Work</span>
          </div>
          <div className="art-screen-content pomo-hud">
            <div className="pomo-circle-wrap">
              <svg viewBox="0 0 100 100" className="pomo-circle-svg">
                <circle cx="50" cy="50" r="40" fill="none" stroke="rgba(251, 113, 133, 0.2)" strokeWidth="6" />
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  fill="none"
                  stroke="#fb7185"
                  strokeWidth="6"
                  strokeDasharray="251.2"
                  strokeDashoffset="62.8"
                  strokeLinecap="round"
                  transform="rotate(-90 50 50)"
                />
              </svg>
              <div className="pomo-time-center">
                <span className="pomo-digits-large">18:45</span>
                <span className="pomo-state-label">ריכוז עמוק</span>
              </div>
            </div>
            <div className="pomo-hud-meta">
              <div className="pomo-sprint-badge">ספרינט 3 מתוך 4 🔥</div>
              <div className="pomo-break-info">הפסקה הבאה: 5 דקות של תה ומרגוע</div>
            </div>
          </div>
        </div>
      ) : (
        /* Pomodoro - Screenshot 2: Daily Focus Stats */
        <div className={`store-artwork-screen pomo-screen-2 ${className}`}>
          <div className="art-window-bar">
            <span className="art-dot art-red" />
            <span className="art-dot art-yellow" />
            <span className="art-dot art-green" />
            <span className="art-bar-title">📊 סיכום שעות ריכוז ופרודוקטיביות יומית</span>
          </div>
          <div className="art-screen-content pomo-stats-hud">
            <div className="stats-bars-row">
              <div className="stat-col"><div className="stat-bar" style={{ height: '50%' }} /><span>א׳</span></div>
              <div className="stat-col"><div className="stat-bar" style={{ height: '75%' }} /><span>ב׳</span></div>
              <div className="stat-col"><div className="stat-bar" style={{ height: '60%' }} /><span>ג׳</span></div>
              <div className="stat-col"><div className="stat-bar" style={{ height: '90%' }} /><span>ד׳</span></div>
              <div className="stat-col active"><div className="stat-bar" style={{ height: '100%' }} /><span>היום</span></div>
            </div>
            <div className="stats-summary-text">סה״כ היום: 4.5 שעות עבודה ממוקדת ללא הסחות דעת! 🏆</div>
          </div>
        </div>
      );

    case 'drift-security-auditor':
      return slideIdx === 0 ? (
        /* Security Auditor - Screenshot 1: Live SSL/TLS & CSP Inspector */
        <div className={`store-artwork-screen auditor-screen-1 ${className}`}>
          <div className="art-window-bar">
            <span className="art-dot art-red" />
            <span className="art-dot art-yellow" />
            <span className="art-dot art-green" />
            <span className="art-bar-title">🔒 Real-Time SSL & Domain Security Inspector</span>
          </div>
          <div className="art-screen-content auditor-hud">
            <div className="auditor-grade-card">
              <div className="grade-circle">A+</div>
              <div className="grade-text">
                <div className="grade-headline">רמת הצפנה מקסימאלית</div>
                <div className="grade-sub">TLS 1.3 · ChaCha20-Poly1305 · 4096-bit RSA</div>
              </div>
            </div>
            <div className="auditor-checks-list">
              <div className="aud-row ok"><span>✓ תעודת SSL חתומה ותקפה (DigiCert High Assurance)</span></div>
              <div className="aud-row ok"><span>✓ מדיניות CSP מחמירה חוסמת הזרקת סקריפטים (XSS)</span></div>
              <div className="aud-row ok"><span>✓ כותרת X-Frame-Options מונעת Clickjacking</span></div>
              <div className="aud-row ok"><span>✓ Strict-Transport-Security (HSTS Preloaded)</span></div>
            </div>
          </div>
        </div>
      ) : (
        /* Security Auditor - Screenshot 2: Mixed Content & Port Scanner */
        <div className={`store-artwork-screen auditor-screen-2 ${className}`}>
          <div className="art-window-bar">
            <span className="art-dot art-red" />
            <span className="art-dot art-yellow" />
            <span className="art-dot art-green" />
            <span className="art-bar-title">🛡️ סורק דליפות תוכן מעורב (Mixed Content)</span>
          </div>
          <div className="art-screen-content mixed-hud">
            <div className="mixed-scan-row">
              <span className="scan-icon">🔍</span>
              <span className="scan-text">נסרקו 48 בקשות רשת · 0 בקשות לא מוצפנות</span>
            </div>
            <div className="mixed-pills-grid">
              <span className="mixed-pill ok">✓ תמונות מוצפנות 100%</span>
              <span className="mixed-pill ok">✓ סקריפטים מוגנים ב-SRI</span>
              <span className="mixed-pill ok">✓ חיבורי WebSockets מוצפנים (WSS)</span>
            </div>
          </div>
        </div>
      );

    case 'drift-video-booster':
      return slideIdx === 0 ? (
        /* Video Booster - Screenshot 1: 300% Audio Gain & PiP Controller */
        <div className={`store-artwork-screen video-screen-1 ${className}`}>
          <div className="art-window-bar">
            <span className="art-dot art-red" />
            <span className="art-dot art-yellow" />
            <span className="art-dot art-green" />
            <span className="art-bar-title">🎬 Video Popout & 300% Audio Boost Controller</span>
          </div>
          <div className="art-screen-content video-hud">
            <div className="video-pip-preview">
              <div className="pip-video-badge">🖼️ Floating Picture-in-Picture</div>
              <div className="pip-play-btn">▶</div>
            </div>
            <div className="video-controls-side">
              <div className="gain-meter-header">
                <span>מגבר ווליום דיגיטלי:</span>
                <span className="gain-val">300% BOOST 🔥</span>
              </div>
              <div className="gain-bar-track">
                <div className="gain-bar-fill" style={{ width: '85%' }} />
              </div>
              <div className="speed-pills-row">
                <span className="spd-pill">1.0x</span>
                <span className="spd-pill">1.25x</span>
                <span className="spd-pill active">1.5x</span>
                <span className="spd-pill">2.0x</span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Video Booster - Screenshot 2: Equalizer EQ Tuner */
        <div className={`store-artwork-screen video-screen-2 ${className}`}>
          <div className="art-window-bar">
            <span className="art-dot art-red" />
            <span className="art-dot art-yellow" />
            <span className="art-dot art-green" />
            <span className="art-bar-title">🎚️ אקולייזר מקצועי לשיפור דיבור וקול בסרטונים</span>
          </div>
          <div className="art-screen-content eq-hud">
            <div className="eq-sliders-row">
              <div className="eq-col"><div className="eq-fader" style={{ height: '70%' }} /><span>Bass</span></div>
              <div className="eq-col"><div className="eq-fader" style={{ height: '55%' }} /><span>Low</span></div>
              <div className="eq-col"><div className="eq-fader" style={{ height: '90%' }} /><span>Vocal</span></div>
              <div className="eq-col"><div className="eq-fader" style={{ height: '80%' }} /><span>Treble</span></div>
            </div>
            <div className="eq-preset-badge">פרופיל פעיל: שמיעת דיבור וקול צלול (Vocal Clarity Pro)</div>
          </div>
        </div>
      );

    case 'drift-reader-mode':
      return slideIdx === 0 ? (
        /* Reader Mode - Screenshot 1: Editorial Distraction-free Article Layout */
        <div className={`store-artwork-screen reader-screen-1 ${className}`}>
          <div className="art-window-bar">
            <span className="art-dot art-red" />
            <span className="art-dot art-yellow" />
            <span className="art-dot art-green" />
            <span className="art-bar-title">📖 Drift Clean Reader · 4 min read</span>
          </div>
          <div className="art-screen-content reader-hud">
            <div className="reader-mock-title">עתיד הגלישה המאובטחת: למה פרטיות היא זכות בסיסית</div>
            <div className="reader-mock-lines">
              <div className="reader-line" style={{ width: '96%' }} />
              <div className="reader-line" style={{ width: '92%' }} />
              <div className="reader-line" style={{ width: '88%' }} />
              <div className="reader-line" style={{ width: '60%' }} />
            </div>
            <div className="reader-toolbar-preview">
              <span className="rtb-pill">A-</span>
              <span className="rtb-pill">A+</span>
              <span className="rtb-pill active">ספיה חמה</span>
              <span className="rtb-pill">כהה OLED</span>
              <span className="rtb-pill tts">🔊 הקרא מאמר</span>
            </div>
          </div>
        </div>
      ) : (
        /* Reader Mode - Screenshot 2: TTS Read Aloud Active Speech Narration */
        <div className={`store-artwork-screen reader-screen-2 ${className}`}>
          <div className="art-window-bar">
            <span className="art-dot art-red" />
            <span className="art-dot art-yellow" />
            <span className="art-dot art-green" />
            <span className="art-bar-title">🎙️ הקראה קולית חיה (Text-to-Speech)</span>
          </div>
          <div className="art-screen-content tts-hud">
            <div className="tts-speech-bubble">
              <span className="tts-icon">🔊</span>
              <span className="tts-highlighted">״...גלישה מאובטחת ללא מעקב מסחרי וללא פרסומות פולשניות...״</span>
            </div>
            <div className="tts-progress-track">
              <div className="tts-progress-fill" style={{ width: '45%' }} />
            </div>
            <div className="tts-ctrl-row">
              <span>מהירות: 1.0x</span>
              <span className="tts-btn">⏸ השהה הקראה</span>
              <span>קול: עברית (טבעי)</span>
            </div>
          </div>
        </div>
      );

    case 'drift-dark-reader':
      return slideIdx === 0 ? (
        /* Dark Reader - Screenshot 1: Split Screen Light vs Dark OLED */
        <div className={`store-artwork-screen dark-screen-1 ${className}`}>
          <div className="art-window-bar">
            <span className="art-dot art-red" />
            <span className="art-dot art-yellow" />
            <span className="art-dot art-green" />
            <span className="art-bar-title">🌙 Drift Dark Reader Max — OLED Dark Mode Engine</span>
          </div>
          <div className="art-screen-content dark-split-hud">
            <div className="split-left-light">
              <div className="split-label">אתר רגיל (בוהק ומסנוור) ☀️</div>
              <div className="split-mock-box light" />
            </div>
            <div className="split-divider">
              <span className="divider-icon">⚡</span>
            </div>
            <div className="split-right-dark">
              <div className="split-label">לאחר הפעלת התוסף (OLED שחור) 🌙</div>
              <div className="split-mock-box dark" />
            </div>
          </div>
        </div>
      ) : (
        /* Dark Reader - Screenshot 2: Contrast & Sepia Controls */
        <div className={`store-artwork-screen dark-screen-2 ${className}`}>
          <div className="art-window-bar">
            <span className="art-dot art-red" />
            <span className="art-dot art-yellow" />
            <span className="art-dot art-green" />
            <span className="art-bar-title">🎛️ התאמת בהירות, ניגודיות וסינון אור כחול</span>
          </div>
          <div className="art-screen-content dark-ctrls-hud">
            <div className="ctrl-slider-item">
              <span>בהירות:</span>
              <div className="slider-track"><div className="slider-fill" style={{ width: '85%' }} /></div>
              <span>85%</span>
            </div>
            <div className="ctrl-slider-item">
              <span>ניגודיות:</span>
              <div className="slider-track"><div className="slider-fill" style={{ width: '90%' }} /></div>
              <span>90%</span>
            </div>
            <div className="ctrl-slider-item">
              <span>סינון אור כחול (Sepia):</span>
              <div className="slider-track"><div className="slider-fill" style={{ width: '40%' }} /></div>
              <span>40%</span>
            </div>
          </div>
        </div>
      );

    case 'drift-dev-tools':
      return slideIdx === 0 ? (
        /* DevTools - Screenshot 1: Formatted JSON Tree & Color Pipette */
        <div className={`store-artwork-screen dev-screen-1 ${className}`}>
          <div className="art-window-bar">
            <span className="art-dot art-red" />
            <span className="art-dot art-yellow" />
            <span className="art-dot art-green" />
            <span className="art-bar-title">🛠️ Drift DevTools Pro — JSON, Base64 & Pipette</span>
          </div>
          <div className="art-screen-content dev-hud">
            <div className="dev-json-tree">
              <div className="json-line"><span className="j-bracket">{'{'}</span></div>
              <div className="json-line indent"><span className="j-key">"status"</span>: <span className="j-val-str">"online"</span>,</div>
              <div className="json-line indent"><span className="j-key">"securityScore"</span>: <span className="j-val-num">100</span>,</div>
              <div className="json-line indent"><span className="j-key">"sandbox"</span>: <span className="j-val-bool">true</span></div>
              <div className="json-line"><span className="j-bracket">{'}'}</span></div>
            </div>
            <div className="dev-pipette-box">
              <div className="pipette-color-circle" style={{ background: '#38bdf8' }} />
              <div className="pipette-color-codes">
                <span>HEX: #38bdf8</span>
                <span>RGB: 56, 189, 248</span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* DevTools - Screenshot 2: Regex & Base64 Sandbox */
        <div className={`store-artwork-screen dev-screen-2 ${className}`}>
          <div className="art-window-bar">
            <span className="art-dot art-red" />
            <span className="art-dot art-yellow" />
            <span className="art-dot art-green" />
            <span className="art-bar-title">⚡ בודק ביטויים רגולריים (Regex Tester) חי</span>
          </div>
          <div className="art-screen-content regex-hud">
            <div className="regex-input-box">{'/[a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\\.[a-zA-Z]{2,5}/g'}</div>
            <div className="regex-match-output">
              <span>התאמה נמצאה: </span>
              <span className="match-tag">developer@drift-browser.com</span>
            </div>
          </div>
        </div>
      );

    case 'drift-speed-booster':
      return slideIdx === 0 ? (
        /* Speed Booster - Screenshot 1: RAM Saver Gauge & Turbo Engine */
        <div className={`store-artwork-screen speed-screen-1 ${className}`}>
          <div className="art-window-bar">
            <span className="art-dot art-red" />
            <span className="art-dot art-yellow" />
            <span className="art-dot art-green" />
            <span className="art-bar-title">🚀 Drift Turbo Speed & RAM Saver Pro</span>
          </div>
          <div className="art-screen-content speed-hud">
            <div className="speed-gauge-wrap">
              <svg viewBox="0 0 100 60" className="speed-gauge-svg">
                <path d="M 15 50 A 35 35 0 0 1 85 50" fill="none" stroke="rgba(245, 158, 11, 0.2)" strokeWidth="8" strokeLinecap="round" />
                <path
                  d="M 15 50 A 35 35 0 0 1 85 50"
                  fill="none"
                  stroke="#f59e0b"
                  strokeWidth="8"
                  strokeDasharray="110"
                  strokeDashoffset="28"
                  strokeLinecap="round"
                />
              </svg>
              <div className="speed-center-text">
                <span className="speed-pct">65%</span>
                <span className="speed-sub">חיסכון בזיכרון RAM</span>
              </div>
            </div>
            <div className="speed-stats-col">
              <div className="speed-metric-item">
                <span className="spd-badge turbo">TURBO</span>
                <span>טעינת דפים מואצת ב-3.4x</span>
              </div>
              <div className="speed-metric-item">
                <span className="spd-badge ram">1.8 GB</span>
                <span>זיכרון RAM ששוחרר אוטומטית</span>
              </div>
              <div className="speed-metric-item">
                <span className="spd-badge cache">CACHE</span>
                <span>שמירת נכסים סטטיים מקומית</span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Speed Booster - Screenshot 2: Predictive Navigation Graph */
        <div className={`store-artwork-screen speed-screen-2 ${className}`}>
          <div className="art-window-bar">
            <span className="art-dot art-red" />
            <span className="art-dot art-yellow" />
            <span className="art-dot art-green" />
            <span className="art-bar-title">⚡ מנוע חיזוי וטעינה מוקדמת חכמה (Speculative Prerender)</span>
          </div>
          <div className="art-screen-content prerender-hud">
            <div className="prerender-graph">
              <div className="graph-col"><div className="graph-bar" style={{ height: '35%' }} /><span>לפני</span></div>
              <div className="graph-col fast"><div className="graph-bar" style={{ height: '95%' }} /><span>לאחר ההאצה</span></div>
            </div>
            <div className="prerender-summary">
              <div className="prerender-title">זמן טעינת אתר ממוצע: 180ms בלבד!</div>
              <div className="prerender-tags">
                <span className="ptag">✓ DNS Prefetch</span>
                <span className="ptag">✓ TCP Preconnect</span>
                <span className="ptag">✓ Brotli Fast Decompress</span>
              </div>
            </div>
          </div>
        </div>
      );

    case 'drift-translator':
      return slideIdx === 0 ? (
        /* Translator - Screenshot 1: Local Offline Translation */
        <div className={`store-artwork-screen trans-screen-1 ${className}`}>
          <div className="art-window-bar">
            <span className="art-dot art-red" />
            <span className="art-dot art-yellow" />
            <span className="art-dot art-green" />
            <span className="art-bar-title">🌐 Drift Local Translator — 100% Offline AI</span>
          </div>
          <div className="art-screen-content trans-hud">
            <div className="trans-box-wrap">
              <div className="trans-pane left">
                <div className="trans-lang-tag">אנגלית (מקור)</div>
                <div className="trans-text">"Browse the web with unprecedented security and lightning speed."</div>
              </div>
              <div className="trans-arrow">⇄</div>
              <div className="trans-pane right">
                <div className="trans-lang-tag">עברית (תרגום מקומי)</div>
                <div className="trans-text">״גלוש ברשת עם אבטחה חסרת תקדים ומהירות ברק.״</div>
              </div>
            </div>
            <div className="trans-privacy-pill">
              <span>🔒 ללא שליחת טקסט לענן · פרטיות 100% במחשב שלך</span>
            </div>
          </div>
        </div>
      ) : (
        /* Translator - Screenshot 2: In-Page Hover Translation Bubble */
        <div className={`store-artwork-screen trans-screen-2 ${className}`}>
          <div className="art-window-bar">
            <span className="art-dot art-red" />
            <span className="art-dot art-yellow" />
            <span className="art-dot art-green" />
            <span className="art-bar-title">💬 בועת תרגום מיידית בריחוף מעל מילים</span>
          </div>
          <div className="art-screen-content bubble-hud">
            <div className="mock-webpage-text">
              Drift is built for users who prioritize privacy and <span className="highlight-word">performance</span> above all.
            </div>
            <div className="trans-bubble-popup">
              <span className="bubble-icon">✨</span>
              <div className="bubble-body">
                <span className="bubble-tr-word">ביצועים / יעילות</span>
                <span className="bubble-phonetic">[pər-ˈfȯr-mən(t)s] · שם עצם</span>
              </div>
            </div>
          </div>
        </div>
      );

    case 'drift-tab-matrix':
      return slideIdx === 0 ? (
        /* Tab Matrix - Screenshot 1: Smart Tab Stacks & Tree */
        <div className={`store-artwork-screen matrix-screen-1 ${className}`}>
          <div className="art-window-bar">
            <span className="art-dot art-red" />
            <span className="art-dot art-yellow" />
            <span className="art-dot art-green" />
            <span className="art-bar-title">🗂️ Drift Tab Matrix — חלוקה וקיבוץ טאבים חכם</span>
          </div>
          <div className="art-screen-content matrix-hud">
            <div className="matrix-groups-col">
              <div className="matrix-group work">
                <span className="mg-dot" />
                <span className="mg-title">עבודה ופיתוח (4 טאבים)</span>
              </div>
              <div className="matrix-group research">
                <span className="mg-dot" />
                <span className="mg-title">מחקר ואבטחת מידע (6 טאבים)</span>
              </div>
              <div className="matrix-group media">
                <span className="mg-dot" />
                <span className="mg-title">מוזיקה ופודקאסטים (2 טאבים)</span>
              </div>
            </div>
            <div className="matrix-stats-col">
              <div className="mstat-item">
                <span className="mstat-val">12</span>
                <span className="mstat-lbl">טאבים פעילים</span>
              </div>
              <div className="mstat-item sleep">
                <span className="mstat-val">8 💤</span>
                <span className="mstat-lbl">בהשהיה חסכונית</span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Tab Matrix - Screenshot 2: Auto Tab Sleeping Dashboard */
        <div className={`store-artwork-screen matrix-screen-2 ${className}`}>
          <div className="art-window-bar">
            <span className="art-dot art-red" />
            <span className="art-dot art-yellow" />
            <span className="art-dot art-green" />
            <span className="art-bar-title">💤 השהיית טאבים אוטומטית לחיסכון במשאבים</span>
          </div>
          <div className="art-screen-content matrix-sleep-hud">
            <div className="sleep-banner">
              <span className="sleep-icon">🌙</span>
              <span>טאבים שלא בשימוש 15 דקות מועברים למצב שינה אוטומטית</span>
            </div>
            <div className="sleep-tabs-list">
              <div className="sleep-tab-row">
                <span>📑 youtube.com/watch...</span>
                <span className="st-badge">ישן · 280MB נחסכו</span>
              </div>
              <div className="sleep-tab-row">
                <span>📑 github.com/dor2500...</span>
                <span className="st-badge">ישן · 190MB נחסכו</span>
              </div>
            </div>
          </div>
        </div>
      );

    default:
      return (
        <div className={`store-artwork-screen default-screen ${className}`}>
          <div className="art-window-bar">
            <span className="art-dot art-red" />
            <span className="art-dot art-yellow" />
            <span className="art-dot art-green" />
            <span className="art-bar-title">Drift Extension Preview</span>
          </div>
          <div className="art-screen-content default-hud">
            <div className="default-icon">⚡</div>
            <div className="default-caption">תצוגה מקדימה חיה מתוך דפדפן Drift</div>
          </div>
        </div>
      );
  }
}
