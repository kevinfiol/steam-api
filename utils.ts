export async function fetcher(url: string, opts: RequestInit = {}) {
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