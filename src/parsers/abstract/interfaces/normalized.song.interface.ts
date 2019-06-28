import { Author } from './author.interface';

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
    readonly album?: {
        title: string;
        thumbnailImg: string;
        author: Author;
        year: string;
        text: string;
        href?: string;
    };
}
