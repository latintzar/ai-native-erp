import * as React from 'react';
import { useStyletron } from 'baseui';
import { List, Row, Section } from './rows';

export const ROADMAP_HASH = '#/admin/app-settings/roadmap';

/** The roadmap is a place in Administration, not a public dossier or a promise of a connection. */
export const openRoadmap = (): void => {
  if (window.location.hash !== ROADMAP_HASH) window.location.hash = ROADMAP_HASH;
};

type RoadmapRow = { label: string; sub: string; status: 'Next' | 'Later' };

const NEXT: RoadmapRow[] = [
  { label: 'Export history across your team', sub: 'See what has already been downloaded, whoever is working that morning.', status: 'Next' },
  { label: 'Connect your ERP', sub: 'Connect Bsale, ERPNext or Zoho and match your existing customers and articles.', status: 'Next' },
  { label: 'Files ready to upload', sub: 'Download orders, stock and prices in your software’s accepted format.', status: 'Next' },
  { label: 'Gmail and Microsoft 365', sub: 'Receive customer orders and supplier documents in Rocoto.', status: 'Next' },
];
const LATER: RoadmapRow[] = [
  { label: 'Capture handwritten changes', sub: 'Turn a photo of the packing sheet into final weights and prices to confirm.', status: 'Later' },
  { label: 'Send delivery notes by email', sub: 'Send each restaurant its confirmed delivery note.', status: 'Later' },
  { label: 'More ERP connections', sub: 'Connect systems that need setup with your software provider.', status: 'Later' },
  { label: 'Connect local software', sub: 'Exchange records with ERP software installed on your company’s computers.', status: 'Later' },
];

function RoadmapRows({ rows, testid }: { rows: RoadmapRow[]; testid: string }) {
  return <List testid={testid}>
    {rows.map(row => <Row
      key={row.label}
      testid={`roadmap-${row.label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}
      mark="clock"
      label={row.label}
      sub={row.sub}
      value={row.status}
      wrapValue
    />)}
  </List>;
}

export function Roadmap() {
  const [, theme] = useStyletron();

  return <section id="roadmap" data-testid="admin-roadmap" style={{ scrollMarginTop: '100px' }}>
    <Section title="Roadmap" testid="roadmap">
      <div style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale500, minWidth: 0 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale200 }}>
          <span style={{ ...theme.typography.LabelXSmall, color: theme.colors.contentTertiary }}>Next</span>
          <RoadmapRows rows={NEXT} testid="roadmap-next" />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale200 }}>
          <span style={{ ...theme.typography.LabelXSmall, color: theme.colors.contentTertiary }}>Later</span>
          <RoadmapRows rows={LATER} testid="roadmap-later" />
        </div>
      </div>
    </Section>
  </section>;
}
