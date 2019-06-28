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
        'gif',
        'mp4',
        'pdf',
        'docx',
        'pptx',
    ];

    async normalizeSong(song: DetailedSong): Promise<NormalizedSong> {
        // const thumbnail = await this.normalizeLink(campaign.background_url);
        // const logo = await this.normalizeLink(campaign.logo_url);
        // const mainVideo = await this.normalizeLink(campaign.video_attachment)
        //     || campaign.video_attachment;

        // const short_description = NormalizerService.cleanAllTags(campaign.short_description);

        // let fullDescription = await this.normalizeHtml(campaign.full_description);
        // fullDescription = this.clearHtmlFromAttribs(fullDescription);
        // fullDescription = this.changeRelativeHref(fullDescription, campaign.parsed_from);

        // const startAt = NormalizerService.normalizeTime(launched_at);
        // const endAt = NormalizerService.normalizeTime(ended_at);
        // const typeSlug = NormalizerService.normalizeTypeToSlug(
        //     campaign.parsed_from,
        //     campaign.deal_type,
        // );
        // const categorySlug = NormalizerService.normalizeCategoryToSlug(
        //     campaign.parsed_from,
        //     campaign.crowdfunder_category,
        // );
        // const industrySlug = NormalizerService.normalizeIndustryToSlug(
        //     campaign.project_category,
        // );

        const { title, songText, chordsKey, tags, album, audioMp3, videoAttachment, translations, url} = song;

        return {
            title,
            songText,
            url,
            audioMp3,
            videoAttachment,
            tags,
            translations,
            chordsKey,
            album: {
                title: album.title,
                thumbnailImg: album.thumbnailImg,
                author: album.author,
                year: null,
                text: null,
            },
        };
    }

    private async normalizeLink(url: string): Promise<string> {
        try {
            if (!url) { return null; }

            if (url.startsWith('data:image')) {
                const dataMatch = url.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
                const bufferData = Buffer.from(dataMatch[2], 'base64');

                const readableForHashing = new Readable();
                readableForHashing.push(bufferData);
                readableForHashing.push(null);

                const hash = await this.hashFile(readableForHashing, 0.1);

                const readableForUploading = new Readable();
                readableForUploading.push(bufferData);
                readableForUploading.push(null);

                return await this.generateNewUrl(
                    hash,
                    null,
                    readableForUploading,
                );
            }

            const file = await this.fileUploaderService.downloadFileFromUrl(url);
            if (!file) { return null; }

            const { fileStream, fileSize } = file;
            if (!fileStream) { return null; }

            const fileStreamWithType = await fileType.stream(fileStream);
            if (!fileStreamWithType.fileType) {
                return url;
            }

            if (this.validTypes.indexOf(fileStreamWithType.fileType.ext) > -1) {
                const hash = await this.hashFile(fileStreamWithType, fileSize);
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

    private static normalizeTime(time: string | number): string {
        if (!time) { return null; }

        const date = typeof time === 'number' ? moment.unix(time) : moment(new Date(time));
        const formatedDate = date.format();
        return formatedDate !== 'Invalid date' ? formatedDate : null;
    }

    private static normalizeIndustryToSlug(parsedIndustries: string): string {
        if (!parsedIndustries || parsedIndustries.length === 0) { return 'other'; }

        const industriesArr = parsedIndustries.split('|');
        const result = [];
        industriesArr.forEach(industry => {
            let regex;
            let max = 0;
            let maxKey;
            const matches = {};
            for (const key of Object.keys(industries)) {
                for (const subIndustry of industries[key]) {
                    regex = RegExp(subIndustry, 'i');
                    if (regex.test(industry)) {
                        matches[key] = matches[key] ? matches[key]++ : (matches[key] = 1);
                        if (matches[key] > max) {
                            max = matches[key];
                            maxKey = key;
                        }
                    }
                }
            }

            const normalizedIndustry = maxKey ? maxKey : 'other';
            if (!result.includes(normalizedIndustry)) { result.push(normalizedIndustry); }
        });

        return result.join(',');
    }

    private static cleanAllTags(shortDescription: string): string {
        if (!shortDescription) { return ''; }

        const $ = cheerio.load(shortDescription);
        $('body *').remove();

        return $.text();
    }
}
