const API_URL = 'http://api.steampowered.com';
const STORE_URL = 'http://store.steampowered.com/api';

type Payload = {
    data: unknown[],
    error: Error | string
};

type Fetcher = (
    url: string,
    { query }?: {
        query?: Record<string, unknown>
    }
) => Promise<{
    data: unknown,
    error: Error | string
}>;

export const Steam = ({ fetcher, apiKey }: { fetcher: Fetcher, apiKey: string }) => {
    const apiCall = async (query: URLSearchParams, iface: string, command: string, version: string) => {
        query.append('key', apiKey);

        const payload: Payload = { data: [], error: '' };
        const url = `${API_URL}/${iface}/${command}/${version}?${query.toString()}`;

        try {
            const { data, error } = await fetcher(url);
            if (error) throw error;
            payload.data.push(data);
        } catch (e) {
            payload.error = e.message;
        }

        return payload;
    };

    const storeCall = async (query: URLSearchParams, command: string) => {
        const payload: Payload = { data: [], error: '' };
        const url = `${STORE_URL}/${command}?${query.toString()}`;

        try {
            const { data, error } = await fetcher(url);
            if (error) throw error;
            payload.data.push(data);
        } catch (e) {
            payload.error = e.message;
        }

        return payload;
    };

    const getSteamApp = async (appids: string) => {
        let app = null;
        const query = new URLSearchParams({ appids });

        try {
            const { data, error } = await storeCall(query, 'appdetails');
            if (error) throw error;
            if (!data[0]) throw 'No app found.';

            // @ts-ignore: deeply-nested response objects from Store API
            const res = data[0][appids];
            if (!res.success) throw 'Store API failed to retrieve app details.';

            const {
                steam_appid,
                name,
                header_image,
                is_free,
                platforms,
                categories
            } = res.data;

            app = {
                steam_appid,
                name,
                header_image,
                is_free,
                platforms: platforms,
                categories: categories.map((c: Record<string, string>) => c.id)
            };

            // TODO: add app to db here
            // TODO: add categories to db here
        } catch (e) {
            console.error(e);
        }

        return app;
    };

    const resolveVanityURL = async (steamId: string) => {
        let out = steamId;
        const query = new URLSearchParams({ vanityurl: steamId });

        try {
            const { data, error } = await apiCall(query,
                'ISteamUser',
                'ResolveVanityURL',
                'v0001'
            );

            if (error) throw error;
            if (!data[0]) throw 'No Steam Profile match found.';

            // @ts-ignore: nested 3rd-party API response
            const res = data[0].response;
            if (!res.success) throw 'Non-success message returned from Steam.';

            out = res.steamid;
        } catch (e) {
            console.error(e);
        }

        return out;
    };

    return {
        steamApi: apiCall,
        storeApi: storeCall,

        async getSteamAppDetails(query: URLSearchParams) {
            const payload: Payload = { data: [], error: '' };
            const appids = query.get('appids');

            if (!appids) {
                payload.error = 'No appids provided';
                return payload;
            }

            const app = await getSteamApp(appids);
            payload.data.push(app);
            return payload;
        },

        async getSteamID(query: URLSearchParams) {
            const payload: Payload = { data: [], error: '' };
            const identifier = query.get('identifier');

            if (!identifier) {
                payload.error = 'No identifier provided';
                return payload;
            }

            try {
                if (!Number.isFinite(identifier)) {
                    const steamId = await resolveVanityURL(identifier);
                    payload.data.push(steamId);
                } else {
                    payload.data.push(identifier);
                }
            } catch (e) {
                payload.error = e;
            }

            return payload;
        }
    };
};