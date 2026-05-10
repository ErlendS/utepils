import { get, route } from 'remix/fetch-router/routes'

export const routes = route({
  assets: get('/assets/*path'),
  robots: get('/robots.txt'),
  home: '/',
  apiConfig: get('/api/config'),
  apiPoiProfile: get('/api/poi-profile'),
})
