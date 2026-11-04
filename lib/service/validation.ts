export const ticketStatuses = ["open", "in_progress", "waiting", "resolved", "closed"] as const;
export const priorities = ["low", "normal", "high", "urgent"] as const;
export type TicketStatus = typeof ticketStatuses[number];
export type Priority = typeof priorities[number];
export function validPhone(value: string) { return value === "" || /^\+[1-9]\d{7,14}$/.test(value); }
export function safeText(value: unknown, maximum: number): string { return typeof value === "string" ? value.trim().slice(0, maximum) : ""; }
