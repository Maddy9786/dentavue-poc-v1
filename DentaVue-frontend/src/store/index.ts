import { configureStore } from '@reduxjs/toolkit'
import { setupListeners } from '@reduxjs/toolkit/query'
import { baseApi } from '@/services/api/baseApi'
import { rootReducer } from './rootReducer'

/**
 * A fresh store per request on the server; a single store on the client.
 * Never hoist this to a module-level singleton — on the server that would leak
 * one user's state into another's request.
 */
export function makeStore() {
  const store = configureStore({
    reducer: rootReducer,
    middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(baseApi.middleware),
    devTools: process.env.NODE_ENV !== 'production',
  })

  setupListeners(store.dispatch)
  return store
}

export type AppStore = ReturnType<typeof makeStore>
export type RootState = ReturnType<AppStore['getState']>
export type AppDispatch = AppStore['dispatch']
