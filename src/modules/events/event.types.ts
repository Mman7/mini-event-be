export type EventSummary = {
  id: number;
  title: string;
  description: string | null;
  eventDate: string;
  maxAttendees: number;
  registeredCount: number;
  availableSlots: number;
};
