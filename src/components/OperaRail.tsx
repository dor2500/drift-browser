import type { BrowserState } from '../../shared/types';
import { t } from '../i18n';
import { cmd, cx } from '../lib';
import { Icon } from './Icon';
import { SpaceIcon } from './SpaceIcon';

/** Opera One's sidebar: a narrow rail of spaces and shortcuts beside the page. */
export function OperaRail({ state }: { state: BrowserState }) {
  return (
    <aside className="opera-rail">
      {state.spaces.map((s) => (
        <button
          key={s.id}
          className={cx('rail-btn', s.id === state.activeSpaceId && 'active')}
          title={s.name}
          onClick={() => cmd({ type: 'space:activate', id: s.id })}
        >
          <SpaceIcon icon={s.icon} />
        </button>
      ))}
      <button className="rail-btn" title={t('spaces.new')} onClick={() => cmd({ type: 'space:new' })}>
        <Icon name="plus" size={16} />
      </button>
      <span className="rail-sep" />
      <button className="rail-btn" title={t('rail.downloads')} onClick={() => window.drift.downloadsMenu()}>
        <Icon name="download" size={17} />
      </button>
      <button className="rail-btn" title={t('rail.newTab')} onClick={() => cmd({ type: 'tab:new' })}>
        <Icon name="tab" size={17} />
      </button>
      <span className="rail-fill" />
      <button className="rail-btn" title={t('set.title')} onClick={() => cmd({ type: 'settings:open' })}>
        <Icon name="gear" size={17} />
      </button>
    </aside>
  );
}
