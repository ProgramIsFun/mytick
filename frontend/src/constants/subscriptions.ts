export const BILLING_CYCLES: Record<string, string> = {
  monthly: 'Monthly',
  yearly: 'Yearly',
  quarterly: 'Quarterly',
  weekly: 'Weekly',
};

export const SUBSCRIPTION_STATUSES: Record<string, string> = {
  active: 'Active',
  cancelled: 'Cancelled',
  expired: 'Expired',
  paused: 'Paused',
  trial: 'Trial',
};

export const SUBSCRIPTION_STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-500/10 text-green-500',
  cancelled: 'bg-gray-500/10 text-gray-400',
  expired: 'bg-red-500/10 text-red-400',
  paused: 'bg-yellow-500/10 text-yellow-400',
  trial: 'bg-blue-500/10 text-blue-400',
};

// Category emojis — extend as needed
export const CATEGORY_ICONS: Record<string, string> = {
  gaming: '🎮',
  phone: '📱',
  productivity: '💼',
  streaming: '📺',
  music: '🎵',
  cloud: '☁️',
  insurance: '🛡️',
  membership: '🏷️',
  hosting: '🖥️',
  education: '📚',
  health: '💪',
  food: '🍔',
  transport: '🚗',
  other: '📄',
};

export function getCategoryIcon(category: string): string {
  return CATEGORY_ICONS[category.toLowerCase()] || CATEGORY_ICONS.other;
}
