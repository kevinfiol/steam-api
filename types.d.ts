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
    category_id: number;
    description: string;
};

type PlayerSummary = {
    steamid: string;
    personaname: string;
    profileurl: string;
    avatar: string;
    communityvisibilitystate: number;
};

type Database = {
    getApps: (steam_appids: number | number[]) => Promise<App[]>;
    getCategories: () => Promise<Category[]>;
    insertApp: (app: Partial<App>) => Promise<App[]>;
    insertCategories: (categories: Category[]) => Promise<Category[]>;
    getCommonApps: (steamids: string) => Promise<Array<{ data: string, age: number }>>;
    insertCommonApps: (steamids: string, apps: App[]) => Promise<Array<{ id: number, steamids: string, data: string, updated_at: Date }>>;
};

type Payload = {
    data: unknown[];
    error: Error | string;
};

type Fetcher = (
    url: string,
    opts?: RequestInit | Record<string, unknown>
) => Promise<{
    data: unknown;
    error: Error | string
}>;