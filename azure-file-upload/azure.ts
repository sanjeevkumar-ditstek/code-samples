import { BlobServiceClient, BlockBlobClient } from '@azure/storage-blob';
import { Injectable, Scope } from '@nestjs/common';
import { BaseService } from 'src/abstract';

import { RESPONSE_MESSAGES } from 'src/types/responseMessages';
import { AZURE_CONNECTION_STRING } from 'src/utils/env.config';
import { statusCode } from 'src/utils/common';

const storagePath = '/public/upload';
@Injectable({ scope: Scope.REQUEST })
export class UploadService extends BaseService {
    constructor(
    ) {
        super();
    }

    readonly azureConnection = AZURE_CONNECTION_STRING;
    containerName: string = 'uploads';

    // Upload file
    getBlobClient(imageName: string): BlockBlobClient {
        const blobClientService = BlobServiceClient.fromConnectionString(
            this.azureConnection,
        );
        const containerName = blobClientService.getContainerClient(
            this.containerName,
        );
        const blobClient = containerName.getBlockBlobClient(imageName);
        return blobClient;
    }

    /**
     * Uploads upload service
     * @param file
     * @param containerName
     * @returns
     */
    async upload(file: Express.Multer.File, containerName: string) {
        try {
            this.containerName = containerName;
            const { originalname, buffer, mimetype } = file;
            const fileName = `${Date.now()}${originalname}`;
            const blobClient = this.getBlobClient(fileName);
            const blobOptions = { blobHTTPHeaders: { blobContentType: mimetype } };
            await blobClient.uploadData(buffer, blobOptions);
            const fileUrl = blobClient.url;
            return {
                fileUrl: fileUrl,
                fileName: fileName,
            };
        } catch (error) {
            return this.customErrorHandle(error);
        }
    }

    /**
     * Gets file
     * @param fileName
     * @param containerName
     * @param res
     * @returns
     */
    async getFile(fileName: string, containerName: string, res) {
        try {
            this.containerName = containerName;
            const blobClient = this.getBlobClient(fileName);
            const checkFile = await blobClient.exists();
            if (!checkFile) {
                return {
                    message: RESPONSE_MESSAGES.COMMON.FILE_NOT_FOUND,
                };
            }
            const blobDownloaded = await blobClient.download();
            const file = blobDownloaded.readableStreamBody;
            return await file.pipe(res);
        } catch (error) {

            return this.customErrorHandle(error);
        }
    }

    /**
     * Downloads file
     * @param fileName
     * @param containerName
     * @param res
     * @returns
     */
    async downloadFile(fileName: string, containerName: string, res) {
        try {
            this.containerName = containerName;
            const blobClient = this.getBlobClient(fileName);
            const blobDownloaded = await blobClient.download();
            return blobDownloaded.readableStreamBody;
        } catch (error) {

            return this.customErrorHandle(error);
        }
    }

    /**
     * Deletes file
     * @param fileName
     * @param containerName
     * @returns
     */
    async deleteFile(fileName: string, containerName: string) {
        try {
            this.containerName = containerName;
            const blobClient = this.getBlobClient(fileName);
            const deleteFile = await blobClient.deleteIfExists();

            // for success
            if (deleteFile._response.status === statusCode.SUCCESS) {
                return {
                    message: `File ${RESPONSE_MESSAGES.COMMON.DELETED_SUCCESSFULLY} `,
                };
            }
        } catch (error) {

            return this.customErrorHandle(error);
        }
    }

    /**
     * Uploads chunk
     * @param fileName
     * @param chunk
     * @param [type]
     * @returns
     */
    async uploadChunk(fileName: string, data, type: string = '') {
        try {
            const { chunk, totalChunk, totalChunksUploaded } = data;
            const newFilename = fileName.replace(/ /g, '_');
            const buffer = Buffer.from(chunk, 'base64');

            // Initialize the BlobServiceClient
            const blobServiceClient = BlobServiceClient.fromConnectionString(
                AZURE_CONNECTION_STRING,
            );
            const containerClient = blobServiceClient.getContainerClient('uploads');
            const blockBlobClient = containerClient.getBlockBlobClient(newFilename);

            // Upload the chunk as a block
            const blockId = Buffer.from(
                String(totalChunksUploaded).padStart(6, '0'),
            ).toString('base64');
            await blockBlobClient.stageBlock(blockId, buffer, buffer.length);

            // If this is the last chunk, commit the blocks
            if (totalChunksUploaded === totalChunk - 1) {
                const blockList = Array.from({ length: totalChunk }, (_, i) =>
                    Buffer.from(String(i).padStart(6, '0')).toString('base64'),
                );
                const blobOptions = {
                    blobHTTPHeaders: {
                        blobContentType: type === 'image' ? 'image/*' : 'application/*',
                    },
                };
                await blockBlobClient.commitBlockList(blockList, blobOptions);
                return { path: blockBlobClient.url };
            }
        } catch (error) {

            return this.customErrorHandle(error);
        }
    }
}