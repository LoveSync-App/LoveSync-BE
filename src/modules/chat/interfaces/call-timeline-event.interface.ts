export interface CallTimelineEvent {
  callId: string;
  coupleId: string;
  callerId: string;
  calleeId: string;
  callType: string;
  status: string;
  durationSeconds: number;
  answeredAt?: Date;
  endedAt?: Date;
}
