import * as React from 'react';
import { useStyletron } from 'baseui';
import { Input } from 'baseui/input';
import { MapPin } from 'lucide-react';
import { runtime, type AddressSuggestions } from './runtime-client';
import { useWorkspaceCapabilities } from './workspace-capabilities';

export function OnboardingAddress({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [, theme] = useStyletron();
  const [suggestions, setSuggestions] = React.useState<AddressSuggestions['suggestions']>([]);
  const [edited, setEdited] = React.useState(false);
  const [status, setStatus] = React.useState('');
  const [focused, setFocused] = React.useState(false);
  const [active, setActive] = React.useState(-1);
  const token = React.useRef(crypto.randomUUID());
  const listId = React.useId();
  /* §247.1 · the search looks in the country the Settings toggle selects: Peru or Spain. */
  const country = useWorkspaceCapabilities().country === 'spain' ? 'ES' : 'PE';
  React.useEffect(() => {
    setSuggestions([]); setActive(-1);
    if (!edited || value.trim().length < 3) { setStatus(''); return; }
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setStatus('Looking up addresses…');
      runtime.addressSuggestions(value.trim(), token.current, controller.signal, country).then(result => {
        if (controller.signal.aborted) return;
        setSuggestions(result.suggestions);
        setStatus(result.suggestions.length ? '' : 'Use the address you entered.');
      }).catch(() => { if (!controller.signal.aborted) setStatus('Use the address you entered, or try the lookup again.'); });
    }, 300);
    return () => { controller.abort(); window.clearTimeout(timer); };
  }, [value, edited, country]);
  const choose = (text: string) => {
    onChange(text); setEdited(false); setSuggestions([]); setStatus(''); token.current = crypto.randomUUID();
  };
  const open = focused && suggestions.length > 0;
  return <div style={{ display: 'grid', gap: theme.sizing.scale300 }}>
    <Input value={value} maxLength={200} autoComplete="street-address" aria-label="Business address" required
      onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
      onChange={event => { setEdited(true); onChange(event.currentTarget.value); }}
      onKeyDown={event => {
        if (!open) return;
        if (event.key === 'ArrowDown') { event.preventDefault(); setActive(index => Math.min(suggestions.length - 1, index + 1)); }
        if (event.key === 'ArrowUp') { event.preventDefault(); setActive(index => Math.max(0, index - 1)); }
        if (event.key === 'Escape') { setFocused(false); setActive(-1); }
        if (event.key === 'Enter' && active >= 0) { event.preventDefault(); choose(suggestions[active].text); }
      }} overrides={{ Input: { props: { 'data-testid': 'onboarding-address', role: 'combobox', 'aria-autocomplete': 'list',
        'aria-expanded': open, 'aria-controls': open ? listId : undefined, 'aria-activedescendant': active >= 0 ? `${listId}-${active}` : undefined } } }} />
    {open && <div style={{ border: `1px solid ${theme.colors.borderOpaque}`, borderRadius: theme.borders.radius300, overflow: 'hidden' }}>
      <ul id={listId} role="listbox" aria-label="Google address suggestions" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {suggestions.map((suggestion, index) => <li id={`${listId}-${index}`} key={suggestion.placeId} role="option" aria-selected={active === index}>
          <button type="button" onMouseDown={event => event.preventDefault()} onClick={() => choose(suggestion.text)}
            data-testid={`address-suggestion-${index}`} style={{ width: '100%', display: 'flex', gap: theme.sizing.scale400, alignItems: 'center',
              textAlign: 'left', border: 0, padding: theme.sizing.scale500, cursor: 'pointer', color: theme.colors.contentPrimary,
              backgroundColor: active === index ? theme.colors.backgroundSecondary : theme.colors.backgroundPrimary }}>
            <MapPin size={18} aria-hidden style={{ flexShrink: 0 }} /><span style={{ display: 'grid', gap: theme.sizing.scale100 }}>
              <span style={theme.typography.LabelMedium}>{suggestion.mainText}</span><span style={{ ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary }}>{suggestion.secondaryText}</span>
            </span>
          </button>
        </li>)}
      </ul>
      <div data-testid="address-google-attribution" style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary,
        padding: `${theme.sizing.scale300} ${theme.sizing.scale500}`, borderTop: `1px solid ${theme.colors.borderOpaque}` }}>Powered by Google</div>
    </div>}
    {status && <span role="status" style={{ ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary }}>{status}</span>}
  </div>;
}
