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
            console.error(e);
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
            console.error(e);
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

        async getAppDetails(query: URLSearchParams) {
            const payload: Payload = { data: [], error: '' };
            const appids = query.get('appids');
            let app;

            if (!appids) {
                payload.error = 'No appids provided';
                return payload;
            }

            try {
                const [row] = await db.getApps(appids);

                if (row) app = row;
                else app = await getSteamApp(appids);

                payload.data.push(app);
            } catch (e) {
                console.error(e);
                payload.error = e.message;
            }

            return payload;
        },

        async getSteamId(query: URLSearchParams) {
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
                console.error(e);
                payload.error = e.message;
            }

            return payload;
        },

        async getCategories() {
            const payload: Payload = { data: [], error: '' };

            try {
                const rows = await db.getCategories();

                const categoryMap = rows.reduce((a, c) => {
                    a[c.category_id] = c.description;
                    return a;
                }, {});

                payload.data.push(categoryMap);
            } catch (e) {
                console.error(e);
                payload.error = e.message;
            }

            return payload;
        },

        async getProfiles(query: URLSearchParams) {
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
                const [user] = profiles.splice(idx, 1);

                // sort friend profiles by name
                profiles.sort((a, b) => a.personaname > b.personaname);

                payload.data.push({
                    idString: steamidsStr,
                    user,
                    friends: profiles
                });
            } catch (e) {
                console.error(e);
                payload.error = e.message || e;
            }

            return payload;
        },

        async getCommonApps(query: URLSearchParams) {
            const payload: Payload = { data: [], error: '' };
            const steamidsStr = query.get('steamids') || '';
            const rawSteamids = steamidsStr.split(',');

            try {
                // const steamids = rawSteamids;
                const steamids = [];

                // allow vanity steamids
                for (let steamid of rawSteamids) {
                    if (!Number.isFinite(Number(steamid))) {
                        steamid = await resolveVanityURL(steamid);
                    }

                    steamids.push(steamid);
                }

                const results = await Promise.all(steamids.map((steamid: string) => {
                    query = new URLSearchParams({
                        steamid,
                        include_appinfo: '1',
                        include_played_free_games: '1'
                    });

                    return apiCall(query,
                        'IPlayerService',
                        'GetOwnedGames',
                        'v0001'
                    );
                }));

                const libs = [];
                for (const result of results) {
                    // @ts-ignore: external api data
                    const { games } = result.data[0].response;
                    const appids = games.map((game) => game.appid);
                    libs.push(appids);
                }

                const first = libs.pop();
                const commonAppIds = libs.reduce((common, lib) => {
                    return common.filter((id) => lib.includes(id));
                }, first)

                // check db for stored apps
                const appsFromDb = await db.getApps(commonAppIds);
                const idsFromDb = appsFromDb.map((app) => app.steam_appid);
                const appsToFetch = commonAppIds.filter((id) => !idsFromDb.includes(id));

                // fetch apps that are not in the db
                let fetchedApps = [];
                if (appsToFetch.length > 0) {
                    fetchedApps = await Promise.all(appsToFetch.map((id) => {
                        return getSteamApp(id);
                    }));

                    // filter out null/undefined results
                    fetchedApps = fetchedApps.filter(a => a);
                }

                const commonApps = [ ...appsFromDb, ...fetchedApps ];
                commonApps.sort((a, b) => a.name.localeCompare(b.name));
                payload.data.push(commonApps);
            } catch (e) {
                console.error(e);
                payload.error = e.message;
            }

            return payload;
        }
    };
};