type App = {
    id: number;
    steam_appid: string;
    name: string;
    header_image: string;
    is_free: boolean;
    platforms: { windows: boolean, mac: boolean, linux: boolean };
    categories: number[];
    updated_at?: string;
};

type Category = {
    id?: number;
    category_id: string;
    description: string;
};

type Database = {
    getApps: (steam_appids: number | number[]) => Promise<App[]>;
    getCategories: () => Promise<Category[]>;
    insertApp: (app: Partial<App>) => Promise<App[]>;
    insertCategories: (categories: Category[]) => Promise<Category[]>;
};

type Payload = {
    data: unknown[];
    error: Error | string;
};

type Fetcher<T> = (
    url: string,
    opts?: T
) => Promise<{
    data: unknown;
    error: Error | string
}>;