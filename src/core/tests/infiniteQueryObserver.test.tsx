import { sleep, queryKey } from '../../react/tests/utils'
import {
  QueryClient,
  createQueryClient,
  createInfiniteQueryObserver,
} from '../..'

describe('InfiniteQueryObserver', () => {
  let queryClient: QueryClient

  beforeEach(() => {
    queryClient = createQueryClient()
    queryClient.mount()
  })

  afterEach(() => {
    queryClient.clear()
  })

  test('InfiniteQueryObserver should be able to fetch an infinite query with selector', async () => {
    const key = queryKey()
    const observer = createInfiniteQueryObserver(queryClient, {
      queryKey: key,
      queryFn: () => 1,
      select: data => ({
        pages: data.pages.map(x => `${x}`),
        pageParams: data.pageParams,
      }),
    })
    let observerResult
    const unsubscribe = observer.subscribe(result => {
      observerResult = result
    })
    await sleep(1)
    unsubscribe()
    expect(observerResult).toMatchObject({
      data: { pages: ['1'], pageParams: [undefined] },
    })
  })
})
