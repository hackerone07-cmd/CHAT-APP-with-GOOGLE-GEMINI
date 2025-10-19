import User from "../models/user.model.js";
import * as userService from "../services/user.service.js";
import redisClient from "../services/redis.service.js";


export const createUserController = async (req, res) => {
  try {
    const user = await userService.createUser(req.body);
    const token = await user.generateJWT();
    res.status(201).json({ user, token });
  } catch (error) {
    console.error("Create User Error:", error);
    res.status(400).json({ error: error.message });
  }
};

export const loginUserController = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email }).select("+password");
    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const isMatch = await user.isValidPassword(password);
    if (!isMatch) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const token = await user.generateJWT();
console.log(token);
    res.status(200).json({ user, token });
  } catch (error) {
    console.error("Login Error:", error);
    res.status(400).json({ error: error.message });
  }
};

export const getProfileController = async (req,res)=>{
   
   res.status(200).json({
    user: req.user
   })
}

export const logoutController = async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const token = req.cookies?.token || (authHeader?.startsWith('bearer ') ? authHeader.split(' ')[1] : null);

    if (!token) {
      return res.status(400).json({ error: 'No token provided' });
    }

    // Invalidate token in Redis for 24 hours
    await redisClient.set(token, 'logout', 'EX', 60 * 60 * 24);

    return res.status(200).json({ message: 'Logout successful' });
  } catch (error) {
    console.error('Logout error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
