export enum CallStatus {
  RINGING = 'ringing',
  ONGOING = 'ongoing',
  ENDED = 'ended',
  REJECTED = 'rejected',
  CANCELED = 'canceled',
  MISSED = 'missed',
}

export const ACTIVE_CALL_STATUSES = [
  CallStatus.RINGING,
  CallStatus.ONGOING,
] as const;

export const TERMINAL_CALL_STATUSES = [
  CallStatus.ENDED,
  CallStatus.REJECTED,
  CallStatus.CANCELED,
  CallStatus.MISSED,
] as const;
