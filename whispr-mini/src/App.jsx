import { useState } from 'react'
import Dashboard from './screens/Dashboard'
import CreateReminder from './screens/CreateReminder'
import ReminderDetail from './screens/ReminderDetail'

function App() {
  const [screen, setScreen] = useState('dashboard')
  const [selectedReminderId, setSelectedReminderId] = useState(null)

  const goToDashboard = () => {
    setScreen('dashboard')
  }

  const goToCreate = () => {
    setScreen('create')
  }

  const goToDetail = (reminderId) => {
    setSelectedReminderId(reminderId)
    setScreen('detail')
  }

  if (screen === 'create') {
    return <CreateReminder onNavigateDashboard={goToDashboard} />
  }

  if (screen === 'detail') {
    return (
      <ReminderDetail
        reminderId={selectedReminderId}
        onNavigateDashboard={goToDashboard}
      />
    )
  }

  return (
    <Dashboard
      onOpenCreate={goToCreate}
      onOpenDetail={goToDetail}
    />
  )
}

export default App
