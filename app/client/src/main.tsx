import ReactDOM from 'react-dom/client';
import './index.css';

import { createBrowserRouter, Navigate, RouterProvider } from 'react-router-dom';
import { VideoListPage } from './components/video-editor/VideoList.tsx';
import { Upload } from './components/upload/Upload.tsx';
import { VideoPage } from './components/video-editor/VideoPage.tsx';
import { AddToLibrary } from './components/library/AddToLibrary.tsx';
import LibraryProcessing from './components/library/LibraryProcessing.tsx';
import { ChakraProvider } from '@chakra-ui/react';
import { AuthProvider } from './contexts/auth/Provider.tsx';
import { Login } from './components/auth/Login.tsx';
import { WithAuth } from './components/common/WithAuth.tsx';
import { Layout } from './components/common/Layout.tsx';
import { UploadProgress } from './components/upload/UploadProgress.tsx';
import { UploadListPage } from './components/upload/UploadList.tsx';
import { ExportProgress } from './components/export/ExportProgress.tsx';
import { ExportDetailsPage } from './components/export/ExportDetails.tsx';
import { HighlightPage } from './components/highlight/Highlight.tsx';
import { HighlightListPage } from './components/highlight/HighlightList.tsx';
import { QueryClient, QueryClientProvider } from 'react-query';
import { ProtectedRoute } from './components/common/ProtectedRoute.tsx';
import ReactGA from 'react-ga4';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { PasswordSignIn } from './components/auth/PasswordSignIn.tsx';
import { mainTheme } from './theme/theme.ts';
import PreUserPrompt from './components/preuser-prompts/PreUserPrompt';

if (import.meta.env.VITE_MEASUREMENT_ID) {
  ReactGA.initialize(import.meta.env.VITE_MEASUREMENT_ID);
}

import LibraryList from './components/library/LibraryList.tsx';
import { LibraryDetails } from './components/library/LibraryDetails.tsx';
import { LibraryHeuristicComparison } from './components/library/LibraryHeuristicComparison.tsx';
import { LibraryDuplicateDetection } from './components/library/LibraryDuplicateDetection.tsx';
import { Unsubscribe } from './components/unsubscribe/Unsubscribe.tsx';
import { AdminVideoList } from './components/admin/AdminVideoList.tsx';
import { AdminLibraryList } from './components/admin/AdminLibraryList.tsx';
import { AdminSurveyList } from './components/admin/AdminSurveyList.tsx';
import { AdminExportStats } from './components/admin/AdminExportStats.tsx';
import { AdminLibraryStats } from './components/admin/AdminLibraryStats.tsx';
import { AdminVideoStats } from './components/admin/AdminVideoStats.tsx';
import { AdminDashboard } from './components/admin/AdminDashboard.tsx';
import { AdminAutomationList } from './components/admin/AdminAutomationList.tsx';
import { AdminPreuserPromptList } from './components/admin/AdminPreuserPromptList.tsx';
import { AdminChatList } from './components/admin/AdminChatList.tsx';
import { AdminChatViewer } from './components/admin/AdminChatViewer.tsx';
import { AutomationConfigList } from './components/automation/AutomationConfigList.tsx';
import { NewAutomationConfigPage, EditAutomationConfigPage } from './components/automation/AutomationConfigPage.tsx';
import { BrandAssetsPage } from './components/branding/BrandAssets';
import { YouTubeSettingsPage } from './components/youtube/YouTubeSettings';
import { UserStatsProvider } from './contexts/userStats';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30000, // Consider data fresh for 30 seconds
      cacheTime: 5 * 60 * 1000, // Keep unused data in cache for 5 minutes
      refetchOnWindowFocus: false // Disable refetching on window focus unless needed
    }
  }
});

const router = createBrowserRouter([
  {
    path: '/login',
    element: <Login />
  },
  {
    path: '/login/password',
    element: <PasswordSignIn />
  },

  {
    path: '/unsubscribe',
    element: <Unsubscribe />
  },
  {
    path: '/preuser-prompt',
    element: <PreUserPrompt />
  },
  // All existing dashboard routes
  {
    path: '/',
    element: (
      <WithAuth>
        <ProtectedRoute>
          <Layout />
        </ProtectedRoute>
      </WithAuth>
    ),
    children: [
      {
        index: true,
        element: <Navigate to="/videos" replace />
      },

      {
        path: 'library/add',
        element: <AddToLibrary />
      },
      {
        path: 'library/processing',
        element: <LibraryProcessing />
      },
      {
        path: 'libraries',
        element: <LibraryList />
      },
      {
        path: 'videos',
        element: <VideoListPage />
      },
      {
        path: 'videos/:id',
        element: <VideoPage />
      },
      {
        path: 'upload',
        element: <Upload />
      },
      {
        path: 'upload-progress/:eventId',
        element: <UploadProgress />
      },
      {
        path: 'upload-list',
        element: <UploadListPage />
      },

      {
        path: 'export-progress/:eventId',
        element: <ExportProgress />
      },
      {
        path: 'exports/:id',
        element: <ExportDetailsPage />
      },
      {
        path: 'libraries/:id',
        element: <LibraryDetails />
      },
      {
        path: 'libraries/:id/add',
        element: <AddToLibrary />
      },
      {
        path: 'libraries/:id/heuristic',
        element: <LibraryHeuristicComparison />
      },
      {
        path: 'libraries/:id/duplicates',
        element: <LibraryDuplicateDetection />
      },
      {
        path: 'highlight/:id/:highlightId',
        element: <HighlightPage />
      },

      {
        path: 'highlights',
        element: <HighlightListPage />
      },
      {
        path: 'automation-configs',
        element: (
          <ProtectedRoute>
            <AutomationConfigList />
          </ProtectedRoute>
        )
      },
      {
        path: 'brand-assets',
        element: (
          <ProtectedRoute>
            <BrandAssetsPage />
          </ProtectedRoute>
        )
      },
      {
        path: 'youtube',
        element: (
          <ProtectedRoute>
            <YouTubeSettingsPage />
          </ProtectedRoute>
        )
      },
      {
        path: 'automation-configs/new',
        element: (
          <ProtectedRoute>
            <NewAutomationConfigPage />
          </ProtectedRoute>
        )
      },
      {
        path: 'automation-configs/:id/edit',
        element: (
          <ProtectedRoute>
            <EditAutomationConfigPage />
          </ProtectedRoute>
        )
      },
      ...(import.meta.env.VITE_ENABLE_ADMIN === 'true'
        ? [
          {
            path: 'admin',
            element: <AdminDashboard />
          },
          {
            path: 'admin/dashboard',
            element: <AdminDashboard />
          },
          {
            path: 'admin/videos',
            element: <AdminVideoList />
          },
          {
            path: 'admin/surveys',
            element: <AdminSurveyList />
          },
          {
            path: 'admin/exports',
            element: <AdminExportStats />
          },
          {
            path: 'admin/library-stats',
            element: <AdminLibraryStats />
          },
          {
            path: 'admin/video-stats',
            element: <AdminVideoStats />
          },
          {
            path: 'admin/libraries',
            element: <AdminLibraryList />
          },
          {
            path: 'admin/automations',
            element: <AdminAutomationList />
          },
          {
            path: 'admin/preuser-prompts',
            element: <AdminPreuserPromptList />
          },
          {
            path: 'admin/chats',
            element: <AdminChatList />
          },
          {
            path: 'admin/chats/:chatId',
            element: <AdminChatViewer />
          }
        ]
        : [])
    ]
  }
]);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <ChakraProvider theme={mainTheme}>
      <AuthProvider>
        <QueryClientProvider client={queryClient}>
          <UserStatsProvider>
            <RouterProvider router={router} />
          </UserStatsProvider>
        </QueryClientProvider>
      </AuthProvider>
    </ChakraProvider>
  </ErrorBoundary>
);
