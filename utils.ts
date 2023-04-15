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

export async function hasher(text: string) {
  // https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/digest
  const uInt8 = new TextEncoder().encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', uInt8);

  // convert buffer to byte array
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  // convert bytes to hex string
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}