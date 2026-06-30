import { TrackSource } from 'livekit-server-sdk';
import {
  getAllowedPublishSources,
  getMediaCapabilities,
} from './call-media.util';
import { CallType } from './enum/call-type.enum';

describe('call media permissions', () => {
  it('restricts audio calls to the microphone', () => {
    expect(getAllowedPublishSources(CallType.AUDIO)).toEqual([
      TrackSource.MICROPHONE,
    ]);
    expect(getMediaCapabilities(CallType.AUDIO)).toEqual({
      audio: true,
      video: false,
      screenShare: false,
    });
  });

  it('allows camera and screen sharing for video calls', () => {
    expect(getAllowedPublishSources(CallType.VIDEO)).toEqual([
      TrackSource.MICROPHONE,
      TrackSource.CAMERA,
      TrackSource.SCREEN_SHARE,
      TrackSource.SCREEN_SHARE_AUDIO,
    ]);
    expect(getMediaCapabilities(CallType.VIDEO)).toEqual({
      audio: true,
      video: true,
      screenShare: true,
    });
  });
});
