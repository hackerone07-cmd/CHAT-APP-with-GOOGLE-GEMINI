import React from 'react'
import AppRoute from './Routes/AppRoute'
import { UserProvider } from './Context/user.context'
const App = () => {
  return (
    <div>
      <UserProvider>
        <AppRoute/>
      </UserProvider>
     
    </div>
  )
}

export default App
