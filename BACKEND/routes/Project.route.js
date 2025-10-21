import { Router } from "express";
import { body } from "express-validator";
import * as projectController from "../controllers/Project.controller.js"
import * as authMiddleware from "../middlewares/auth.middleware.js"
import { validate } from "../middlewares/validate.middleware.js";

const router = Router();

router.post('/create',
    authMiddleware.authUser,
    body('name').isString().withMessage('Name is Required'),
    projectController.createProject
)

router.get("/all",
    validate,
    authMiddleware.authUser,
    projectController.getAllProject
)

router.put('/add-user',
    validate,
    authMiddleware.authUser,
    body('projectId').isString().withMessage("'project ID is required"),
    body('users').isArray({min: 1}).withMessage("user must be an array of string")
    .custom((users)=>users.every(user=> typeof user ==='string' )).withMessage("Each user must be a string"),
    projectController.addUserProject
)

router.get("/get-project/:projectId",
    authMiddleware.authUser,
    projectController.getProjectById
)


export default router;