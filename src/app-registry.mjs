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
    description: 'Future home for product records, specs, and catalog data.',
    status: 'coming_later',
    path: null,
    defaultAccess: 'future_review',
    enabled: false
  }
];

export function getEnabledApps() {
  return appRegistry.filter((app) => app.enabled);
}
