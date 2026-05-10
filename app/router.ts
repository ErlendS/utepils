import { createRouter } from 'remix/fetch-router'

import { assets } from './assets.ts'
import { apiConfig, poiProfile } from './controllers/api.ts'
import { health } from './controllers/health.ts'
import { home } from './controllers/home.tsx'
import { robots } from './controllers/robots.ts'
import { routes } from './routes.ts'

export const router = createRouter()

router.get(routes.assets, async ({ request }) => {
  let response = await assets.fetch(request)
  return response ?? new Response('Not Found', { status: 404 })
})

router.map(routes.home, home)
router.map(routes.health, health)
router.map(routes.robots, robots)
router.map(routes.apiConfig, apiConfig)
router.map(routes.apiPoiProfile, poiProfile)
