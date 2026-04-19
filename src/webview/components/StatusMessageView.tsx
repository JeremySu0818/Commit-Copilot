import React from 'react';

import type { StatusMessage } from '../utils';

interface StatusMessageViewProps {
  readonly id?: string;
  readonly className?: string;
  readonly status: StatusMessage | null;
  readonly hideWhenEmpty?: boolean;
}

export function StatusMessageView({
  id,
  className,
  status,
  hideWhenEmpty = false,
}: StatusMessageViewProps) {
  const baseClass = className ?? 'status';
  const nextClass =
    !status && hideWhenEmpty ? `${baseClass} hidden` : baseClass;

  return (
    <span id={id} className={nextClass}>
      {status ? (
        <>
          <span className={`status-dot ${status.type}`} />
          {status.text}
        </>
      ) : null}
    </span>
  );
}
