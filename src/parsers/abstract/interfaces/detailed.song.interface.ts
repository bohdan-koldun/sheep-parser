import { Author } from './author.interface';

export interface DetailedSong {
    readonly title: string;
    readonly songText: string;
    readonly url: string;
    readonly audioMp3?: string;
    readonly videoAttachment?: string;
    readonly tags?: string[];
    readonly chordsKey?: string;
    readonly translations: Array<{
        translatin: string,
        href: string,
    }>;
    readonly album?: {
        title: string;
        author?: Author;
        thumbnailImg: string;
        href: string;
    };
}
