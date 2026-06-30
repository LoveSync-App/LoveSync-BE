import { TrackSource } from 'livekit-server-sdk';
import { CallType } from './enum/call-type.enum';

export type CallMediaCapabilities = {
  audio: true;
  video: boolean;
  screenShare: boolean;
};

export function getAllowedPublishSources(callType: CallType): TrackSource[] {
  if (callType === CallType.VIDEO) {
    return [
      TrackSource.MICROPHONE,
      TrackSource.CAMERA,
      TrackSource.SCREEN_SHARE,
      TrackSource.SCREEN_SHARE_AUDIO,
    ];
  }

  return [TrackSource.MICROPHONE];
}

export function getMediaCapabilities(
  callType: CallType,
): CallMediaCapabilities {
  const isVideoCall = callType === CallType.VIDEO;
  return {
    audio: true,
    video: isVideoCall,
    screenShare: isVideoCall,
  };
}
