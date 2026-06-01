const feedbackReviewerNames = new Set(['shawn', 'diego']);

export function canReviewFeedback(user) {
  if (!user) {
    return false;
  }

  const role = normalize(user.role);
  const username = normalize(user.username);
  const displayName = normalize(user.displayName || user.display_name);

  return role === 'admin' || feedbackReviewerNames.has(username) || feedbackReviewerNames.has(displayName);
}

function normalize(value) {
  return String(value || '').trim().toLowerCase();
}
