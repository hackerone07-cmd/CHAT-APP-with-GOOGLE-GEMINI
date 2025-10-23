import React from 'react'
import { Route, BrowserRouter, Routes } from 'react-router-dom'
import Login from '../Screens/Login'
import Home from '../Screens/Home'
import Register from '../Screens/Register'
import Project from '../Screens/Project'
const AppRoute = () => {
  return (
    <BrowserRouter>
    <Routes>
        <Route path='/' element={<Home/>} />
        <Route path='/login' element={<Login/>} />
        <Route path='/register' element={<Register/>} />
        <Route path='/project' element={<Project/>} />
    </Routes>
    </BrowserRouter>    
  )
}

export default AppRoute
