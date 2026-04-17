import { useEffect, useState } from 'react'
import Dashboard from './screens/Dashboard'
import CreateReminder from './screens/CreateReminder'
import ReminderDetail from './screens/ReminderDetail'
import { applyTelegramTheme } from './utils/telegram'

function App() {
  const [screen, setScreen] = useState('dashboard')
  const [selectedReminderId, setSelectedReminderId] = useState(null)
  const [editReminderId, setEditReminderId] = useState(null)

  useEffect(() => {
    applyTelegramTheme()
  }, [])

  const goToDashboard = () => {
    setScreen('dashboard')
  }

  const goToCreate = () => {
    setEditReminderId(null)
    setScreen('create')
  }

  const goToDetail = (reminderId) => {
    setSelectedReminderId(reminderId)
    setScreen('detail')
  }

  const goToEdit = (reminderId) => {
    setEditReminderId(reminderId)
    setScreen('create')
  }

  if (screen === 'create') {
    return (
      <CreateReminder
        onNavigateDashboard={goToDashboard}
        editReminderId={editReminderId}
      />
    )
  }

  if (screen === 'detail') {
    return (
      <ReminderDetail
        reminderId={selectedReminderId}
        onNavigateDashboard={goToDashboard}
        onNavigateEdit={goToEdit}
      />
    )
  }

  return (
    <Dashboard
      onOpenCreate={goToCreate}
      onOpenDetail={goToDetail}
      activeTab={screen}
      onNavigate={goToDashboard}
    />
  )
}

export default App
