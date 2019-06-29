import { Author } from './author.interface';

export interface Album {
    readonly title: string;
    readonly url: string;
    readonly year?: string;
    readonly description?: string;
    readonly thumbnailImg?: string;
    readonly author?: Author;
    readonly iTunes?: string;
    readonly googlePlay?: string;
}
