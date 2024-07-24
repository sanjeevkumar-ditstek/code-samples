import { Inject, Injectable } from '@nestjs/common';
import { TwilioService } from '../twilio.service';
import { BaseService } from 'src/abstract';
import { LOGGER, RESPONSE_MESSAGES } from 'src/types/responseMessages';
import { InjectRepository } from '@nestjs/typeorm';
import { Conversation } from '../conversation.entity';
import { Repository } from 'typeorm';
import { saveErrorLog } from 'src/utils/common';
import {
  getPatientNewMessageCountDto,
  joinConversationDto,
  sendSmsToMobileByTwilioDto,
  sentPopUpNotificationDto,
} from './twilioConversation.dto';

import { TwilioPatientConversations } from './twilioPatientConversation/twilioPatientConversation.entity';
import { TwilioConversation } from './twilioConversation.entity';
import { DeviceTokensSocketService } from 'src/deviceTokens/deviceTokenSocket.service';
import { AuthService } from 'src/auth/auth.service';
import { TWILIO_PHONE_NO } from 'src/utils/env.config';
import { NotificationsService } from 'src/notifications/notifications.service';
import { BaseListingDto } from 'src/abstract/base.dto';

@Injectable()
export class TwilioConversationService extends BaseService {
  constructor(
    @Inject(TwilioService)
    private readonly twilioService: TwilioService,
    @InjectRepository(Conversation)
    private readonly conversationRepository: Repository<Conversation>,
    @InjectRepository(TwilioConversation)
    private readonly twilioConversationRepository: Repository<TwilioConversation>,
    @InjectRepository(TwilioPatientConversations)
    private readonly twilioPatientConversations: Repository<TwilioPatientConversations>,
  
    @Inject(DeviceTokensSocketService)
    private readonly deviceTokenService: DeviceTokensSocketService,
    @Inject(AuthService)
    private readonly authService: AuthService,
    @Inject(NotificationsService)
    public readonly notificationService: NotificationsService,
  ) {
    super();
  }



  /**
   * Gets conversation messages
   * @param conversationSid
   * @returns
   */
  async getConversationMessages(
    conversationSid: string,
    data?: BaseListingDto,
  ) {
    const twilio = this.twilioService.getTwilio();

    try {
      const limit = data?.limit || 50;
      const messages = await twilio.conversations.v1
        .services(process.env.TWILIO_CHAT_SERVICE_SID)
        .conversations(conversationSid)
        .messages.list({
          limit: +limit,
          order: 'desc',
        });

      const reverseTheResponse = messages?.reverse();

      const returnData = { items: reverseTheResponse };
      return returnData;
    } catch (error) {
      const errorLog = {
        userid: this?.request?.user?.id,
        userRole: this?.request?.user?.role,
        source: LOGGER.LOGGER_TYPE.WEB_BACKEND,
        action: LOGGER.LOGGER_CONVERSATION.GET_CONVERSATION_MESSAGES,
        request: `id:${conversationSid}`,
        error: error,
      };
      saveErrorLog(errorLog);
      return this.customErrorHandle(error);
    }
  }

  /**
   * NOT IN USE
   * Updates conversation name
   * @param conversationId
   * @param data
   * @returns
   */
  async updateConversationName(conversationId: string, data) {
    try {
      const { friendlyName } = data;
      const twilio = this.twilioService.getTwilio();
      const update = await twilio.conversations.v1
        .conversations(conversationId)
        .update({ friendlyName: friendlyName });
      return update;
    } catch (error) {
      const errorLog = {
        userid: this?.request?.user?.id,
        userRole: this?.request?.user?.role,
        source: LOGGER.LOGGER_TYPE.WEB_BACKEND,
        action: LOGGER.LOGGER_CONVERSATION.UPDATE_CONVERSATION,
        request: `id:${conversationId},data:${data}`,
        error: error,
      };
      saveErrorLog(errorLog);
      return this.customErrorHandle(error);
    }
  }
  /**
   * NOT IN USE
   * Deletes conversation name
   * @param conversationId
   * @returns
   */
  async deleteConversation(conversationId: string) {
    try {
      const twilio = this.twilioService.getTwilio();
      const update = await twilio.conversations.v1
        .conversations(conversationId)
        .remove();
      return update;
    } catch (error) {
      const errorLog = {
        userid: this?.request?.user?.id,
        userRole: this?.request?.user?.role,
        source: LOGGER.LOGGER_TYPE.WEB_BACKEND,
        action: LOGGER.LOGGER_CONVERSATION.CONVERSATION_DELETE,
        request: `id:${conversationId}`,
        error: error,
      };
      saveErrorLog(errorLog);
      return this.customErrorHandle(error);
    }
  }

 
  /**
   * Sends messages and join conversation
   * @param data
   * @returns
   */
  async sendMessagesAndJoinConversation(data: joinConversationDto) {
    try {
      const {
        conversationId,
        message,
        identity,
        id,
        humanName,
        image,
        entityRole,
      } = data;

      const meta = {
        id: id,
        humanName: humanName?.text,
        image: image,
        role: entityRole,
        isReadPatient: false,
        isReadProvider: true,
      };
      const twilio = this.twilioService.getTwilio();
      const sendMessage = await twilio.conversations.v1
        .services(process.env.TWILIO_CHAT_SERVICE_SID)
        .conversations(conversationId)
        .messages.create({
          body: message,
          author: identity,
          attributes: JSON.stringify(meta),
        });
      return sendMessage;
    } catch (error) {
      return this.customErrorHandle(error);
    }
  }
 

  /**
   * Sends sms to mobile
   * @param data
   * @returns
   */
  async sendSmsToMobile(data: sendSmsToMobileByTwilioDto) {
    try {
      const { phoneNumber, message } = data;
      const twilio = await this.twilioService.getTwilio();
      await twilio.messages
        .create({
          body: message,
          from: TWILIO_PHONE_NO,
          to: phoneNumber,
        })
        .then(() => {
          return true;
        })
        .catch(() => null);
      return true;
    } catch (error) {
      return null;
    }
  }

  /**
   * Updates message
   * @param conversationSid
   * @param data
   * @returns
   */
  async updateMessage(conversationSid: string, data: joinConversationDto) {
    try {
      const { messageSid, body, attributes } = data;
      const twilio = this.twilioService.getTwilio();
      const updatedMessage = await twilio.conversations.v1
        .services(process.env.TWILIO_CHAT_SERVICE_SID)
        .conversations(conversationSid)
        .messages(messageSid)
        .update({
          body: body,
          attributes: attributes,
        });

      return updatedMessage;
    } catch (error) {
      return this.customErrorHandle(error);
    }
  }
  /**
   * Deletes message
   * @param conversationSid
   * @param data
   * @returns
   */
  async deleteMessage(
    conversationSid: string,
    data: getPatientNewMessageCountDto,
  ) {
    try {
      const { messageSid } = data;
      const twilio = this.twilioService.getTwilio();
      const updatedMessage = await twilio.conversations.v1
        .services(process.env.TWILIO_CHAT_SERVICE_SID)
        .conversations(conversationSid)
        .messages(messageSid)
        .remove();

      return updatedMessage;
    } catch (error) {
      return this.customErrorHandle(error);
    }
  }
}
