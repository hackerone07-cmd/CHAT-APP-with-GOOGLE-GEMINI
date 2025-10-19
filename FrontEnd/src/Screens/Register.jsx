import { Link, useNavigate } from 'react-router-dom'
import axios from '../Config/Axios.config'
import { useState } from 'react'
function Register() {

  const navigate = useNavigate()

  const [email,setEmail] = useState('')
  const [password,setPassword] =useState('')



  function sumbitHandler(e) {
    e.preventDefault()

    axios.post('/users/register',{
      email,
      password
    }).then((res)=>{
      console.log(res.data)
      navigate("/")
    }).catch((err)=>{
      console.log(err.response.data);
    })
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900">
      <div className="bg-gray-800 p-8 rounded-lg shadow-lg w-full max-w-md">
        <h2 className="text-2xl font-bold mb-6 text-center">Sign Up</h2>
        <form onSubmit={sumbitHandler} className="space-y-4">
          <input
          onChange={(e)=>setEmail(e.target.value)}
            type="email"
            placeholder="Email"
            className="w-full px-4 py-2 bg-gray-700 text-white rounded focus:outline-none focus:ring-2 focus:ring-green-500"
          />
          <input
          onChange={(e)=>setPassword(e.target.value)}
            type="password"
            placeholder="Password"
            className="w-full px-4 py-2 bg-gray-700 text-white rounded focus:outline-none focus:ring-2 focus:ring-green-500"
          />
          <button
            type="submit"
            className="w-full bg-green-600 hover:bg-green-700 text-white py-2 rounded"
          >
            Create Account
          </button>
        </form>
        <p className="mt-4 text-center text-sm">
          Already have an account?{' '}
          <Link to="/users/login" className="text-green-400 hover:underline">
            Login
          </Link>
        </p>
      </div>
    </div>
  )
}

export default Register