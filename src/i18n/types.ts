import type { en } from './locales/en';

export type DeepPartial<T> = T extends object
    ? {
          [P in keyof T]?: DeepPartial<T[P]>;
      }
    : T;

export type LanguageTranslation = DeepPartial<typeof en>;

export type LanguageMetadata = {
    name: string;
    nativeName: string;
    code: string;
};
