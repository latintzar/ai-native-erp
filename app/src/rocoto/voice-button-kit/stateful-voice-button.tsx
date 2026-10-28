/* GROWN from Base Web's own `src/template-component/stateful-component.tsx` — the container's
 * state, wired into the controlled component, exactly the way Base composes the pair.
 * Base Web is MIT licensed, Copyright (c) Uber Technologies, Inc.
 *
 * This is the one you reach for in a product. `VoiceButton` is the one the kit page reaches for,
 * because a page that has to show five states at once cannot wait for five fingers.
 */
import * as React from 'react';
import StatefulContainer from './stateful-container';
import VoiceButton from './voice-button';
import type { StatefulVoiceButtonProps } from './types';

function StatefulVoiceButton(props: StatefulVoiceButtonProps) {
  const { overrides, ...containerProps } = props;
  return (
    <StatefulContainer {...containerProps}>
      {/* `source` is the container's own bookkeeping, not the control's paint — it says which
          level source the running take got, for a caller that wants to state it. */}
      {({ source, ...voiceButtonProps }) => <VoiceButton {...voiceButtonProps} overrides={overrides} />}
    </StatefulContainer>
  );
}

export default StatefulVoiceButton;
