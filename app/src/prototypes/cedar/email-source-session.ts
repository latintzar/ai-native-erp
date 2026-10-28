/** A workspace reset invalidates every transient source view, including independently mounted ones. */
import * as React from 'react';

export function useEmailSourceEpoch(): number {
  const [epoch, setEpoch] = React.useState(0);
  React.useEffect(() => {
    const reset = () => setEpoch(value => value + 1);
    const disconnect = (event: Event) => {
      if ((event as CustomEvent<{phase?: string}>).detail?.phase === 'complete') reset();
    };
    window.addEventListener('rocoto:channel-workspace-reset', reset);
    window.addEventListener('rocoto:email-disconnect', disconnect);
    return () => {
      window.removeEventListener('rocoto:channel-workspace-reset', reset);
      window.removeEventListener('rocoto:email-disconnect', disconnect);
    };
  }, []);
  return epoch;
}
