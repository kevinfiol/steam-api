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

export const Steam = ({ db, fetcher, apiKey }: { db: any, fetcher: Fetcher, apiKey: string }) => {
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
                platforms
            } = res.data;

            const categories: Array<{ id: number, description: string }> = res.data.categories;

            const columns = {
                steam_appid,
                name,
                header_image,
                is_free,
                platforms: platforms,
                categories: categories.map(c => c.id)
            };

            // save app to db
            [app] = await db.insertApp(columns);

            // save categories to db
            const dbCategories = categories.map(c =>
                ({ ...c, category_id: c.id })
            );

            await db.insertCategories(dbCategories);
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

    const getPlayerSummaries = async (steamids: string) => {
        let summaries = [];
        const query = new URLSearchParams({ steamids });

        try {
            const { data, error } = await apiCall(query,
                'ISteamUser',
                'GetPlayerSummaries',
                'v0002'
            );

            if (error) throw error;
            if (!data[0]) throw 'No player summaries found';

            // @ts-ignore: external api response
            summaries = data[0].response.players;

        } catch (e) {
            console.error(e);
        }

        return summaries;
    };

    return {
        steamApi: apiCall,
        storeApi: storeCall,

        async getSteamAppDetails(query: URLSearchParams) {
            const payload: Payload = { data: [], error: '' };
            const appids = query.get('appids');
            let app;

            if (!appids) {
                payload.error = 'No appids provided';
                return payload;
            }

            try {
                const [row] = await db.getApp(appids);

                if (row) app = row;
                else app = await getSteamApp(appids);

                payload.data.push(app);
            } catch (e) {
                payload.error = e.message;
            }

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
                payload.error = e.message;
            }

            return payload;
        },

        async getAllCategories() {
            const payload: Payload = { data: [], error: '' };

            try {
                const rows = await db.getCategories();

                const categoryMap = rows.reduce((a, c) => {
                    a[c.category_id] = c.description;
                    return a;
                }, {});

                payload.data.push(categoryMap);
            } catch (e) {
                payload.error = e.message;
            }

            return payload;
        },

        async getAllProfiles(query: URLSearchParams) {
            const payload: Payload = { data: [], error: '' };

            let steamid = query.get('steamid') || '';

            try {
                if (!Number.isFinite(steamid)) {
                    steamid = await resolveVanityURL(steamid);
                }

                query = new URLSearchParams({ steamid, relationship: 'friend' });

                // retrieve friends list
                const { data, error } = await apiCall(query, 'ISteamUser', 'GetFriendList', 'v0001');
                if (error) throw error;

                // @ts-ignore: external api
                const { friendslist: { friends } } = data[0];
                
                // collect all steamids
                const steamids = [
                    steamid,
                    ...friends.map((f: { steamid: number }) => f.steamid)
                ];

                const steamidsStr = steamids.join(',');

                // retrieve player summaries
                const summaries = await getPlayerSummaries(steamidsStr);

                // @ts-ignore: external api type
                const profiles = summaries.map(s => ({
                    steamid: s.steamid,
                    personaname: s.personaname,
                    profileurl: s.profileurl,
                    avatar: s.avatar,
                    visible: s.communityvisibilitystate == 3
                        ? true
                        : false
                }));

                // split the user's profile from their friends' profile
                const idx = profiles.findIndex(p => p.steamid == steamid);
            } catch (e) {
                payload.error = e.message || e;
            }

            return payload;
        }
    };
};