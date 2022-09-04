export async function fetcher(url: string, opts: RequestInit = {}) {
    const payload = { data: null, error: '' };

    try {
        const response = await fetch(url, opts);

        if (!response.ok) {
            throw Error(`${url}: ${response.status} ${response.statusText}`);
        }

        payload.data = await response.json() || '';
    } catch (e) {
        console.error(e);
        payload.error = e;
    }

    return payload;
}