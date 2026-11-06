import { useEffect, useRef, useState } from 'react';
import type { FindState } from '../../shared/types';
import { t } from '../i18n';
import { cmd, cx } from '../lib';
import { Icon } from './Icon';

/** Firefox-style find bar along the bottom of the page (Ctrl+F). */
export function FindBar({ find, onClose }: { find?: FindState; onClose: () => void }) {
  const [text, setText] = useState('');
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    input.current?.focus();
    input.current?.select();
  }, []);

  const search = (value: string) => {
    setText(value);
    cmd({ type: 'find:query', text: value });
  };
  const step = (forward: boolean) => text && cmd({ type: 'find:query', text, forward, next: true });
  const close = () => {
    cmd({ type: 'find:stop' });
    onClose();
  };
  const none = !!text && find?.matches === 0;

  return (
    <div className="find-bar">
      <Icon name="search" size={15} />
      <input
        ref={input}
        className={cx('find-input', none && 'none')}
        value={text}
        placeholder={t('find.placeholder')}
        spellCheck={false}
        onChange={(e) => search(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') step(!e.shiftKey);
          else if (e.key === 'Escape') close();
          else return;
          e.preventDefault();
        }}
      />
      <span className="find-count">
        {text ? (none ? t('find.none') : find && find.matches > 0 ? t('find.count', { active: find.active, total: find.matches }) : '') : ''}
      </span>
      <button className="icon-btn" title={t('find.prev')} disabled={!text} onClick={() => step(false)}>
        <Icon name="up" size={15} />
      </button>
      <button className="icon-btn" title={t('find.next')} disabled={!text} onClick={() => step(true)}>
        <Icon name="down" size={15} />
      </button>
      <button className="icon-btn" title={t('find.close')} onClick={close}>
        <Icon name="x" size={15} />
      </button>
    </div>
  );
}
