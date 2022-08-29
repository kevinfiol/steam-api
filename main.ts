import { Steam } from './steam.ts';
import { ROUTES } from './routes.ts';
import { dotenv, serve } from './deps.ts';

const { HOSTNAME, STEAM_API_KEY } = await dotenv.config({ safe: true });
const steam = Steam({ fetcher, apiKey: STEAM_API_KEY });

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

    // GET_STEAM_CATEGORIES: {
    //     pattern: createPattern(ROUTES.GET_STEAM_CATEGORIES),
    //     action: noop,
    // },

    // GET_PROFILES: {
    //     pattern: createPattern(ROUTES.GET_PROFILES),
    //     action: noop,
    // },

    // GET_FRIENDS: {
    //     pattern: createPattern(ROUTES.GET_FRIENDS),
    //     action: noop,
    // },

    // GET_COMMON_APPS: {
    //     pattern: createPattern(ROUTES.GET_COMMON_APPS),
    //     action: noop,
    // },

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
    const response = await runRoute(url);
    return response;
});

function createPattern(pathname: string) {
    return new URLPattern({
        pathname,
        protocol: 'http{s}?',
        hostname: HOSTNAME
    });
}

async function runRoute(url: URL): Promise<Response> {
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
        const data = await response.json();
        payload.data = data;
    } catch (e) {
        payload.error = e;
    }

    return payload;
}