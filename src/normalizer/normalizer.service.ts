import { Inject, Injectable } from '@nestjs/common';
import * as cheerio from 'cheerio';
import * as crypto from 'crypto';
import * as moment from 'moment';
import { Readable } from 'stream';
import * as fileType from 'file-type';
import { FileUploaderService } from '../file-uploader/file-uploader.service';
import { DetailedSong } from '../parsers/abstract/interfaces/detailed.song.interface';
import { NormalizedSong } from '../parsers/abstract/interfaces/normalized.song.interface';
import { LoggerService } from '../logger/logger.service';
import { ConfigService } from 'nestjs-config';

import * as industries from '../assets/industries.json';

@Injectable()
export class NormalizerService {
    @Inject()
    private readonly fileUploaderService: FileUploaderService;
    @Inject()
    private readonly logger: LoggerService;
    @Inject()
    private readonly configService: ConfigService;
    private readonly validTypes: string[] = [
        'jpg',
        'png',
        'mp3',
        'gif',
    ];

    async normalizeSong(song: DetailedSong): Promise<NormalizedSong> {
        const {
            title, songText, chordsKey,
            tags, videoAttachment, translations, url,
        } = song;

        let { audioMp3, album } = song;
        audioMp3 = await this.normalizeLink(audioMp3, title);
        album = {
            ...album,
            thumbnailImg: await this.normalizeLink(album.thumbnailImg, 'album_' + album.title),
            author: {
                ...album.author,
                thumbnailImg: await this.normalizeLink(album.author.thumbnailImg, 'author_' + album.author.name),
            },
        };

        return {
            title,
            songText,
            url,
            audioMp3,
            videoAttachment,
            tags,
            translations,
            chordsKey,
            album,
        };
    }

    private async normalizeLink(url: string, title?: string): Promise<string> {
        try {
            if (!url) { return null; }

            const file = await this.fileUploaderService.downloadFileFromUrl(url);
            if (!file) { return null; }

            const { fileStream, fileSize } = file;
            if (!fileStream) { return null; }

            const fileStreamWithType = await fileType.stream(fileStream);
            if (!fileStreamWithType.fileType) {
                return url;
            }

            if (this.validTypes.indexOf(fileStreamWithType.fileType.ext) > -1) {
                let hash = await this.hashFile(fileStreamWithType, fileSize);
                const titleName = title ? title.split(' ').join('_') : '';
                hash = `${titleName}_SM_${hash}.${fileStreamWithType.fileType.ext}`;
                return await this.generateNewUrl(hash, url);
            } else {
                fileStreamWithType.destroy();
                return url;
            }
        } catch (e) {
            this.logger.error(e.message, e);
        }
    }

    private hashFile(fileStreamWithType: Readable, fileSize: number): Promise<string> {
        return new Promise((resolve, reject) => {
            const checkTime = new Date();
            let progress = 0;

            const hashStream = crypto.createHash('sha256').setEncoding('hex');
            fileStreamWithType.pipe(hashStream);

            fileStreamWithType
                .on('data', chunk => {
                    progress += chunk.length;
                    const speed = progress / (new Date().getTime() - checkTime.getTime());

                    if (speed < 15 && progress / fileSize < 0.9) {
                        fileStreamWithType.destroy();
                        resolve(null);
                    }
                })
                .on('error', error => {
                    this.logger.error(error.message, error);
                    reject(error);
                })
                .on('end', async () => {
                    hashStream.end();

                    const hash = hashStream.read();
                    resolve(hash.toString());
                });
        });
    }

    private async generateNewUrl(hash: string, url: string, readableStream?: Readable): Promise<string> {
        const isUploaded = await this.fileUploaderService.getFromOceanSpaces(hash);
        const bucket = this.configService.get('spaces.bucket');
        const endPoint = this.configService.get('spaces.endpoint');

        if (!isUploaded) {
            let stream;

            if (url) {
                const { fileStream } = await this.fileUploaderService.downloadFileFromUrl(url);
                stream = fileStream;
            } else {
                stream = readableStream;
            }

            const resp = await this.fileUploaderService.uploadToS3(
                stream,
                hash,
            );

            return `https://${bucket}.${endPoint}/${resp.Key}`;
        } else {
            return `https://${bucket}.${endPoint}/${hash}`;
        }
    }

    private async normalizeHtml(html: string): Promise<string> {
        try {
            if (!html) { return ''; }

            const videos = [];
            const images = [];
            const linksToAnotherSources = [];
            const $ = cheerio.load(html);
            const videoTags = $('video');
            const imgTags = $('img');
            const anotherSourcesTags = $('a');

            videoTags.each((i, videoElem) => {
                const firstSource = $(videoElem)
                    .find('source:nth-child(1)[src$=".mp4"]')
                    .first();
                videos.push(firstSource);

                const otherSources = $(videoElem)
                    .find('source')
                    .not(':nth-child(1)[src$=".mp4"]');
                otherSources.each((j, otherElem) => {
                    $(otherElem).remove();
                });
            });

            imgTags.each((i, imgElem) => {
                images.push(imgElem);
            });

            anotherSourcesTags.each((i, anotherElem) => {
                if (/(.pdf|.pptx|.docx)$/.test($(anotherElem).attr('href'))) {
                    linksToAnotherSources.push(anotherElem);
                }
            });

            await Promise.all([
                this.changeLinks($, videos, 'src'),
                this.changeLinks($, images, 'src'),
                this.changeLinks($, linksToAnotherSources, 'href'),
            ]);

            return $('body').html();
        } catch (e) {
            this.logger.error(e.message, e);
        }
    }

    private clearHtmlFromAttribs(html: string): string {
        const $ = cheerio.load(html);

        $('*').each((i, elem) => {
            delete elem.attribs.class;
            delete elem.attribs.id;
        });

        return $('body').html();
    }

    private changeRelativeHref(html: string, host: string): string {
        const $ = cheerio.load(html);

        $('a').each((i, elem) => {
            if (!(/^(http|ftp)/i).test(elem.attribs.href)) {
                $(elem).attr('href', host + elem.attribs.href);
            }
        });

        return $('body').html();
    }

    private async changeLinks($, elements, attr: string): Promise<void> {
        await Promise.all(
            elements.map(async element => {
                try {
                    const oldSrc = $(element).attr(attr);
                    const newSrc = await this.normalizeLink(oldSrc);

                    if (newSrc !== oldSrc) {
                        if (newSrc) {
                            $(element).attr(attr, newSrc);
                        } else {
                            $(element).remove();
                        }
                    }
                } catch (e) {
                    this.logger.error(e.message, e);
                    $(element).remove();
                }
            }),
        );
    }

    private static cleanAllTags(shortDescription: string): string {
        if (!shortDescription) { return ''; }

        const $ = cheerio.load(shortDescription);
        $('body *').remove();

        return $.text();
    }
}
