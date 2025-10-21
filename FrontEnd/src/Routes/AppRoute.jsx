import React from 'react'
import { Route, BrowserRouter, Routes } from 'react-router-dom'
import Login from '../Screens/Login'
import Home from '../Screens/Home'
import Register from '../Screens/Register'
const AppRoute = () => {
  return (
    <BrowserRouter>
    <Routes>
        <Route path='/' element={<Home/>} />
        <Route path='/login' element={<Login/>} />
        <Route path='/register' element={<Register/>} />
    </Routes>
    </BrowserRouter>    
  )
}

export default AppRoute
