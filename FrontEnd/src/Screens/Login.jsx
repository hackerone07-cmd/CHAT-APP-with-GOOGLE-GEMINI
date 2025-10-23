import { Link, useNavigate } from 'react-router-dom';
import axios from '../Config/axios.config';
import { useContext, useState } from 'react';
import {UserContext} from "../Context/user.context";

function Login() {

  const [email, setEmail] =useState('')
  const [password, setPassword] = useState('');

  const {setUser } = useContext(UserContext);

  const navigate = useNavigate()

  function sumbitHandler(e) {
    e.preventDefault()
       axios.post('/users/login',{
        email,
        password
       }).then((res) =>{
        console.log(res.data);

        localStorage.setItem('token', res.data.token);
        setUser(res.data.user); 
        navigate('/')
       }).catch((err)=>{
        console.log(err.response.data);
       })
  }

  return (

    <div className="min-h-screen flex items-center justify-center bg-gray-900">
      <div className="bg-gray-800 p-8 rounded-lg shadow-lg w-full max-w-md">
        <h2 className="text-2xl font-bold mb-6 text-center">Login</h2>
        <form onSubmit={sumbitHandler} className="space-y-4">
          <input
          onChange={(e)=>setEmail(e.target.value)}
            type="email"
            placeholder="Email"
            className="w-full px-4 py-2 bg-gray-700 text-white rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <input
           onChange={(e)=>setPassword(e.target.value)}
            type="password"
            placeholder="Password"
            className="w-full px-4 py-2 bg-gray-700 text-white rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded"
          >
            Login
          </button>
        </form>
        <p className="mt-4 text-center text-sm">
          Don’t have an account?{' '}
          <Link to="/register" className="text-blue-400 hover:underline">
            Create one
          </Link>
        </p>
      </div>
    </div>
  )
}

export default Login