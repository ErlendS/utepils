import type { BuildAction } from 'remix/fetch-router'

import type { routes } from '../routes.ts'

export const health: BuildAction<'GET', typeof routes.health> = {
  handler() {
    return new Response('ok\n', {
      headers: {
        'Cache-Control': 'no-store',
        'Content-Type': 'text/plain; charset=utf-8',
      },
    })
  },
}
