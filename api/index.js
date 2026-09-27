import { handleAPI } from '../server/api.mjs';
import { getHostedDB } from '../server/postgres-db.mjs';

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const path = url.searchParams.get('path');
    if (path !== null) {
      url.pathname = `/api/${path}`;
      url.searchParams.delete('path');
      request = new Request(url, request);
    }
    return handleAPI(request, { DB: getHostedDB() });
  },
};
