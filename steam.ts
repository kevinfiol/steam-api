/// <reference types="./types.d.ts" />

const API_URL = 'http://api.steampowered.com';
const STORE_URL = 'http://store.steampowered.com/api';
const MAX_APPS_CACHE_AGE_SECONDS = 86400; // 24 hrs

type Params = {
    db: Database;
    fetcher: Fetcher;
    hasher: (ids: string) => Promise<string>
    apiKey: string;
};

const toNumber = (s: string) => parseInt(s, 10);

export const Steam = ({ db, fetcher, hasher, apiKey }: Params) => {
    const apiCall = async (query: URLSearchParams | string, iface: string, command: string, version: string) => {
        const payload: Payload = { data: [], error: '' };

        if (typeof query == 'string') {
            query += `&key=${apiKey}`;
        } else {
            query.append('key', apiKey);
            query = query.toString();
        }

        const url = `${API_URL}/${iface}/${command}/${version}?${query}`;

        try {
            const { data, error } = await fetcher(url);
            if (error) throw error;
            payload.data.push(data);
        } catch (e) {
            console.error('apiCall', e);
            payload.error = 'Steam apiCall failed.';
        }

        return payload;
    };

    const storeCall = async (query: URLSearchParams | string, command: string) => {
        const payload: Payload = { data: [], error: '' };

        if (typeof query == 'object') query = query.toString();
        const url = `${STORE_URL}/${command}?${query}`;

        try {
            const { data, error } = await fetcher(url);
            if (error) throw error;
            payload.data.push(data);
        } catch (e) {
            console.error('storeCall', e);
            payload.error = 'Steam storeCall failed.';
        }

        return payload;
    };

    const getSteamApp = async (appids: string) => {
        let app: App | null = null;
        const query = new URLSearchParams({ appids });

        try {
            const { data, error } = await storeCall(query, 'appdetails');
            if (error) throw error;
            if (!data[0]) throw 'No app found.';

            // @ts-ignore: deeply-nested response objects from Store API
            const res = data[0][appids];

            if (!res.success) {
                throw 'Store API failed to retrieve app details. App may be delisted.';
            }

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
            console.error('getSteamApp', e);
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
            console.error('resolveVanityURL', e);
        }

        return out;
    };

    const getPlayerSummaries = async (steamids: string) => {
        let summaries: PlayerSummary[] = [];
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
            console.error('getPlayerSummaries', e);
        }

        return summaries;
    };

    // @ts-ignore: external api record
    const mapSummaryToProfile = (s) => {
        return {
            steamid: s.steamid,
            personaname: s.personaname,
            profileurl: s.profileurl,
            avatar: s.avatar,
            // this turns `https://steamcommunity.com/profiles/76561198027592111/` to `76561198027592111`,
            // and `https://steamcommunity.com/id/kebsteam` to `kebsteam`
            identifier: s.profileurl.split('/').splice(4).join(''),
            visible: s.communityvisibilitystate == 3
                ? true
                : false
        };
    };

    return {
        steamApi: apiCall,
        storeApi: storeCall,

        async getAppDetails(appids: string) {
            const payload: Payload = { data: [], error: '' };
            let app: App | null;

            try {
                const [row] = await db.getApps(Number(appids));

                if (row) app = row;
                else app = await getSteamApp(appids);

                if (app) payload.data.push(app);
            } catch (e) {
                console.error('getAppDetails', e);
                payload.error = 'getAppDetails failed.';
            }

            return payload;
        },

        async getSteamId(identifier: string) {
            const payload: Payload = { data: [], error: '' };

            try {
                if (!Number.isFinite(toNumber(identifier))) {
                    const steamId = await resolveVanityURL(identifier);
                    payload.data.push(steamId);
                } else {
                    payload.data.push(identifier);
                }
            } catch (e) {
                console.error('getSteamId', e);
                payload.error = 'getSteamId failed.';
            }

            return payload;
        },

        async getCategories() {
            const payload: Payload = { data: [], error: '' };

            try {
                const categories = await db.getCategories();
                const entries = categories.map(c => [c.category_id, c.description]);
                payload.data.push(entries);
            } catch (e) {
                console.error('getCategories', e);
                payload.error = 'getCategories failed.';
            }

            return payload;
        },

        async getFriends(steamid: string) {
            const payload: Payload = { data: [], error: '' };

            try {
                if (!Number.isFinite(toNumber(steamid))) {
                    steamid = await resolveVanityURL(steamid);
                }

                const query = new URLSearchParams({ steamid, relationship: 'friend' });

                // retrieve friends list
                const { data, error } = await apiCall(query, 'ISteamUser', 'GetFriendList', 'v0001');
                if (error) throw error;

                // @ts-ignore: external api
                const friends: Array<{ steamid: number }> = data[0].friendslist.friends;
                
                // collect all steamids
                const steamids = [
                    steamid,
                    ...friends.map((f) => f.steamid)
                ];

                // retrieve player summaries
                const steamidsStr = steamids.join(',');
                const summaries = await getPlayerSummaries(steamidsStr);
                const profiles = summaries.map(mapSummaryToProfile);

                const idx = profiles.findIndex((p) => p.steamid == steamid);
                const [user] = profiles.splice(idx, 1);

                profiles.sort((a, b) => a.personaname.localeCompare(b.personaname));

                payload.data.push({
                    idString: steamidsStr,
                    user,
                    friends: profiles
                });
            } catch (e) {
                console.error('getFriends', e);
                payload.error = 'getFriends failed.';
            }

            return payload;
        },

        async getProfiles (steamidsCSV: string) {
            const payload: Payload = { data: [], error: '' };
            const rawSteamids = steamidsCSV.split(',');

            try {
                const steamids = [];

                // allow vanity steamids
                for (let steamid of rawSteamids) {
                    if (!Number.isFinite(toNumber(steamid))) {
                        steamid = await resolveVanityURL(steamid);
                    }

                    steamids.push(steamid);
                }

                // retrieve player summaries
                const steamidsStr = steamids.join(',');
                const summaries = await getPlayerSummaries(steamidsStr);
                const profiles = summaries.map(mapSummaryToProfile);

                payload.data.push({ profiles });
            } catch (e) {
                console.error('getProfiles', e);
                payload.error = 'getProfiles failed.';
            }

            return payload;
        },

        async getCommonApps(steamidsCSV: string) {
            const payload: Payload = { data: [], error: '' };
            const rawSteamids = steamidsCSV.split(',');
            let shouldUpdateDB = true;
            let apps = [];

            try {
                if (rawSteamids.length < 2) {
                    throw Error('2 profiles required to compare libraries.');
                }

                const steamids: string[] = [];

                // allow vanity steamids
                for (let steamid of rawSteamids) {
                    if (!Number.isFinite(toNumber(steamid))) {
                        steamid = await resolveVanityURL(steamid);
                    }

                    steamids.push(steamid);
                }

                // sort to create idString to check db if common apps already exists
                steamids.sort((a, b) => a.localeCompare(b));
                const idString = steamids.join(',');
                const hash = await hasher(idString);

                // check db first for cache
                const cache = await db.getCommonApps(hash);

                if (cache.length) {
                    const { data, age } = cache[0];

                    if (age < MAX_APPS_CACHE_AGE_SECONDS) {
                        shouldUpdateDB = false;
                        apps = JSON.parse(data);
                    }
                }

                if (shouldUpdateDB) {
                    const results = await Promise.all(steamids.map((steamid: string) => {
                        const gameQuery = new URLSearchParams({
                            steamid,
                            include_appinfo: '1',
                            include_played_free_games: '1'
                        });

                        return apiCall(gameQuery,
                            'IPlayerService',
                            'GetOwnedGames',
                            'v0001'
                        );
                    }));

                    const libs: number[][] = [];
                    for (const result of results) {
                        // @ts-ignore: external api data
                        const games: Array<{ appid: number }> | undefined = result.data[0].response.games;
                        if (!games) throw 'Could not retrieve profiles for user.';

                        const appids: number[] = games.map((game) => game.appid);
                        libs.push(appids);
                    }

                    const first = libs.pop() || [];
                    const commonAppIds = libs.reduce((common, lib) => {
                        return common.filter((id) => lib.includes(id));
                    }, first);

                    // check db for stored apps
                    const appsFromDb = await db.getApps(commonAppIds);
                    const idsFromDb = appsFromDb.map((app) => Number(app.steam_appid));
                    const appsToFetch = commonAppIds.filter((id) => !idsFromDb.includes(id));

                    // fetch apps that are not in the db
                    let fetchedApps: App[] = [];
                    if (appsToFetch.length > 0) {
                        const temp = await Promise.all(appsToFetch.map((id) => {
                            return getSteamApp(id.toString());
                        }));

                        // filter out null/undefined results
                        fetchedApps = temp.filter(a => a) as App[];
                    }

                    const commonApps = [ ...appsFromDb, ...fetchedApps ];
                    commonApps.sort((a, b) => a.name.localeCompare(b.name));

                    // TO-DO: should be in the DB
                    // This adds a category map to apps as well
                    apps = commonApps.map(app => ({
                        ...app,
                        categoryMap: app.categories.reduce((a: Record<string, boolean>, c) => {
                            a[c] = true;
                            return a;
                        }, {})
                    }));

                    // cache in db
                    await db.insertCommonApps(hash, apps);
                }

                payload.data.push({
                    count: apps.length,
                    apps
                });
            } catch (e) {
                console.error('getCommonApps', e);
                payload.error = 'getCommonApps failed.';
            }

            return payload;
        }
    };
};