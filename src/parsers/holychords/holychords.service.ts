import * as cheerio from 'cheerio';
import { Parser } from '../abstract/parser.abstract';
import { LoggerService } from '../../logger/logger.service';
import { NormalizerService } from '../../normalizer/normalizer.service';
import { SocketService } from '../../socket/socket.service';
import { ConfigService } from 'nestjs-config';
import { ApiService } from '../../api/api.service';
import { DetailedSong } from '../abstract/interfaces/detailed.song.interface';
import { SongIdentificator } from '../abstract/interfaces/song.identificator.interface';
import { Author } from '../abstract/interfaces/author.interface';
import { async } from 'rxjs/internal/scheduler/async';

const SITE_URL = 'https://holychords.com';
const AUTHOR_URL = 'https://holychords.com/artists';

export class HolyChordsService extends Parser {
    private authors: Author[] = [];
    private maxParsedSongs: number;

    constructor(
        readonly logger: LoggerService,
        readonly normalizerService: NormalizerService,
        readonly socketService: SocketService,
        readonly configService: ConfigService,
        readonly apiService: ApiService,
    ) {
        super();
        this.maxParsedSongs = Number(this.configService.get('parser.maxSongs'));
    }

    async parseSongUrlList() {
        await this.getAuthorList();
        await this.getSongList();
    }

    private async getSongList() {
        for (let i = 0; i < this.authors.length; i++) {
            await this.getOnePageAuthorSongs(this.authors[i].url, this.authors[i]);
            const response = await this.apiService.sendGetRequest(this.authors[i].url);

            const $ = cheerio.load(response.data);
            const description = $('.twoThird.last').first().text();
            const thumbnailImg = $('.oneThird img').first().attr('src');
            this.authors[i] = {
                ...this.authors[i],
                description: description ? description : null,
                thumbnailImg: thumbnailImg ? SITE_URL + thumbnailImg : null,
            };
            const uris = [];
            $('.pagination.pagination-primary a').each((j, page) => {
                const uri = $(page).attr('href');
                if (uri) {
                    uris.push(SITE_URL + uri);
                }
            });

            for (const url of uris) {
                await this.getOnePageAuthorSongs(url, this.authors[i]);
            }

            this.logger.log(`${this.authors[i].name} songs list are parsed`);
            if (this.maxParsedSongs < i) {
                break;
            }
        }
    }

    private async getOnePageAuthorSongs(url, author) {
        const response = await this.apiService.sendGetRequest(url);
        const $ = cheerio.load(response.data);
        $('a.topcharts__item-title').each((j, song) => {
            const uri = $(song).attr('href');
            if (uri) {
                this.songUrlList.push({ uri, author });
            }
        });
    }

    private async getAuthorList() {
        try {
            const response = await this.apiService.sendGetRequest(AUTHOR_URL);
            if (!response.data) { return null; }

            const $ = cheerio.load(response.data);
            $('a.docs_item_name').each((i, author) => {
                const href = $(author).attr('href');
                this.authors.push({
                    name: $(author).first().text(),
                    url: href ? SITE_URL + href : null,
                });
            });

            return this.authors;
        } catch (e) {
            return null;
        }
    }

    async parseSongDetails() {
        await super.parseSongDetails(50);
    }

    async parsePage(identificator: SongIdentificator): Promise<DetailedSong> {
        try {
            if (!identificator || !identificator.uri) { return null; }

            const response = await this.apiService.sendGetRequest(SITE_URL + identificator.uri);
            const $ = cheerio.load(response.data, { decodeEntities: false });

            const title = $('h1.entry-title span').first().text();
            const audioMp3 = $('audio.wp-audio-shortcode source').first().attr('src');
            const songText = $('pre').first().html();
            const chordsKey = $('pre').first().attr('class');
            const videoAttachment = $('.videoEmbed iframe').first().attr('src');
            const albumName = $(`*[itemprop = 'inAlbum']`).first().text();
            const albumHref = $(`*[itemprop = 'inAlbum'] a`).first().attr('href');
            const tags = [];
            $(`footer a[rel = 'tag']`).each((j, tag) => {
                tags.push($(tag).text());
            });
            const translations = [];
            $(`.box_style_3 li`).each((j, node) => {
                const href = $('a', node).attr('href');
                translations.push({
                    translatin: $('small', node).text(),
                    href: href ? SITE_URL + href : null,
                });
            });

            const album = await this.getAlbumInfo(
                albumHref ? SITE_URL + albumHref : null,
                albumName,
                identificator.author,
            );

            return {
                title,
                songText,
                url: SITE_URL + identificator.uri,
                chordsKey,
                videoAttachment,
                audioMp3: audioMp3 ? SITE_URL + audioMp3 : null,
                tags,
                translations,
                album,
            };

        } catch (e) {
            return null;
        }
    }

    private async getAlbumInfo(url: string, title: string, author: Author) {
        try {
            const response = await this.apiService.sendGetRequest(url);
            if (!response.data) { return null; }

            let iTunes; let googlePlay;
            const $ = cheerio.load(response.data);
            $('a.butshop').each((i, item) => {
                const href = $(item).attr('href');
                if (/itunes/.test(href)) {
                    iTunes = href;
                }
                if (/play.google/.test(href)) {
                    googlePlay = href;
                }
            });

            const description = $('.oneThird.last').first().text();
            const year = $('.boxSingleName h3').first().text().match(/\d+/g);
            const thumbnailImg = $('.banner-image img').first().attr('src');

            return {
                title,
                url,
                year: year ? year.join('').substr(year.length - 4) : null,
                description: description ? description : null,
                author,
                thumbnailImg: thumbnailImg ? SITE_URL + thumbnailImg : null,
                iTunes,
                googlePlay,
            };
        } catch (e) {
            return null;
        }
    }

    async normalize(): Promise<void> {
        return super.normalize(20);
    }

    public async start() {
        await super.start();
    }
}
