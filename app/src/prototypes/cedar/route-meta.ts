/* THE ROUTES' LIGHTWEIGHT REGISTER.
 *
 * The rail needs each surface's name, owner and posture before that surface is drawn, but loading
 * a `meta` export from every `.tsx` module made the router evaluate the whole app on arrival.
 * These declarations are deliberately data-only: `App.tsx` can build its rails synchronously while
 * each route module remains a separate lazy boundary.
 *
 * Keep a route here beside its surface's exported `meta`. The surface export remains the package
 * contract for scenario code; this record is the router's startup contract. The path is explicit
 * so the existing two-world boundary remains exact: desk routes cannot discover admin routes, and
 * `_parked/` is never a route merely because it exists on disk.
 */
import type { AreaMeta } from './shell/area';

export type RouteMeta = AreaMeta & { path: string };

export const DESK_ROUTE_META: RouteMeta[] = [
  { path: './areas/sales.tsx', id: 'sales', title: 'Sales', owner: 'V2-SALES', panes: true },
  { path: './areas/money.tsx', id: 'money', title: 'Money', owner: 'CEDAR-MONEY', panes: false },
  { path: './areas/stock.tsx', id: 'stock', title: 'Products', owner: 'V2-STOCK', panes: true },
  { path: './areas/customers.tsx', id: 'customers', title: 'Customers', owner: 'V2-CUSTOMERS', panes: true },
];

export const ADMIN_ROUTE_META: RouteMeta[] = [
  { path: './areas/admin/account.tsx', id: 'account', title: 'Account', owner: 'V2-ADMIN', panes: false },
  { path: './areas/admin/agent.tsx', id: 'agent', title: 'Your agent', owner: 'V2-ADMIN', panes: false },
  { path: './areas/admin/app-settings.tsx', id: 'app-settings', title: 'App settings', owner: 'V2-ADMIN', panes: false },
  { path: './areas/admin/business.tsx', id: 'business', title: 'Your business', owner: 'V2-ADMIN', panes: false },
  { path: './areas/admin/connections.tsx', id: 'connections', title: 'Connections', owner: 'V2-ADMIN', panes: false },
  { path: './areas/admin/data.tsx', id: 'data', title: 'Your data', owner: 'V2-ADMIN', panes: false },
  { path: './areas/admin/geography.tsx', id: 'geography', title: 'Geography', owner: 'V2-ADMIN', panes: true },
  { path: './areas/admin/operations.tsx', id: 'operations', title: 'Operations', owner: 'V2-ADMIN', panes: false },
  { path: './areas/admin/plan.tsx', id: 'plan', title: 'Plan', owner: 'V2-ADMIN', panes: false },
  { path: './areas/admin/team.tsx', id: 'team', title: 'Team', owner: 'V2-ADMIN', panes: true },
  { path: './areas/admin/units.tsx', id: 'units', title: 'Units', owner: 'V2-ADMIN', panes: false },
];
