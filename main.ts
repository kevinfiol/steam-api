import { dotenv, serve } from './deps.ts';
import { fetcher } from './utils.ts';
import { Steam } from './steam.ts';
import { Postgres } from './postgres.ts';
import { ROUTES } from './routes.ts';

// load .env variables
const {
    SERVER_PORT,
    HOSTNAME,
    STEAM_API_KEY,
    PG_USERNAME,
    PG_PASSWORD,
    PG_DB,
    PG_HOST,
    PG_PORT
} = await dotenv.config({ safe: true });

// create db instance
const db = Postgres(`postgres://${PG_USERNAME}:${PG_PASSWORD}@${PG_HOST}:${PG_PORT}/${PG_DB}`, {
    // need `keep_alive` while Deno.Conn#setKeepAlive is unstable
    // todo: remove this in the future
    keep_alive: false
});

// initialize steam service
const steam = Steam({ db, fetcher, apiKey: STEAM_API_KEY });

// url pattern helper
const createPattern = (pathname: string) => {
    return new URLPattern({
        pathname,
        protocol: 'http{s}?',
        hostname: HOSTNAME
    });
}

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
            return steam.getAppDetails(query);
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
            return steam.getProfiles(query);
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
            return steam.getSteamId(query);
        }
    },
};

// start server
serve(async (req) => {
    const url = new URL(req.url);
    const response = await runRoute(req.method, url);
    return response;
}, {
    port: Number(SERVER_PORT)
});

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
