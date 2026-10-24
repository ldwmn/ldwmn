export interface Me { id: number; name: string; role: 'owner' | 'assistant' }
export interface Direction { id: number; name: string }
export type ClientStatus = 'active' | 'pause' | 'left';
export type ClientRole = 'lead' | 'follow';
export interface ClientFull {
  id: number;
  name: string;
  contact: string | null;
  status: ClientStatus;
  role: ClientRole | null;
  return_on: string | null;
  note: string | null;
  attends: number[];
  wants: number[];
}
export type PayStatus = 'paid' | 'unpaid' | 'late_cancel';
export interface PaymentRow {
  id: number;
  client_id: number;
  client_name: string;
  direction_id: number;
  direction_name: string;
  week_start: string;
  lesson_date: string | null;
  amount: number;
  status: PayStatus;
  note: string | null;
  overdue?: boolean;
}
export interface WeekPayments {
  week_start: string;
  summary: { paid: number; unpaid: number; late_cancel: number; sum: number };
  payments: PaymentRow[];
}
export interface Today {
  date: string;
  week_start: string;
  write_to: { id: number; name: string; contact: string | null; return_on: string; note: string | null }[];
  unpaid: PaymentRow[];
  waiting: { id: number; name: string; count: number }[];
}
export interface DirectionOverview extends Direction {
  attends: { id: number; name: string }[];
  wants: { id: number; name: string }[];
}

export interface LessonPerson { id: number; name: string; role: ClientRole | null; state: 'paid' | 'unpaid' | 'cancel'; registered: boolean }
export interface LessonView {
  key: string;
  date: string;
  direction_id: number;
  direction_name: string;
  start_time: string;
  duration_min: number;
  place: string | null;
  template_id: number | null;
  lesson_id: number | null;
  is_practice: boolean;
  total: number;
  paid: number;
  unpaid_names: string[];
  cancelled: number;
  wants: number;
  people: LessonPerson[];
  balance: null | { lead: number; follow: number; unknown: number; missing_role: ClientRole | null; missing: number };
}
export interface CalendarMonth { month: string; days: Record<string, { n: number; unpaid: boolean }> }
export interface WeekView { week_start: string; days: { date: string; lessons: LessonView[] }[] }
export interface Template {
  id: number;
  direction_id: number;
  direction_name: string;
  weekday: number;
  start_time: string;
  duration_min: number;
  place: string | null;
  default_price: number | null;
  active: number;
}
