import React from 'react'
import { render } from '@testing-library/react'

import {
  createQueryClient,
  QueryClientProvider,
  createQueryCache,
  useQuery,
} from '../..'
import { dehydrate, useHydrate, Hydrate } from '../'
import { sleep } from '../../react/tests/utils'

describe('React hydration', () => {
  const fetchData: (value: string) => Promise<string> = value =>
    new Promise(res => setTimeout(() => res(value), 10))
  const dataQuery: (key: string) => Promise<string> = key => fetchData(key)
  let stringifiedState: string

  beforeAll(async () => {
    const queryCache = createQueryCache()
    const queryClient = createQueryClient({ queryCache })
    await queryClient.prefetchQuery({
      queryKey: 'string',
      queryFn: () => dataQuery('string'),
    })
    const dehydrated = dehydrate(queryClient)
    stringifiedState = JSON.stringify(dehydrated)
    queryClient.clear()
  })

  describe('useHydrate', () => {
    test('should hydrate queries to the cache on context', async () => {
      const dehydratedState = JSON.parse(stringifiedState)
      const queryCache = createQueryCache()
      const queryClient = createQueryClient({ queryCache })

      function Page() {
        useHydrate(dehydratedState)
        const { data } = useQuery({
          queryKey: 'string',
          queryFn: () => dataQuery('string'),
        })
        return (
          <div>
            <h1>{data}</h1>
          </div>
        )
      }

      const rendered = render(
        <QueryClientProvider client={queryClient}>
          <Page />
        </QueryClientProvider>
      )

      await sleep(10)
      rendered.getByText('string')
      queryClient.clear()
    })
  })

  describe('ReactQueryCacheProvider with hydration support', () => {
    test('should hydrate new queries if queries change', async () => {
      const dehydratedState = JSON.parse(stringifiedState)
      const queryCache = createQueryCache()
      const queryClient = createQueryClient({ queryCache })

      function Page({ queryKey }: { queryKey: string }) {
        const { data } = useQuery({
          queryKey: queryKey,
          queryFn: () => dataQuery(queryKey),
        })
        return (
          <div>
            <h1>{data}</h1>
          </div>
        )
      }

      const rendered = render(
        <QueryClientProvider client={queryClient}>
          <Hydrate state={dehydratedState}>
            <Page queryKey={'string'} />
          </Hydrate>
        </QueryClientProvider>
      )

      await sleep(10)
      rendered.getByText('string')

      const intermediateCache = createQueryCache()
      const intermediateClient = createQueryClient({
        queryCache: intermediateCache,
      })
      await intermediateClient.prefetchQuery({
        queryKey: 'string',
        queryFn: () => dataQuery('should change'),
      })
      await intermediateClient.prefetchQuery({
        queryKey: 'added string',
        queryFn: () => dataQuery('added string'),
      })
      const dehydrated = dehydrate(intermediateClient)
      intermediateClient.clear()

      rendered.rerender(
        <QueryClientProvider client={queryClient}>
          <Hydrate state={dehydrated}>
            <Page queryKey={'string'} />
            <Page queryKey={'added string'} />
          </Hydrate>
        </QueryClientProvider>
      )

      // Existing query data should be overwritten if older,
      // so this should have changed
      await sleep(10)
      rendered.getByText('should change')
      // New query data should be available immediately
      rendered.getByText('added string')

      queryClient.clear()
    })

    test('should hydrate queries to new cache if cache changes', async () => {
      const dehydratedState = JSON.parse(stringifiedState)
      const queryCache = createQueryCache()
      const queryClient = createQueryClient({ queryCache })

      function Page() {
        const { data } = useQuery({
          queryKey: 'string',
          queryFn: () => dataQuery('string'),
        })
        return (
          <div>
            <h1>{data}</h1>
          </div>
        )
      }

      const rendered = render(
        <QueryClientProvider client={queryClient}>
          <Hydrate state={dehydratedState}>
            <Page />
          </Hydrate>
        </QueryClientProvider>
      )

      await sleep(10)
      rendered.getByText('string')

      const newClientQueryCache = createQueryCache()
      const newClientQueryClient = createQueryClient({
        queryCache: newClientQueryCache,
      })

      rendered.rerender(
        <QueryClientProvider client={newClientQueryClient}>
          <Hydrate state={dehydratedState}>
            <Page />
          </Hydrate>
        </QueryClientProvider>
      )

      await sleep(10)
      rendered.getByText('string')

      queryClient.clear()
      newClientQueryClient.clear()
    })
  })
})
