/* 
    Implemented Plivo for communications. that provides APIs for voice calls, SMS, and MMS. 
    It is often used for tasks such as sending OTPs (One-Time Passwords) and various types of SMS/MMS messages.
    We using plivo for following Point:-
    1. Sending OTPs
    2. Sending SMS
    
    We are using this function for sending sms/mms to the phone number with callback URL for webhook
*/
const MSG_TYPES = {
    SMS: 'sms',
    MMS: 'mms'
}
public send = async (request: protoBuf.SendRequest): Promise<protoBuf.SendResponse> => {
    const response: protoBuf.SendResponse = protoBuf.SendResponse.create();
    const schema = Joi.object().keys({
        spanContext: Joi.string().required(),
        phoneNumber: Joi.string().required(),
        message: Joi.string().required(),
        mediaUrl: Joi.string().optional(),
    });

    const params = schema.validate(request);

    if (params.error) {
        this.logger.error(`sendMMS - error: ${JSON.stringify(params.error)}`);
        response.status = protoBuf.StatusCode.UNPROCESSABLE_ENTITY;
        response.errors = params.error
        return response;
    }
    const { phoneNumber, message, mediaUrl, callbackUrl } = params.value;

    // remove spaces
    let formattedPhoneNumber = phoneNumber.replace(/\s+/g, '');
    const type =  mediaUrl ? MSG_TYPES.MMS : MSG_TYPES.SMS
    try {
        await plivoClient.messages.create(
            SRC_PHONE,
            formattedPhoneNumber,
            message,
            {
                type,
                ...(mediaUrl) && { media_urls: [mediaUrl] },
                ...(callbackUrl) && { url: callbackUrl }
            });

        response.status = protoBuf.StatusCode.OK;
    } catch (e) {
        this.logger.error(`sendMMS - error: ${e.message}`);
        response.status = protoBuf.StatusCode.INTERNAL_SERVER_ERROR;
        response.errors = [protoBuf.Error.create({
            key: 'Error',
            message: e.message,
        })];
        return response;
    }
    return response;
}