import { Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { ProtectedRoute } from './components/ProtectedRoute'
import { LoginPage } from './pages/LoginPage'
import { SignupPage } from './pages/SignupPage'
import { ResetPasswordPage } from './pages/ResetPasswordPage'
import { DashboardPage } from './pages/DashboardPage'
import { ChatPage } from './pages/ChatPage'
import { FleetPage } from './pages/FleetPage'
import { NewMachinePage } from './pages/NewMachinePage'
import { MachineDetailPage } from './pages/MachineDetailPage'
import { ModeStubPage } from './pages/ModeStubPage'
import { RepairChatPage } from './pages/RepairChatPage'
import { ServiceLogPage } from './pages/ServiceLogPage'
import { PrivacyPage } from './pages/PrivacyPage'
import { SupportPage } from './pages/SupportPage'
import { AccountPage } from './pages/AccountPage'
import { PricingPage } from './pages/PricingPage'

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/privacy" element={<PrivacyPage />} />
      <Route path="/support" element={<SupportPage />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<Layout />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/chat" element={<ChatPage />} />
          <Route path="/account" element={<AccountPage />} />
          <Route path="/pricing" element={<PricingPage />} />
          <Route path="/machines" element={<FleetPage />} />
          <Route path="/machines/new" element={<NewMachinePage />} />
          <Route path="/machines/:id" element={<MachineDetailPage />} />
          <Route path="/machines/:id/repair" element={<RepairChatPage />} />
          <Route path="/machines/:id/log" element={<ServiceLogPage />} />
          <Route path="/machines/:id/:mode" element={<ModeStubPage />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
