import User from "../models/user.model.js";

export const createUser = async ({ email, password }) => {
  if (!email || !password) {
    throw new Error("Email and password are required");
  }

  const user = await User.create({ email, password });
  return user;
};

export const getAllUsers = async ({userId})=>{
    const users = await User.find({
      _id: {$ne: userId}
    });
    return users
}