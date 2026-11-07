import { useEffect, useState } from 'react';
import type { TabState } from '../../shared/types';
import { isInternalUrl } from '../../shared/url';
import { cx } from '../lib';
import { Icon } from './Icon';

export function Favicon({ tab }: { tab: TabState }) {
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [tab.favicon]);

  if (isInternalUrl(tab.url)) {
    return (
      <span className="favicon internal">
        <Icon name={tab.url.startsWith('drift://newtab') ? 'plus' : 'gear'} size={14} />
      </span>
    );
  }
  if (tab.favicon && !broken) {
    return <img className={cx('favicon', tab.loading && 'loading')} src={tab.favicon} alt="" draggable={false} onError={() => setBroken(true)} />;
  }
  let letter = '•';
  try {
    letter = new URL(tab.url).hostname.replace(/^www\./, '')[0] ?? '•';
  } catch {
    /* not a URL */
  }
  return <span className={cx('favicon', 'fallback', tab.loading && 'loading')}>{letter}</span>;
}
