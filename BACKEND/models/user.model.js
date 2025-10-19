import mongoose from "mongoose";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
    minLength: [6, "Email must be at least 6 characters long"],
    maxLength: [50, "Email must be at most 50 characters long"],
  },
  password: {
    type: String,
    required: [true, "Password is required"],
    select: false,
  },
});

// Automatically hash password before saving
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

// Validate password
userSchema.methods.isValidPassword = async function (password) {
  return await bcrypt.compare(password, this.password);
};

// Generate JWT
userSchema.methods.generateJWT = function () {
  return jwt.sign(
    { email: this.email},
    process.env.JWT_SECRET,
    {expiresIn: '24h'}
    
  );
};

const User = mongoose.model("User", userSchema);
export default User;
