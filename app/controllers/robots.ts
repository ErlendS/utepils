import type { BuildAction } from 'remix/fetch-router'

import type { routes } from '../routes.ts'

export const robots: BuildAction<'GET', typeof routes.robots> = {
  handler() {
    return new Response('User-agent: *\nDisallow: /\n', {
      headers: {
        'Cache-Control': 'public, max-age=3600',
        'Content-Type': 'text/plain; charset=utf-8',
        'X-Robots-Tag': 'noindex, nofollow',
      },
    })
  },
}
