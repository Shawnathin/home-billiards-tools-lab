import { canReviewFeedback } from './utils/feedback-access.mjs';

export const appRegistry = [
  {
    id: 'services-and-quotes',
    name: 'Services',
    description: 'Build service quote previews from the internal service catalog.',
    status: 'v1',
    path: '/apps/services-and-quotes',
    defaultAccess: 'all_logged_in_users',
    enabled: true
  },
  {
    id: 'cue-repairs',
    name: 'Cue Repairs',
    description: 'Track cue repair jobs from intake to completion.',
    status: 'v1',
    path: '/apps/cue-repairs',
    defaultAccess: 'all_logged_in_users',
    enabled: true
  },
  {
    id: 'products-inventory',
    name: 'Inventory',
    description: 'Manage internal products, pricing, stock counts, and inventory adjustments.',
    status: 'v1',
    path: '/apps/products-inventory',
    defaultAccess: 'all_logged_in_users',
    enabled: true
  },
  {
    id: 'warranty-service-tickets',
    name: 'Service Tickets',
    description: 'Track warranty claims, service issues, and customer follow-ups.',
    status: 'v1',
    path: '/apps/warranty-service-tickets',
    defaultAccess: 'all_logged_in_users',
    enabled: true
  },
  {
    id: 'customers-contacts',
    name: 'Customers',
    description: 'Manage customer and business contact records.',
    status: 'v1',
    path: '/apps/customers-contacts',
    defaultAccess: 'all_logged_in_users',
    enabled: true
  },
  {
    id: 'jobs-work-orders',
    name: 'Work Orders',
    description: 'Track customer-linked work orders, service locations, pickup/delivery jobs, and crew visits.',
    status: 'v1',
    path: '/apps/jobs-work-orders',
    defaultAccess: 'all_logged_in_users',
    enabled: true
  },
  {
    id: 'schedule-board',
    name: 'Schedule',
    description: 'View booked visits, unscheduled work, completed visits, and office follow-up.',
    status: 'v1',
    path: '/apps/schedule-board',
    defaultAccess: 'all_logged_in_users',
    enabled: true
  },
  {
    id: 'internal-messages',
    name: 'Messages',
    description: 'Staff-only threads for general and record-linked internal communication.',
    status: 'v1',
    path: '/apps/internal-messages',
    defaultAccess: 'all_logged_in_users',
    enabled: true
  },
  {
    id: 'feedback',
    name: 'Feedback Inbox',
    description: 'Review internal staff feedback about broken, confusing, missing, or improvable tool behavior.',
    status: 'v1',
    path: '/apps/feedback',
    defaultAccess: 'feedback_reviewers',
    enabled: true,
    reviewerOnly: true
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

export function getEnabledApps({ user } = {}) {
  return appRegistry.filter((app) => app.enabled && canAccessApp(app, user));
}

export function getAppByPath(path) {
  return appRegistry.find((app) => app.path === path) || null;
}

function canAccessApp(app, user) {
  if (app.reviewerOnly) {
    return canReviewFeedback(user);
  }

  return true;
}
