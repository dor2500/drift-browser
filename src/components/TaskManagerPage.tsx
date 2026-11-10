import { useEffect, useMemo, useState } from 'react';
import type { BrowserState, TaskManagerProcess } from '../../shared/types';
import { cmd, cx } from '../lib';
import { Icon } from './Icon';

export function TaskManagerPage({ state }: { state: BrowserState }) {
  const [tasks, setTasks] = useState<TaskManagerProcess[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPid, setSelectedPid] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'tabs' | 'system'>('all');
  const [sortBy, setSortBy] = useState<'memory' | 'cpu' | 'name' | 'pid'>('memory');
  const [sortDesc, setSortDesc] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const loadMetrics = async (isInitial = false) => {
    try {
      if (isInitial) setLoading(true);
      const metrics = await window.drift.getTaskManagerMetrics();
      setTasks(metrics || []);
    } catch (e) {
      console.error('Failed to get task manager metrics:', e);
    } finally {
      if (isInitial) setLoading(false);
    }
  };

  useEffect(() => {
    void loadMetrics(true);
    const interval = setInterval(() => {
      if (autoRefresh) void loadMetrics(false);
    }, 1500);
    return () => clearInterval(interval);
  }, [autoRefresh]);

  const handleEndProcess = async () => {
    if (selectedPid === null) return;
    const task = tasks.find((t) => t.pid === selectedPid);
    if (!task) return;

    if (task.isMainProcess) {
      alert('לא ניתן לסיים את תהליך הדפדפן הראשי דרך מנהל המשימות.');
      return;
    }

    const success = await window.drift.killTaskManagerProcess(task.pid, task.tabId);
    if (success) {
      showToast(`התהליך "${task.name}" הסתיים בהצלחה`);
      setSelectedPid(null);
      await loadMetrics(false);
    } else {
      alert('נכשל בסיום התהליך.');
    }
  };

  const handleDoubleClickTask = (task: TaskManagerProcess) => {
    if (task.tabId) {
      cmd({ type: 'tab:activate', id: task.tabId });
    }
  };

  const filteredTasks = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    return tasks
      .filter((t) => {
        if (filterType === 'tabs' && !t.tabId) return false;
        if (filterType === 'system' && t.tabId) return false;

        if (q) {
          return (
            t.name.toLowerCase().includes(q) ||
            String(t.pid).includes(q) ||
            t.type.toLowerCase().includes(q) ||
            (t.url && t.url.toLowerCase().includes(q))
          );
        }
        return true;
      })
      .sort((a, b) => {
        let diff = 0;
        if (sortBy === 'memory') diff = b.memoryWorkingSetMB - a.memoryWorkingSetMB;
        else if (sortBy === 'cpu') diff = b.cpuPercent - a.cpuPercent;
        else if (sortBy === 'pid') diff = b.pid - a.pid;
        else if (sortBy === 'name') diff = a.name.localeCompare(b.name);
        return sortDesc ? diff : -diff;
      });
  }, [tasks, searchQuery, filterType, sortBy, sortDesc]);

  const stats = useMemo(() => {
    const totalMem = tasks.reduce((sum, t) => sum + t.memoryWorkingSetMB, 0);
    const totalCpu = tasks.reduce((sum, t) => sum + t.cpuPercent, 0);
    const tabsCount = tasks.filter((t) => t.tabId).length;
    const processCount = tasks.length;
    return {
      totalMemMB: Math.round(totalMem * 10) / 10,
      totalCpuPercent: Math.round(totalCpu * 10) / 10,
      tabsCount,
      processCount,
    };
  }, [tasks]);

  const selectedTask = useMemo(() => {
    return tasks.find((t) => t.pid === selectedPid);
  }, [tasks, selectedPid]);

  const handleSortToggle = (col: 'memory' | 'cpu' | 'name' | 'pid') => {
    if (sortBy === col) {
      setSortDesc(!sortDesc);
    } else {
      setSortBy(col);
      setSortDesc(true);
    }
  };

  return (
    <div className="task-manager-page">
      {/* Toast */}
      {toastMessage && (
        <div className="task-manager-toast">
          <Icon name="check" size={16} />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <div className="task-manager-header">
        <div className="header-titles">
          <div className="header-breadcrumb">
            <button className="crumb-link" onClick={() => cmd({ type: 'settings:open' })}>
              הגדרות
            </button>
            <span className="crumb-sep">/</span>
            <span>ביצועים ומערכת</span>
            <span className="crumb-sep">/</span>
            <span className="crumb-current">מנהל משימות הדפדפן</span>
          </div>
          <div className="title-row">
            <h2>מנהל משימות של הדפדפן (Task Manager)</h2>
            <span className="shortcut-badge">Shift + Esc</span>
          </div>
          <p className="header-subtitle">
            ניטור חי בזמן אמת של כל כרטיסיות הדפדפן, תהליכי ה-GPU, שירותי הרשת והתוספים. באפשרותך לסיים תהליך תקוע באופן מיידי.
          </p>
        </div>

        <div className="header-actions">
          <button className="btn ghost small" onClick={() => void loadMetrics(false)} title="רענן נתונים עכשיו">
            <Icon name="reload" size={13} />
            <span>רענן כעת</span>
          </button>
          <label className="auto-refresh-toggle" title="רענון נתונים אוטומטי כל 1.5 שניות">
            <span>רענון חי:</span>
            <input
              type="checkbox"
              className="switch"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
            />
          </label>
        </div>
      </div>

      {/* Summary Metrics Banner */}
      <div className="task-manager-metrics">
        <div className="metric-box">
          <div className="metric-icon-wrap mem">
            <Icon name="devices" size={18} />
          </div>
          <div className="metric-text-wrap">
            <span className="metric-val">{stats.totalMemMB} MB</span>
            <span className="metric-lbl">סך הכל זיכרון RAM בשימוש</span>
          </div>
        </div>

        <div className="metric-box">
          <div className="metric-icon-wrap cpu">
            <Icon name="bolt" size={18} />
          </div>
          <div className="metric-text-wrap">
            <span className="metric-val">{stats.totalCpuPercent}%</span>
            <span className="metric-lbl">סך הכל עומס מעבד (CPU)</span>
          </div>
        </div>

        <div className="metric-box">
          <div className="metric-icon-wrap procs">
            <Icon name="sliders" size={18} />
          </div>
          <div className="metric-text-wrap">
            <span className="metric-val">{stats.processCount}</span>
            <span className="metric-lbl">תהליכים פעילים במערכת</span>
          </div>
        </div>

        <div className="metric-box">
          <div className="metric-icon-wrap tabs">
            <Icon name="tab" size={18} />
          </div>
          <div className="metric-text-wrap">
            <span className="metric-val">{stats.tabsCount}</span>
            <span className="metric-lbl">כרטיסיות גלישה פתוחות</span>
          </div>
        </div>
      </div>

      {/* Toolbar: Search, Filters */}
      <div className="task-manager-toolbar">
        <div className="toolbar-search">
          <Icon name="search" size={15} />
          <input
            type="text"
            placeholder="חיפוש משימה, כרטיסייה או מספר PID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button className="btn-clear-search" onClick={() => setSearchQuery('')}>
              <Icon name="x" size={13} />
            </button>
          )}
        </div>

        <div className="toolbar-filter-pills">
          <button
            className={cx('f-pill', filterType === 'all' && 'active')}
            onClick={() => setFilterType('all')}
          >
            כל התהליכים ({tasks.length})
          </button>
          <button
            className={cx('f-pill', filterType === 'tabs' && 'active')}
            onClick={() => setFilterType('tabs')}
          >
            כרטיסיות בלבד ({stats.tabsCount})
          </button>
          <button
            className={cx('f-pill', filterType === 'system' && 'active')}
            onClick={() => setFilterType('system')}
          >
            תהליכי מערכת ו-GPU ({stats.processCount - stats.tabsCount})
          </button>
        </div>
      </div>

      {/* Tasks Table */}
      <div className="tasks-table-container">
        {loading ? (
          <div className="tasks-loading">
            <Icon name="reload" size={24} />
            <span>סורק תהליכי דפדפן...</span>
          </div>
        ) : (
          <table className="tasks-table">
            <thead>
              <tr>
                <th className="th-task" onClick={() => handleSortToggle('name')}>
                  <div className="th-content">
                    <span>משימה / כרטיסייה (Task)</span>
                    {sortBy === 'name' && <span className="sort-arrow">{sortDesc ? '▼' : '▲'}</span>}
                  </div>
                </th>
                <th className="th-mem" onClick={() => handleSortToggle('memory')}>
                  <div className="th-content">
                    <span>טביעת זיכרון (Memory)</span>
                    {sortBy === 'memory' && <span className="sort-arrow">{sortDesc ? '▼' : '▲'}</span>}
                  </div>
                </th>
                <th className="th-cpu" onClick={() => handleSortToggle('cpu')}>
                  <div className="th-content">
                    <span>שימוש במעבד (CPU)</span>
                    {sortBy === 'cpu' && <span className="sort-arrow">{sortDesc ? '▼' : '▲'}</span>}
                  </div>
                </th>
                <th className="th-pid" onClick={() => handleSortToggle('pid')}>
                  <div className="th-content">
                    <span>מזהה תהליך (PID)</span>
                    {sortBy === 'pid' && <span className="sort-arrow">{sortDesc ? '▼' : '▲'}</span>}
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredTasks.map((task) => {
                const isSelected = task.pid === selectedPid;
                const memPercent = Math.min(100, Math.round((task.memoryWorkingSetMB / 300) * 100));

                return (
                  <tr
                    key={task.pid}
                    className={cx('task-row', isSelected && 'selected', task.isMainProcess && 'main-process')}
                    onClick={() => setSelectedPid(task.pid)}
                    onDoubleClick={() => handleDoubleClickTask(task)}
                  >
                    <td className="td-task">
                      <div className="task-name-cell">
                        {task.favicon ? (
                          <img
                            src={task.favicon}
                            alt=""
                            className="task-favicon"
                            onError={(e) => ((e.currentTarget.style.display = 'none'))}
                          />
                        ) : (
                          <div className={cx('task-type-icon', task.type.toLowerCase())}>
                            <Icon
                              name={
                                task.isMainProcess
                                  ? 'globe'
                                  : task.type === 'GPU'
                                    ? 'bolt'
                                    : task.tabId
                                      ? 'tab'
                                      : 'sliders'
                              }
                              size={14}
                            />
                          </div>
                        )}
                        <span className="task-title" title={task.name}>
                          {task.name}
                        </span>
                        {task.isMainProcess && <span className="tag-core">Core</span>}
                      </div>
                    </td>

                    <td className="td-mem">
                      <div className="mem-bar-cell">
                        <span className="mem-val-text">{task.memoryWorkingSetMB} MB</span>
                        <div className="mem-mini-bar-track">
                          <div
                            className={cx(
                              'mem-mini-bar-fill',
                              task.memoryWorkingSetMB > 200 ? 'high' : task.memoryWorkingSetMB > 100 ? 'med' : 'low'
                            )}
                            style={{ width: `${memPercent}%` }}
                          />
                        </div>
                      </div>
                    </td>

                    <td className="td-cpu">
                      <span className={cx('cpu-val-text', task.cpuPercent > 10 && 'high')}>
                        {task.cpuPercent.toFixed(1)}%
                      </span>
                    </td>

                    <td className="td-pid">
                      <code className="pid-code">{task.pid}</code>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Floating Bottom Action Bar (Chrome style "End Process") */}
      <footer className="task-manager-footer">
        <div className="footer-left">
          {selectedTask ? (
            <div className="selected-task-summary">
              <span>נבחר:</span>
              <strong title={selectedTask.name}>{selectedTask.name}</strong>
              <span className="footer-pid-badge">(PID: {selectedTask.pid})</span>
            </div>
          ) : (
            <span className="footer-hint">בחר תהליך או כרטיסייה מהטבלה לפעולות</span>
          )}
        </div>

        <div className="footer-actions">
          {selectedTask?.tabId && (
            <button
              className="btn ghost small"
              onClick={() => handleDoubleClickTask(selectedTask)}
            >
              <Icon name="forward" size={13} />
              <span>עבור לכרטיסייה</span>
            </button>
          )}

          <button
            className="btn danger"
            disabled={!selectedTask || selectedTask.isMainProcess}
            onClick={handleEndProcess}
          >
            <Icon name="x" size={14} />
            <span>סיים תהליך (End Process)</span>
          </button>
        </div>
      </footer>
    </div>
  );
}
