import { serve } from './deps.ts';
import { Steam } from './steam.ts';
import { Postgres } from './postgres.ts';
import { ROUTES } from './routes.ts';

const SERVER_PORT = Deno.env.get('SERVER_PORT') || 80;
const HOSTNAME = Deno.env.get('HOSTNAME') || '';
const STEAM_API_KEY = Deno.env.get('STEAM_API_KEY') || '';
const PG_USERNAME = Deno.env.get('PG_USERNAME') || '';
const PG_PASSWORD = Deno.env.get('PG_PASSWORD') || '';
const PG_DB = Deno.env.get('PG_DB') || '';
const PG_HOST = Deno.env.get('PG_HOST') || '';
const PG_PORT = Deno.env.get('PG_PORT') || ''; 

const db = Postgres({
    host: PG_HOST,
    port: PG_PORT,
    database: PG_DB,
    username: PG_USERNAME,
    password: PG_PASSWORD
});

const steam = Steam({ db, fetcher, apiKey: STEAM_API_KEY });

const routeMap = {
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

    INDEX: {
        methods: ['GET'],
        pattern: createPattern(ROUTES.INDEX),
        action: (_query: URLSearchParams, _params = {}) => ({
            data: 'OK',
            error: ''
        }),
    },

    GET_STEAM_APP_DETAILS: {
        methods: ['GET'],
        pattern: createPattern(ROUTES.GET_STEAM_APP_DETAILS),
        action: (query: URLSearchParams) => {
            return steam.getSteamAppDetails(query);
        }
    },

    GET_STEAM_CATEGORIES: {
        methods: ['GET'],
        pattern: createPattern(ROUTES.GET_STEAM_CATEGORIES),
        action: () => {
            return steam.getAllCategories();
        },
    },

    GET_PROFILES: {
        methods: ['GET'],
        pattern: createPattern(ROUTES.GET_PROFILES),
        action: (query: URLSearchParams) => {
            return steam.getAllProfiles(query);
        },
    },

    GET_COMMON_APPS: {
        methods: ['GET'],
        pattern: createPattern(ROUTES.GET_COMMON_APPS),
        action: (query: URLSearchParams) => {
            return steam.getCommonApps(query);
        },
    },

    GET_STEAM_ID: {
        methods: ['GET'],
        pattern: createPattern(ROUTES.GET_STEAM_ID),
        action: (query: URLSearchParams) => {
            return steam.getSteamID(query);
        }
    },
};

serve(async (req) => {
    const url = new URL(req.url);
    const response = await runRoute(req.method, url);
    return response;
}, {
    port: Number(SERVER_PORT)
});

function createPattern(pathname: string) {
    return new URLPattern({
        pathname,
        protocol: 'http{s}?',
        hostname: HOSTNAME
    });
}

async function runRoute(method: string, url: URL): Promise<Response> {
    const routes = Object.values(routeMap);

    for (let i = 0, len = routes.length; i < len; i++) {
        const route = routes[i];

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

async function fetcher(url: string, opts = {}) {
    const payload = { data: null, error: '' };

    try {
        const response = await fetch(url, opts);

        if (!response.ok) {
            throw Error(`${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        payload.data = data;
    } catch (e) {
        payload.error = e;
    }

    return payload;
}