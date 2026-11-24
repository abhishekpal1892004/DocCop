import pkg from 'agora-token';
import { env } from '../../config/env.js';
import { ApiError } from '../../utils/ApiError.js';

const { RtcTokenBuilder, RtcRole } = pkg;

export const agoraTokenService = {
  generateRtcToken({ channelName, uid }) {
    const appId = process.env.AGORA_APP_ID || env.AGORA_APP_ID;
    const appCertificate = process.env.AGORA_APP_CERTIFICATE || env.AGORA_APP_CERTIFICATE;
    const expirySec = Number(process.env.AGORA_TOKEN_EXPIRY_SECONDS || env.AGORA_TOKEN_EXPIRY_SECONDS || 3600);

    if (!appId || !appCertificate) {
      throw new ApiError(503, 'Agora credentials are not configured', 'AGORA_NOT_CONFIGURED');
    }

    const nowSec = Math.floor(Date.now() / 1000);
    const privilegeExpiredTs = nowSec + expirySec;

    const token = RtcTokenBuilder.buildTokenWithUid(
      appId,
      appCertificate,
      channelName,
      uid,
      RtcRole.PUBLISHER,
      privilegeExpiredTs,
      privilegeExpiredTs
    );

    return {
      appId,
      token,
      uid,
      expiresAt: new Date(privilegeExpiredTs * 1000),
    };
  },
};
