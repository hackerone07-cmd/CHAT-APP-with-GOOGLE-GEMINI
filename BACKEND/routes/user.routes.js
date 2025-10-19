import { Router } from "express";
import { body, validationResult } from "express-validator";
import * as userController from "../controllers/user.controller.js";
import * as authMiddleware from "../middlewares/auth.middleware.js";
const router = Router();

// Middleware to handle validation results
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// Register route
router.post(
  "/register",
  [
    body("email").isEmail().withMessage("Email must be a valid email address"),
    body("password")
      .isLength({ min: 3 })
      .withMessage("Password must be at least 3 characters long"),
  ],
  validate, 
  userController.createUserController
);

// Login route
router.post(
  "/login",
  [
    body("email").isEmail().withMessage("Email must be a valid email address"),
    body("password")
      .isLength({ min: 3 })
      .withMessage("Password must be at least 3 characters long"),
  ],
  validate, 
  userController.loginUserController
);

//get profile
router.get('/profile',authMiddleware.authUser,userController.getProfileController);

//logout
router.get('/logout',authMiddleware.authUser,userController.logoutController);  


export default router;













    