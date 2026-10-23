import { HashRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from '@/components/Auth';
import { Layout } from '@/components/Layout';
import { RecordsProvider } from '@/components/RecordsContext';
import { SettingsProvider } from '@/components/SettingsContext';
import { ToastProvider } from '@/components/ui/Toast';
import Dashboard from '@/pages/Dashboard';
import ImportExportPage from '@/pages/ImportExportPage';
import NotFound from '@/pages/NotFound';
import RecordEditorPage from '@/pages/RecordEditorPage';
import RecordsPage from '@/pages/RecordsPage';
import ReportsPage from '@/pages/ReportsPage';
import SettingsPage from '@/pages/SettingsPage';

/**
 * The router uses hash based URLs on purpose: the application can then be hosted
 * on any static platform (GitHub Pages included) without a single server side
 * rewrite rule.
 */
export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <SettingsProvider>
          <RecordsProvider>
            <HashRouter>
              <Routes>
                {/* The report view owns its full page chrome so the preview can be printed as is. */}
                <Route path="/reports" element={<ReportsPage />} />
                <Route element={<Layout />}>
                  <Route index element={<Dashboard />} />
                  <Route path="records" element={<RecordsPage />} />
                  <Route path="records/new" element={<RecordEditorPage />} />
                  <Route path="records/:id/edit" element={<RecordEditorPage />} />
                  <Route path="data" element={<ImportExportPage />} />
                  <Route path="settings" element={<SettingsPage />} />
                  <Route path="*" element={<NotFound />} />
                </Route>
              </Routes>
            </HashRouter>
          </RecordsProvider>
        </SettingsProvider>
      </ToastProvider>
    </AuthProvider>
  );
}
