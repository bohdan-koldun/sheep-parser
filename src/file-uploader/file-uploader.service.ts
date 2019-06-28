import { Inject, Injectable } from '@nestjs/common';
import axios from 'axios';
import * as aws from 'aws-sdk';

import { ConfigService } from 'nestjs-config';
import { LoggerService } from '../logger/logger.service';

@Injectable()
export class FileUploaderService {
    private readonly config = {
        key: null,
        secret: null,
        endpoint: null,
        region: null,
        bucket: null,
    };
    private readonly s3: aws.S3;
    @Inject()
    private readonly logger: LoggerService;

    constructor(private readonly configService: ConfigService) {
        Object.keys(this.config).forEach(key => {
            this.config[key] = configService.get(`spaces.${key}`);
        });
        const { protocol, host, port } = new aws.Endpoint(
            this.config.endpoint,
        );

        this.s3 = new aws.S3({
            endpoint: `${protocol}//${host}:${port}`,
            accessKeyId: this.config.key,
            secretAccessKey: this.config.secret,
        });
    }

    async getFromOceanSpaces(key: string) {
        try {
            const getParams = {
                Bucket: this.config.bucket,
                Key: key,
            };
            return await this.s3.getObject(getParams).promise();
        } catch (e) {
            if (e.code === 'NoSuchKey') {
                return;
            } else {
                this.logger.error(e.message, e);
            }
        }
    }

    getAllFromOceanSpaces() {
        return this.s3.listObjects({ Bucket: this.config.bucket }).promise();
    }

    deleteFromOceanSpaces(key) {
        const deleteParams = {
            Bucket: this.config.bucket,
            Key: key,
        };
        return this.s3.deleteObject(deleteParams).promise();
    }

    async downloadFileFromUrl(url) {
        try {
            if (!url || url.startsWith('/')) {
                return;
            }

            const file = await axios({
                url,
                method: 'GET',
                responseType: 'stream',
                timeout: 5000,
            });

            return {
                fileStream: file.data,
                fileSize: file.headers['content-length'],
            };
        } catch (e) {
            this.logger.warn(`${e.message}\nurl: ${url}`);
            return;
        }
    }

    uploadToS3(file: Buffer, key: string) {
        const uploadParams = {
            Body: file,
            Bucket: this.config.bucket,
            Key: key,
            ACL: 'public-read',
        };

        return this.s3.upload(uploadParams).promise();
    }
}
