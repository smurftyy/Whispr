import { useEffect, useState } from 'react'
import Dashboard from './screens/Dashboard'
import CreateReminder from './screens/CreateReminder'
import ReminderDetail from './screens/ReminderDetail'
import Insights from './screens/Insights'
import SettingsPage from './screens/SettingsPage'
import ArchivePage from './screens/ArchivePage'
import { applyTelegramTheme } from './utils/telegram'

function App() {
  const [screen, setScreen] = useState('dashboard')
  const [selectedReminderId, setSelectedReminderId] = useState(null)
  const [editReminderId, setEditReminderId] = useState(null)
  const [detailReturnScreen, setDetailReturnScreen] = useState('dashboard')
  const [createReturnScreen, setCreateReturnScreen] = useState('dashboard')

  useEffect(() => {
    applyTelegramTheme()
  }, [])

  const navigateToScreen = (nextScreen = 'dashboard') => {
    setScreen(nextScreen)
  }

  const goToCreate = (returnScreen = 'dashboard') => {
    setEditReminderId(null)
    setCreateReturnScreen(returnScreen)
    setScreen('create')
  }

  const goToDetail = (reminderId, returnScreen = 'dashboard') => {
    setSelectedReminderId(reminderId)
    setDetailReturnScreen(returnScreen)
    setScreen('detail')
  }

  const goToEdit = (reminderId) => {
    setEditReminderId(reminderId)
    setCreateReturnScreen(detailReturnScreen)
    setScreen('create')
  }

  if (screen === 'create') {
    return (
      <CreateReminder
        onNavigateDashboard={() => navigateToScreen(createReturnScreen)}
        editReminderId={editReminderId}
      />
    )
  }

  if (screen === 'detail') {
    return (
      <ReminderDetail
        reminderId={selectedReminderId}
        onNavigateDashboard={() => navigateToScreen(detailReturnScreen)}
        onNavigateEdit={goToEdit}
      />
    )
  }

  if (screen === 'insights') {
    return (
      <Insights
        activeTab={screen}
        onNavigate={navigateToScreen}
        onOpenDetail={(reminderId) => goToDetail(reminderId, 'insights')}
      />
    )
  }

  if (screen === 'settings') {
    return (
      <SettingsPage
        activeTab={screen}
        onNavigate={navigateToScreen}
      />
    )
  }

  if (screen === 'archive') {
    return (
      <ArchivePage
        activeTab={screen}
        onNavigate={navigateToScreen}
        onOpenDetail={(reminderId) => goToDetail(reminderId, 'archive')}
      />
    )
  }

  return (
    <Dashboard
      onOpenCreate={() => goToCreate('dashboard')}
      onOpenDetail={(reminderId) => goToDetail(reminderId, 'dashboard')}
      activeTab={screen}
      onNavigate={navigateToScreen}
    />
  )
}

export default App
