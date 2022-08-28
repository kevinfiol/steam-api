import { dotenv, serve } from './deps.ts';

await dotenv.config();

serve((_req) => {
    const url = new URL(_req.url);
    console.log(url);
    return new Response('hello world');
});