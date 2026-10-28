import * as React from 'react';
import { Button, KIND, SIZE } from 'baseui/button';
import { useConfig } from './config';
import { useGrants } from './grants';
import { confirmationPriceMode } from './confirmation-policy';
import { CustomerOrderSettings } from './customer-order-policy';
import { capabilityAvailable } from './release-profile';

export function ConfirmationPolicyDoor() {
  if (!capabilityAvailable('customerOutbound')) return null;
  const { config } = useConfig(); const grants = useGrants();
  const mode = confirmationPriceMode(config, grants);
  const [open, setOpen] = React.useState(false);
  return <><Button kind={KIND.tertiary} size={SIZE.mini} data-testid="product-confirmation-settings" onClick={() => setOpen(true)}>
    Customer confirmations: {mode === 'off' ? 'off' : mode === 'with-prices' ? 'with prices' : 'quantities only'}
  </Button><CustomerOrderSettings open={open} onClose={() => setOpen(false)} onOpen={() => setOpen(true)} /></>;
}
