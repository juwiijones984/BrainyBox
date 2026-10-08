import { RouterProvider } from 'react-router'
import { AppStoreProvider } from '@/store/AppStore'
import { AuthStoreProvider } from '@/store/AuthStore'
import { router } from './routes'

// `AppStore` reads `useAuth()` for the current uid, so `AuthStoreProvider` has
// to be the outer of the two. Provider order is the whole dependency here:
// without auth above it, every learner read would have no uid to read for.
export default function App() {
  return (
    <AuthStoreProvider>
      <AppStoreProvider>
        <RouterProvider router={router} />
      </AppStoreProvider>
    </AuthStoreProvider>
  )
}
