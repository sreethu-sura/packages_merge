// place here categories that you want to track. We want to track just a
// small subset of categories at a given time.
const ALLOWED_CATEGORIES_TO_TRACK = new Set(["command_palette", "export"]);

// Analytics tracking disabled to prevent internet connections
export const trackEvent = (
  category: string,
  action: string,
  label?: string,
  value?: number,
) => {
  // No-op function to prevent tracking
  return;
};
