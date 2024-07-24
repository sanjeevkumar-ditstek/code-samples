import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BaseService } from 'src/abstract';
import { Twilio, jwt } from 'twilio';

@Injectable()
export class TwilioService extends BaseService {
  private readonly twilio: Twilio;

  constructor(private readonly configService: ConfigService) {
    super();
    const accountSid = process.env.TWILIO_ACCOUNT_SID;

    const authToken = process.env.TWILIO_AUTH_TOKEN;

    this.twilio = new Twilio(accountSid, authToken);
  }

  /**
   * Gets twilio
   * @returns
   */
  getTwilio() {
    return this.twilio;
  }
  /**
   * Generates twilio token
   * @param identity
   * @returns twilio token
   */
  generateTwilioToken(identity: string): string {
    const { AccessToken } = jwt;
    const { ChatGrant } = jwt.AccessToken;
    const token = new AccessToken(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_API_KEY_SID,
      process.env.TWILIO_API_KEY_SECRET,
      { identity: identity },
    );

    const chatGrant = new ChatGrant({
      serviceSid: process.env.TWILIO_CHAT_SERVICE_SID,
    });

    token.addGrant(chatGrant);

    return token.toJwt();
  }
}
