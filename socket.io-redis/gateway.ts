import { Inject, forwardRef } from '@nestjs/common';
import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  OnGatewayConnection,
  WebSocketServer,
  OnGatewayDisconnect,
  ConnectedSocket,
} from '@nestjs/websockets';

import { Server, Socket } from 'socket.io';

import { TwilioSocketService } from 'src/chat/twilioConversation/twilioSocket.sevice';
import { DeviceTokensSocketService } from 'src/deviceTokens/deviceTokenSocket.service';
import { GroupsSocketService } from 'src/groups/groupSoket.service';
import { LoggerSocketService } from 'src/loggerModule/loggerForSocket.service';
import { ERROR_TYPE, IClient, IGroup, IPatient, IProvider } from 'src/types';
import { RESPONSE_MESSAGES } from 'src/types/responseMessages';
import { SOCKET_PORT } from 'src/utils/env.config';
import { SocketService } from './socket.service';
import { TwilioConversation } from 'src/chat/twilioConversation/twilioConversation.entity';
import {
  getPatientNewMessageCountDto,
  joinConversationDto,
  sentPopUpNotificationDto,
} from 'src/chat/twilioConversation/twilioConversation.dto';

@WebSocketGateway(Number(SOCKET_PORT) as number, {
  cors: { origin: '*' },
  namespace: '/api',
})
export class SocketGateway implements OnGatewayConnection, OnGatewayDisconnect {
  constructor(
    @Inject(forwardRef(() => TwilioSocketService))
    public readonly twilioConversationService: TwilioSocketService,
    @Inject(forwardRef(() => DeviceTokensSocketService))
    public readonly deviceTokenService: DeviceTokensSocketService,
    @Inject(GroupsSocketService)
    public readonly groupsSocketService: GroupsSocketService,
    @Inject(LoggerSocketService)
    public readonly loggerSocketService: LoggerSocketService,
    @Inject(SocketService)
    private readonly socketService: SocketService,
  ) {}
  @WebSocketServer() socketServer: Server;

  /**
   * Handles connection
   * @param client
   */
  async handleConnection(client: Socket) {
    client.join('breachMaxLoad');

    const userId = client?.handshake?.query?.id as string;
    console.log(`Client connected: ${client?.id} userId = ${userId}`);
    if (userId) {
      await this.socketService.bindIdWithSocketId(userId, client.id);
    }

    // Handle connection error event
    client.on('connect_error', (error) => {
      console.error(
        `Connection error for client ${client.id}: ${error.message}`,
      );
      this.handleConnectionError(client, error);
    });

    // Handle disconnect event
    client.on('disconnect', () => {
      console.log(
        `Client disconnected: ${client?.id} , userID :  ${client?.handshake?.query?.id}`,
      );
      this.handleDisconnect(client);
    });
  }

  /**
   * Handles connection error
   * @param client
   * @param error
   */
  handleConnectionError(client: Socket, error: any) {
    console.log(`Error message: ${error?.message} ,Error code: ${error?.code}  ,Error context: ${error?.context}`);
   
  }

  /**
   * Handles disconnect
   * @param client
   */
  async handleDisconnect(client: Socket) {
    const userId = client?.handshake?.query?.id as string;

    await this.socketService.unbindIdWithSocketId(userId, client.id);
  }

  /**
   * Determines whether module init on
   */
  onModuleInit() {
    if (this.socketServer) {
      this.socketServer.on('connection', () => {
        console.log('connected');
      });
    } else {
      console.error(RESPONSE_MESSAGES.WEB_SOCKET.SERVER_ERROR);
    }
  }

  @SubscribeMessage('TEST')
  async testConnection() {
    this.socketServer.emit('test', 'Its Working Fine');
  }
  /**
   *send chat from web
   * find the patient with conversationSid and send notification
   * if any error occurs it will save in activityLogRepository
   * @param body
   * conversationSid, message, attributes, dateCreated
   */
  @SubscribeMessage('SEND_MESSAGE')
  async onNewMessage(@MessageBody() body: joinConversationDto) {
    try {
      //emit msg to event
      const {
        conversationSid,
        message,
        attributes,
        dateCreated,
        tempId,
        identity,
        group,
      } = body;

      const conversationAttribute = JSON?.parse(attributes);
      const msgData = {
        body: message,
        attributes: attributes,
        dateCreated: dateCreated,
        tempId: tempId,
      };
      body.media = conversationAttribute?.media || [];


      /**
       * broadcast the msg
       */
      const { id } = patientInfo;
      const [patientSocketIds, senderIds] = await Promise.all([
        id ? this.socketService.getSocketIdsById(id) : undefined,
        identity ? this.socketService.getSocketIdsById(identity) : undefined,
      ]);
      // const patientSocketIds = id
      //   ? await this.socketService.getSocketIdsById(id)
      //   : undefined;
      if (patientSocketIds) {
        for (const socketId of patientSocketIds) {
          this.socketServer
            .to(socketId)
            .emit(`RECEIVE_MESSAGE/${conversationSid}`, msgData);
        }
      }

      //test
      if (senderIds) {
        for (const socketId of senderIds) {
          this.socketServer
            .to(socketId)
            .emit(`RECEIVE_MESSAGE/${conversationSid}`, msgData);
        }
      }

      /**
       * database process and twilio process
       */
      const sendMessage = await this.twilioConversationService
        .joinConversation(conversationSid, body)
        .then((value) => {
          if (tempId) {
            this.socketServer.emit(
              `GET_SID/${conversationSid}/tempId/${tempId}`,
              value,
            );
            return value;
          }
        });
      /**
       * find the patient with conversationSid and send notification
       */

      /**
       *@returns  Json Object contain total number of new message in all groups and Array of object with group new message count and conversation new message count based on patient id
       */
      const findGroup = (await this.groupsSocketService.findGroupById(
        group,
      )) as unknown as IGroup;

      const clientId = (findGroup?.client as unknown as IClient)?.id;
      const [patientData, findGroupProvider] = await Promise.all([
        this.groupsSocketService.allGroupDataOfPatient(id),
        this.groupsSocketService.findGroupProvider(
          group,
          clientId,
        ) as unknown as Array<IProvider>,
      ]);
      /**
       * emit the notification
       * contain all the count
       */

      const socketIds = id
        ? await this.socketService.getSocketIdsById(id)
        : undefined;

      // broadCast to connected clients
      if (socketIds) {
        for (const socketId of socketIds) {
          this.socketServer
            .to(socketId)
            .emit(`MOB_NOTIFICATION/${id}`, patientData);
        }
      }

      //find the all  group provider

      for (let i = 0; i < findGroupProvider?.length; i++) {
        const { id } = findGroupProvider[i];
        if (id === identity) {
          continue;
        }
        /**
         * emit the notification
         * contain all the count
         */

        const socketIds: Array<string> = id
          ? await this.socketService.getSocketIdsById(id)
          : undefined;

        // broadCast to connected clients
        if (socketIds) {
          for (const socketId of socketIds) {
            this.socketServer
              .to(socketId)
              .emit(`RECEIVE_MESSAGE/${conversationSid}`, sendMessage);
          }
        }
      }
    } catch (error) {
      /**
       * if any error occurs it will save in activityLogRepository
       *
       */
      const errorLogger = {
        errorType: ERROR_TYPE.SOCKET,
        information: {
          address: 'SEND_MESSAGE',
          message: error?.message,
          statusCode: error?.statusCode,
          code: error?.code,
          information: error,
          payload: body,
        },
      };
      await this.loggerSocketService
        .saveSocketError(errorLogger)
        .catch(() => null);
    }
  }

  /**
   * find providers and send notification
   * sentMessageInConversationForMob
   * @param body
   */
  @SubscribeMessage('SEND_MESSAGE_MOB')
  async onNewMessageMob(@MessageBody() body: joinConversationDto) {
    try {
      //emit msg to event

      const {
        conversationSid,
        message,
        attributes,
        dateCreated,
        group,
        tempId,
        identity,
      } = body;

      const conversationAttribute = JSON?.parse(attributes);
      const msgData = {
        body: message,
        attributes: attributes,
        dateCreated: dateCreated,
        tempId: tempId,
      };
      body.media = conversationAttribute?.media || [];

      /**
       * emit data to patient
       */
      const patientSocketIds = identity
        ? await this.socketService.getSocketIdsById(identity)
        : undefined;

      if (patientSocketIds) {
        for (const socketId of patientSocketIds) {
          this.socketServer
            .to(socketId)
            .emit(`RECEIVE_MESSAGE/${conversationSid}`, msgData);
        }
      }

      /**
       * Send the Patient new message count for conversation
       */

      /**
       * iterate over each provider
       */
      /**
       * get tempId from frontEnd For send Sid after save the msg
       */
      /**
       * database dependent process
       *
       */
      const saveMessage = await this.twilioConversationService
        .sentMessageInConversationForMob(conversationSid, body)
        .then((value) => {
          if (tempId) {
            this.socketServer.emit(
              `GET_SID/${conversationSid}/tempId/${tempId}`,
              value,
            );
          }
          return value;
        });

      /**
       * find providers and send notification
       */


      const emitMessages = async (
        socketId,
        conversationSid,
        saveMessage,
        newConversationMessageCount,
        id,
        clientId,
        NotificationData,
      ) => {
        this.socketServer
          .to(socketId)
          .emit(`RECEIVE_MESSAGE/${conversationSid}`, saveMessage);
        this.socketServer
          .to(socketId)
          .emit(
            `PATIENT_MESSAGE_TWILIO_PATIENT_CONVERSATION/${conversationSid}`,
            newConversationMessageCount,
          );
        this.socketServer
          .to(socketId)
          .emit(`NOTIFICATION/${id}/${clientId}`, NotificationData);
      };

      for (let i = 0; i < findGroupProvider?.length; i++) {
        const { id } = findGroupProvider[i];

        if (id) {
          const socketIds = await this.socketService.getSocketIdsById(id);

          if (socketIds) {
            for (const socketId of socketIds) {
              await emitMessages(
                socketId,
                conversationSid,
                saveMessage,
                newConversationMessageCount,
                id,
                clientId,
                NotificationData,
              );
            }
          }
        }
      }
    } catch (error) {
      /**
       * if any error occurs it will save in activityLogRepository
       *
       */
      const errorLogger = {
        errorType: ERROR_TYPE.SOCKET,
        information: {
          address: 'SEND_MESSAGE_MOB',
          message: error?.message,
          statusCode: error?.statusCode,
          code: error?.code,
          information: error,
          payload: body,
        },
      };

      await this.loggerSocketService
        .saveSocketError(errorLogger)
        .catch(() => null);
    }
  }

  sendAllChat(data) {
    this.socketServer.emit('onMessage', data);
  }

  /**
   * Typing status
   * if any error occurs it will save in activityLogRepository
   * @param body
   */
  @SubscribeMessage('MESSAGE_TYPING')
  async msgTyping(@MessageBody() body: joinConversationDto) {
    try {
      const { conversationSid, attributes } = body;
      const conversationId = JSON.parse(attributes)?.conversation;

     
      for (const i of twilioPatientConversations) {
        const patientId = i?.patient?.id;

        const socketIds = patientId
          ? await this.socketService.getSocketIdsById(patientId)
          : undefined;

        // broadCast to connected clients
        if (socketIds) {
          for (const socketId of socketIds) {
            this.socketServer
              .to(socketId)
              .emit(`MESSAGE_TYPING/${conversationSid}`, attributes);
          }
        }
      }

      for (const i of getAllGroupProvider.groupProviders) {
        const providerId = (i?.provider)?.id;

        const socketIds = providerId
          ? await this.socketService.getSocketIdsById(providerId)
          : undefined;

        // broadCast to connected clients
        if (socketIds && socketIds.length > 0) {
          for (const socketId of socketIds) {
            this.socketServer
              .to(socketId)
              .emit(`MESSAGE_TYPING/${conversationSid}`, attributes);
          }
        }
      }
    } catch (error) {
      /**
       * if any error occurs it will save in activityLogRepository
       *
       */
      const errorLogger = {
        errorType: ERROR_TYPE.SOCKET,
        information: {
          address: 'MESSAGE_TYPING',
          message: error?.message,
          statusCode: error?.statusCode,
          code: error?.code,
          information: error,
          payload: body,
        },
      };
      await this.loggerSocketService
        .saveSocketError(errorLogger)
        .catch(() => null);
    }
  }

 
 
 
 

}
