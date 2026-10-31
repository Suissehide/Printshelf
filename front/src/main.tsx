import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createRouter, RouterProvider } from '@tanstack/react-router'
import { StrictMode } from 'react'
import ReactDOM from 'react-dom/client'

import { routeTree } from './routeTree.gen.ts'
import './styles/index.css'

const queryClient = new QueryClient({
  // `retry: 0` comme dans MediSync : une erreur doit s'afficher, pas rester en chargement.
  defaultOptions: { queries: { retry: 0, refetchOnWindowFocus: true } },
})

const router = createRouter({
  routeTree,
  defaultPreload: 'intent',
  scrollRestoration: true,
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

const rootElement = document.getElementById('root')
if (rootElement && !rootElement.innerHTML) {
  ReactDOM.createRoot(rootElement).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </StrictMode>,
  )
}
