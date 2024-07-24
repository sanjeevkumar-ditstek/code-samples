import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

import * as express from 'express';
import { v4 as uuidv4 } from 'uuid';

import {
  IExchangedTokenResponse,
  IExchangeTokenResponse,
  IResetPasswordResponse,
  ISignUpResponse,
  IVerificationObject,
  IVerifyEmail,
} from './auth.types';

import { FIREBASE_API } from 'src/const/firebaseRest';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { ProvidersService } from 'src/provider/providers.service';
import { BaseService } from 'src/abstract';
import { FirebaseAdmin, InjectFirebaseAdmin } from 'nestjs-firebase';
import { MfaDto, ResetPasswordDto, ResetPasswordEmailDto } from './auth.dto';
import { CreateRequest } from 'firebase-admin/auth';
import { MessagingPayload } from 'firebase-admin/lib/messaging/messaging-api';
import { saveErrorLog } from 'src/utils/common';

import { REQUEST } from '@nestjs/core';
import { DecodedUser, ISignUpRequest, ROLES } from 'src/types';

@Injectable()
export class AuthService extends BaseService {
  constructor(
    @InjectFirebaseAdmin() private readonly firebase: FirebaseAdmin,
    private httpService: HttpService,
    @Inject(forwardRef(() => ProvidersService))
    private ProvidersService: ProvidersService,
    @Inject(REQUEST) private readonly request: Request & { user?: DecodedUser },
  ) {
    super();
  }

//   create user in firebase
  async createFirebaseUser(data: CreateRequest) {
    try {
      const registerUser = await this.firebase.auth.createUser(data);
      return registerUser;
    } catch (error) {
      const errorLog = {
        userid: this?.request?.user?.id,
        userRole: this?.request?.user?.role,
        source: LOGGER.LOGGER_TYPE.WEB_BACKEND,
        action: LOGGER.LOGGER_FIREBASE.CREATE_USER,
        request: '',
        environment: process.env.ENVIRONMENT_HOST,
        error: `code :  ${error?.code} ,statusCode : ${error?.statusCode}, status: ${error?.status} ,  message ${error?.message}`,
      };
      saveErrorLog(errorLog);
     return  this._getInternalServerError(error.message);
    }
  }

//   remove user from firebase
  async removeFirebaseUser(id: string) {
    try {
      await this.firebase.auth.deleteUser(id);
    } catch (error) {
      const errorLog = {
        userid: this.request.user.id,
        userRole: this.request.user.role,
        source: LOGGER.LOGGER_TYPE.WEB_BACKEND,
        action: LOGGER.LOGGER_FIREBASE.REMOVE_USER,
        request: id,
        environment: process.env.ENVIRONMENT_HOST,
        error: `code :  ${error?.code} ,statusCode : ${error?.statusCode}, status: ${error?.status} ,  message ${error?.message}`,
      };
      saveErrorLog(errorLog);
      this._getInternalServerError(error.message);
    }
  }

//    reset password
  async resetPassword(formData: ResetPasswordDto, response: express.Response) {
    //password reset email
    try {
      const newPassword = formData.newPassword;
      const oobCode = formData.oobCode;
      if (newPassword && oobCode) {
        const result = await this.firebaseConfirmPassword({
          oobCode: oobCode,
          newPassword: newPassword,
        });

        return response.send(result);
      }
    } catch (error) {
      const errorLog = {
        userid: this?.request?.user?.id,
        userRole: this?.request?.user?.role,
        source: LOGGER.LOGGER_TYPE.WEB_BACKEND,
        action: LOGGER.LOGGER_FIREBASE.RESET_PASSWORD,
        request: '',
        environment: process.env.ENVIRONMENT_HOST,
        error: `code :  ${error?.code} ,statusCode : ${error?.statusCode}, status: ${error?.status} ,  message ${error?.message}`,
      };
      saveErrorLog(errorLog);

      return this.customErrorHandle(error);
    }
  }

//   send reset password
  async firebaseSendPasswordResetEmail(email: string) {
    //email reset
    try {
      const res = await firstValueFrom(
        this.httpService.post<{ email: string[] }>(
          `${FIREBASE_API.SEND_PASSWORD_RESET_EMAIL}${process.env.FIREBASE_API_KEY}`,
          { requestType: 'PASSWORD_RESET', email },
        ),
      );
      return res.data;
    } catch (error) {
      const errorLog = {
        userid: this?.request?.user?.id,
        userRole: this?.request?.user?.role,
        source: LOGGER.LOGGER_TYPE.WEB_BACKEND,
        action: LOGGER.LOGGER_FIREBASE.FIREBASE_SEND_PASSWORD_RESET_EMAIL,
        request: '',
        environment: process.env.ENVIRONMENT_HOST,
        error: `code :  ${error?.code} ,statusCode : ${error?.statusCode}, status: ${error?.status} ,  message ${error?.message}`,
      };
      saveErrorLog(errorLog);
      // if(error?.response?.data?.error?.message === EMAIL)
      this._getBadRequestError(
        error?.response?.data?.error?.message === 'EMAIL_NOT_FOUND'
          ? 'Email not found'
          : error.message,
      );
    }
  }

//   signup user in firebase
  async firebaseSignUp(email: string) {
    try {
      const res = await firstValueFrom(
        this.httpService.post<ISignUpResponse>(
          `${FIREBASE_API.SIGN_UP}${process.env.FIREBASE_API_KEY}`,
          {
            email,
            password: uuidv4(),
            returnSecureToken: true,
          },
        ),
      );
      return res;
    } catch (error) {
      const errorLog = {
        userid: this.request.user.id,
        userRole: this.request.user.role,
        source: LOGGER.LOGGER_TYPE.WEB_BACKEND,
        action: LOGGER.LOGGER_FIREBASE.LOGGER_FIREBASE_CREATE,
        request: '',
        error: error,
      };
      saveErrorLog(errorLog);
      this._getBadRequestError(
        FIREBASE_ERRORS[error.code] + ' ' + 'probably email was taken',
      );
    }
  }
}
