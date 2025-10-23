import React from 'react'
import { Route, BrowserRouter, Routes } from 'react-router-dom'
import Login from '../Screens/Login'
import Home from '../Screens/Home'
import Register from '../Screens/Register'
import Project from '../Screens/Project'
import UserAuth from '../Auth/UserAuth'
const AppRoute = () => {
  return (
    <BrowserRouter>
    <Routes>
        <Route path='/' element={<UserAuth><Home/></UserAuth>} />
        <Route path='/login' element={<Login/>} />
        <Route path='/register' element={<Register/>} />
        <Route path='/project' element={<UserAuth><Project/></UserAuth>} />
    </Routes>
    </BrowserRouter>    
  )
}

export default AppRoute
