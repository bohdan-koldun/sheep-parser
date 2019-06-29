import { Author } from './author.interface';
import { Album } from './album.interface';

export interface NormalizedSong {
    readonly title: string;
    readonly songText: string;
    readonly url: string;
    readonly audioMp3?: string;
    readonly videoAttachment?: string;
    readonly tags?: string[];
    readonly translations: Array<{
        translatin: string,
        href: string,
    }>;
    readonly chordsKey?: string;
    readonly album?: Album;
}
