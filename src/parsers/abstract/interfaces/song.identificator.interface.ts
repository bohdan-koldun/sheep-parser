import { Author } from './author.interface';

export interface SongIdentificator {
    readonly uri: string;
    readonly author?: Author;
}
