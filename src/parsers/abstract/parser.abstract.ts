import { NormalizedSong } from './interfaces/normalized.song.interface';
import { DetailedSong } from './interfaces/detailed.song.interface';
import { SongIdentificator } from './interfaces/song.identificator.interface';
import { ConfigService } from 'nestjs-config';
import { SocketService } from '../../socket/socket.service';
import { LoggerService } from '../../logger/logger.service';
import { NormalizerService } from '../../normalizer/normalizer.service';
import * as fs from 'fs';
const Spinner = require('cli-spinner').Spinner;

export abstract class Parser {
    private _songUrlList: SongIdentificator[] = [];
    private _songDetailedList: DetailedSong[] = [];
    private _normalizedSongs: NormalizedSong[] = [];

    protected readonly configService: ConfigService;
    protected readonly logger: LoggerService;
    protected readonly socketService: SocketService;
    protected readonly normalizerService: NormalizerService;

    get songUrlList(): SongIdentificator[] {
        return this._songUrlList;
    }

    set songUrlList(songUrlList: SongIdentificator[]) {
        this._songUrlList = songUrlList;
    }

    get songDetailedList() {
        return this._songDetailedList;
    }

    set songDetailedList(songDetailedList: DetailedSong[]) {
        this._songDetailedList = songDetailedList;
    }

    get normalizedSongs() {
        return this._normalizedSongs;
    }

    set normalizedSongs(normalizedSongs: NormalizedSong[]) {
        this._normalizedSongs = normalizedSongs;
    }

    clear() {
        this.songUrlList = [];
        this.songDetailedList = [];
        this.normalizedSongs = [];
    }

    async start() {
        this.clear();
        const hrstart = process.hrtime();
        this.logger.log(`Heap Used ${process.memoryUsage().heapUsed / (1024 * 1024)} MB`);

        await this.watchProcess('parse songs list... ', this.parseSongUrlList);

        await this.watchProcess('parse page details... ', this.parseSongDetails);
        this.songUrlList = null;

        await this.watchProcess('normalize parsed data... ', this.normalize);
        this.songDetailedList = null;

        if (this.configService._isDev()) {
            await this.writeNormalizingListToFile(process.hrtime(hrstart));
        }

        this.socketService.reconect();

        await this.watchProcess('send socket package... ', this.sendUpdates);

        await this.socketService.finishSending();
    }

    abstract parsePage(identificator: SongIdentificator): Promise<DetailedSong>;
    abstract parseSongUrlList(): void;

    async parseSongDetails(threads: number = 10): Promise<void> {
        const maxParsedSogs = Number(this.configService.get('parser.maxSongs'));

        for (let i = 0; i < this.songUrlList.length / threads; i++) {
            const resps = await Promise.all(
                this.songUrlList
                    .slice(i * threads, (i + 1) * threads)
                    .map(el => this.parsePage(el)) as object[],
            );

            for (const resp of resps) {
                if (!resp) { continue; }

                if (!maxParsedSogs || this.songDetailedList.length < maxParsedSogs) {
                    this.songDetailedList.push({ ...resp } as DetailedSong);
                }
            }

            if (this.configService._isDev()) {
                this.logger.log(`parsed details of ${this.songDetailedList.length} songs`);
            }

            if (this.songDetailedList.length >= maxParsedSogs) {
                break;
            }

        }
    }

    async normalize(threads: number = 5) {
        try {
            const songDetailedList = this.songDetailedList;
            for (let i = 0; i < songDetailedList.length / threads; i++) {
                const resps = await Promise.all(
                    songDetailedList
                        .slice(i * threads, (i + 1) * threads)
                        .map(song => {
                            return this.normalizerService.normalizeSong(song);
                        }),
                ) as unknown as NormalizedSong[];

                this.normalizedSongs.push(...resps);
                this.logger.log(`normalized ${this.normalizedSongs.length} songs`);
            }
        } catch (e) {
            this.logger.error(e.message, e);
        }
    }

    sendUpdates() {
        try {
            for (const [i, project] of this.normalizedSongs.entries()) {
                this.socketService.sendData(project);

                if (i + 1 % 100 === 0 || i + 1 === this.normalizedSongs.length) {
                    this.logger.log(`sended ${i + 1} songs`);
                }
            }
        } catch (e) {
            this.logger.error(e.message, e);
        }
    }

    private async watchProcess(title: string, func: () => void) {
        const spinner = new Spinner();
        spinner.setSpinnerString('\-/|');

        spinner.setSpinnerTitle(title);
        spinner.start();
        await func.call(this);
        spinner.stop();
        this.logger.log(`Heap Used ${process.memoryUsage().heapUsed / (1024 * 1024)} MB`);
    }

    private async writeNormalizingListToFile(executionTime: any[] | [number, number]): Promise<void> {
        const parserName = this.configService.get('parser.name');
        let fileStr = `${parserName} parser:\n`
            + `date: ${new Date().toDateString()}\n`
            + `parsing time: ${executionTime[0]}s ${executionTime[1]}ms\n`
            + `active songs count: ${this.normalizedSongs.length}\n`
            + '-'.repeat(50) + '\n';

        let counter = 1;
        for (const song of this.normalizedSongs) {
            fileStr += `${counter}. ${JSON.stringify(song, null, 2)}\n\n`;
            counter++;
        }

        await fs.writeFile(`normalized_songs_list_${parserName}.txt`, fileStr, err => {
            if (err) { throw err; }
            this.logger.log('Normalized Songs List Saved to File!');
        });
    }
}
