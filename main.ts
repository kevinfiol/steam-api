import { serve } from './deps.ts';
import { fetcher } from './utils.ts';
import { Steam } from './steam.ts';
import { Postgres } from './postgres.ts';
import { ROUTES } from './routes.ts';

// load .env variables
const SERVER_PORT = Deno.env.get('SERVER_PORT') || 80;
const HOSTNAME = Deno.env.get('HOSTNAME') || 'localhost';
const STEAM_API_KEY = Deno.env.get('STEAM_API_KEY') || '';
const PG_USERNAME = Deno.env.get('PG_USERNAME') || '';
const PG_PASSWORD = Deno.env.get('PG_PASSWORD') || '';
const PG_DB = Deno.env.get('PG_DB') || '';
const PG_HOST = Deno.env.get('PG_HOST') || '';
const PG_PORT = Deno.env.get('PG_PORT') || '';

// create db instance
const db = Postgres({
    // need `keep_alive` while Deno.Conn#setKeepAlive is unstable
    // todo: remove this in the future
    keep_alive: false,
    host: PG_HOST,
    port: PG_PORT,
    database: PG_DB,
    username: PG_USERNAME,
    password: PG_PASSWORD
});

// initialize steam service
const steam = Steam({ db, fetcher, apiKey: STEAM_API_KEY });

// url pattern helper
const createPattern = (pathname: string) => {
    return new URLPattern({
        pathname,
        protocol: 'http{s}?'
    });
};

const routeMap = {
    INDEX: {
        methods: ['GET'],
        pattern: createPattern(ROUTES.INDEX),
        action: (_query: URLSearchParams, _params = {}) => ({
            data: 'OK',
            error: ''
        }),
    },

    STEAM_API: {
        methods: ['GET'],
        pattern: createPattern(ROUTES.STEAM_API),
        action: (query: URLSearchParams, params: Record<string, string>) => {
            const { iface, command, version } = params;
            return steam.steamApi(query, iface, command, version);
        }
    },

    STORE_API: {
        methods: ['GET'],
        pattern: createPattern(ROUTES.STORE_API),
        action: (query: URLSearchParams, params: Record<string, string>) => {
            const { command } = params;
            return steam.storeApi(query, command);
        }
    },

    GET_APP_DETAILS: {
        methods: ['GET'],
        pattern: createPattern(ROUTES.GET_APP_DETAILS),
        action: (query: URLSearchParams) => {
            const appids = query.get('appids') || '';
            return steam.getAppDetails(appids);
        }
    },

    GET_CATEGORIES: {
        methods: ['GET'],
        pattern: createPattern(ROUTES.GET_CATEGORIES),
        action: () => {
            return steam.getCategories();
        },
    },

    GET_PROFILES: {
        methods: ['GET'],
        pattern: createPattern(ROUTES.GET_PROFILES),
        action: (query: URLSearchParams) => {
            const steamid = query.get('steamid') || '';
            return steam.getProfiles(steamid);
        },
    },

    GET_COMMON_APPS: {
        methods: ['GET'],
        pattern: createPattern(ROUTES.GET_COMMON_APPS),
        action: (query: URLSearchParams) => {
            const steamidsCSV = query.get('steamids') || '';
            return steam.getCommonApps(steamidsCSV);
        },
    },

    GET_STEAM_ID: {
        methods: ['GET'],
        pattern: createPattern(ROUTES.GET_STEAM_ID),
        action: (query: URLSearchParams) => {
            const identifier = query.get('identifier') || '';
            return steam.getSteamId(identifier);
        }
    },
};

// start server
serve(async (req) => {
    const url = new URL(req.url);
    return await runRoute(req.method, url);
}, {
    port: Number(SERVER_PORT)
});

async function runRoute(method: string, url: URL): Promise<Response> {
    const routes = Object.values(routeMap);

    for (const route of routes) {
        const out = route.pattern.exec({
            protocol: url.protocol,
            pathname: url.pathname,
            hostname: url.host,
            search: url.search
        });

        if (out !== null) {
            if (!route.methods.includes(method)) {
                return new Response('405 Method Not Allowed', {
                    status: 405,
                    headers: { 'content-type': 'text/plain' }
                });
            }

            const query = new URLSearchParams(out.search.input);
            const params = out.pathname.groups;
            const payload = await route.action(query, params);

            return new Response(JSON.stringify(payload), {
                status: payload.error ? 500 : 200,
                headers: { 'content-type': 'application/json' }
            });
        }
    }

    return new Response('404', {
        status: 404,
        statusText: 'Not Found'
    });
}
