export const appRegistry = [
  {
    id: 'services-and-quotes',
    name: 'Services & Quotes',
    description: 'Build quick service quote previews from the internal service catalog.',
    status: 'v1',
    path: '/apps/services-and-quotes',
    defaultAccess: 'all_logged_in_users',
    enabled: true
  },
  {
    id: 'cue-repairs',
    name: 'Cue Repairs',
    description: 'Track cue repair intake, estimates, status, customer contact, and pickup.',
    status: 'v1',
    path: '/apps/cue-repairs',
    defaultAccess: 'all_logged_in_users',
    enabled: true
  },
  {
    id: 'products-inventory',
    name: 'Products / Inventory',
    description: 'Track products, pricing, stock counts, locations, and inventory adjustments.',
    status: 'v1',
    path: '/apps/products-inventory',
    defaultAccess: 'all_logged_in_users',
    enabled: true
  },
  {
    id: 'warranty-service-tickets',
    name: 'Warranty / Service Tickets',
    description: 'Track warranty claims, service issues, product problems, follow-ups, and resolutions.',
    status: 'v1',
    path: '/apps/warranty-service-tickets',
    defaultAccess: 'all_logged_in_users',
    enabled: true
  },
  {
    id: 'customers-contacts',
    name: 'Customers / Contacts',
    description: 'Track customer and business contact details, notes, status, and contact preferences.',
    status: 'v1',
    path: '/apps/customers-contacts',
    defaultAccess: 'all_logged_in_users',
    enabled: true
  },
  {
    id: 'cue-tracker',
    name: 'Cue Tracker',
    description: 'Not connected here. The live staff tracker stays untouched.',
    status: 'coming_later',
    path: null,
    defaultAccess: 'future_review',
    enabled: false
  },
  {
    id: 'project-command-center',
    name: 'Project Command Center',
    description: 'Future workspace for larger operational projects.',
    status: 'coming_later',
    path: null,
    defaultAccess: 'future_review',
    enabled: false
  },
  {
    id: 'product-data-admin',
    name: 'Product Data Admin',
    description: 'Folded into Products / Inventory v1.',
    status: 'replaced_by_v1',
    path: '/apps/products-inventory',
    defaultAccess: 'all_logged_in_users',
    enabled: false
  }
];

export function getEnabledApps() {
  return appRegistry.filter((app) => app.enabled);
}
