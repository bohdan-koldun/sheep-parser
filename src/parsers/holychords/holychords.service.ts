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
            const response = await this.apiService.sendGetRequest(this.authors[i].uri);

            const $ = cheerio.load(response.data);
            const description = $('.twoThird.last').first().text();
            const thumbnailImg = $('.oneThird img').first().attr('src');
            this.authors[i] = {
                ...this.authors[i],
                description: description ? description : null,
                thumbnailImg: thumbnailImg ? SITE_URL + thumbnailImg : null,
            };
            $('a.topcharts__item-title').each((j, song) => {
                const uri = $(song).attr('href');
                if (uri) {
                    this.songUrlList.push({ uri, author: this.authors[i] });
                }
            });

            this.logger.log(`${this.authors[i].name} songs list are parsed`);
            if (this.maxParsedSongs < i) {
                break;
            }
        }
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
                    uri: href ? SITE_URL + href : null,
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
            const albumImg = $(`.entry-header img.noprint imgcover`).first().attr('src');
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

            return {
                title,
                songText,
                url: SITE_URL + identificator.uri,
                chordsKey,
                videoAttachment,
                audioMp3: audioMp3 ? SITE_URL + audioMp3 : null,
                tags,
                translations,
                album: {
                    title: albumName,
                    thumbnailImg: albumImg ? SITE_URL + albumImg : null,
                    author: identificator.author,
                    href: albumHref ? SITE_URL + albumHref : null,
                },
            };

        } catch (e) {
            return null;
        }
    }

    async normalize(): Promise<void> {
        return super.normalize(100);
    }

    public async start() {
        await super.start();
    }
}
