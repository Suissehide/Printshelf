import { createRootRoute, Outlet } from '@tanstack/react-router'

import { Sidebar } from '@/components/layout/sidebar.tsx'
import { Toaster } from '@/components/ui/toaster.tsx'

export const Route = createRootRoute({
  component: () => (
    <div className="flex h-full">
      <Sidebar />
      <main className="relative flex min-w-0 flex-1 flex-col">
        <Outlet />
      </main>
      <Toaster />
    </div>
  ),
})
