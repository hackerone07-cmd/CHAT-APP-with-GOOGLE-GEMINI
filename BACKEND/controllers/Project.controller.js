import * as projectService from "../services/Project.service.js";
import userModel from "../models/user.model.js";

export const createProject = async (req, res) => {
  try {
    const { name } = req.body;
    const loggedInUser = await userModel.findOne({ email: req.user.email });
    const userId = loggedInUser._id;

    const newProject = await projectService.createProject({ name, userId });

    res.status(201).json(newProject);
  } catch (error) {
    console.log(error);
    res.status(400).send(error.message);
  }
};

export const getAllProject = async (req, res) => {
  try {
    const loggedInUser = await userModel.findOne({ email: req.user.email });

    const allUsersProject = await projectService.getAllProjectByUserId({
      userId: loggedInUser._id,
    });

    res.status(201).json({
      projects: allUsersProject,
    });
  } catch (error) {
    console.log(error);
    res.status(400).send(error.message);
  }
};

export const addUserProject = async (req, res) => {
  try {
    const { projectId, users } = req.body;
    const loggedInUser = await userModel.findOne({
      email: req.user.email,
    });

    const project = await projectService.addUserToProject({
      projectId,
      users,
      userId: loggedInUser._id,
    });

    return res.status(200).json({
      project,
    });
  } catch (error) {
    console.log(error);
    res.status(400).send(error.message);
  }
};

export const getProjectById = async (req, res) => {
  const { projectId } = req.params;
  try {
    const project = await projectService.getProjectByIdIn({ projectId });
    return res.status(200).json({
      project,
    });
  } catch (err) {
    console.log(err);
    res.status(400).send({ error: err.message });
  }
};
