import React from 'react'

import { QueryObserverResult } from '../core/types'
import { notifyManager } from '../core/notifyManager'
import { createQueryObserver, QueryObserver } from '../core/queryObserver'
import { useQueryErrorResetBoundary } from './QueryErrorResetBoundary'
import { useQueryClient } from './QueryClientProvider'
import { UseBaseQueryOptions } from './types'
import { useIsMounted } from './useIsMounted'

// UseBaseQueryOptions<TQueryFnData, TError, TData, TQueryData>
// typeof createQueryObserver

export function useBaseQuery<
  TOptions extends UseBaseQueryOptions<
    unknown,
    unknown,
    unknown,
    unknown
  > = UseBaseQueryOptions,
  TMakeObserver extends typeof createQueryObserver = typeof createQueryObserver
>(options: TOptions, createObserver: TMakeObserver) {
  const isMounted = useIsMounted()
  const queryClient = useQueryClient()
  const errorResetBoundary = useQueryErrorResetBoundary()
  const defaultedOptions = queryClient.defaultQueryObserverOptions(options)

  // Include callbacks in batch renders
  if (defaultedOptions.onError) {
    defaultedOptions.onError = notifyManager.batchCalls(
      defaultedOptions.onError
    )
  }

  if (defaultedOptions.onSuccess) {
    defaultedOptions.onSuccess = notifyManager.batchCalls(
      defaultedOptions.onSuccess
    )
  }

  if (defaultedOptions.onSettled) {
    defaultedOptions.onSettled = notifyManager.batchCalls(
      defaultedOptions.onSettled
    )
  }

  if (defaultedOptions.suspense) {
    // Always set stale time when using suspense to prevent
    // fetching again when directly re-mounting after suspense
    if (typeof defaultedOptions.staleTime !== 'number') {
      defaultedOptions.staleTime = 1000
    }

    // Prevent retrying failed query if the error boundary has not been reset yet
    if (!errorResetBoundary.isReset()) {
      defaultedOptions.retryOnMount = false
    }
  }

  // Create query observer
  const observerRef = React.useRef<QueryObserver<any, any, any, any>>()
  const observer =
    observerRef.current || createObserver(queryClient, defaultedOptions)
  observerRef.current = observer

  // Update options
  if (observer.hasListeners()) {
    observer.setOptions(defaultedOptions)
  }

  const currentResult = observer.getCurrentResult()
  const [, setCurrentResult] = React.useState(currentResult)

  // Subscribe to the observer
  React.useEffect(() => {
    errorResetBoundary.clearReset()
    return observer.subscribe(
      notifyManager.batchCalls((result: QueryObserverResult) => {
        if (isMounted()) {
          setCurrentResult(result)
        }
      })
    )
  }, [observer, errorResetBoundary, isMounted])

  // Handle suspense
  if (observer.options.suspense || observer.options.useErrorBoundary) {
    if (observer.options.suspense && currentResult.isLoading) {
      errorResetBoundary.clearReset()
      const unsubscribe = observer.subscribe()
      throw observer.refetch().finally(unsubscribe)
    }

    if (currentResult.isError) {
      throw currentResult.error
    }
  }

  return observer.options.notifyOnChangeProps === 'tracked'
    ? observer.getTrackedCurrentResult()
    : currentResult
}
