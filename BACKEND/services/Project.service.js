import mongoose from "mongoose";
import ProjectModel from "../models/Project.model.js";

export const createProject = async ({ name, userId }) => {
  if (!name) {
    throw new Error("name is required");
  }

  if (!userId) {
    throw new Error("userId is required");
  }

  let project;
  try {
    project = await ProjectModel.create({
      name,
      users: [userId],
    });
  } catch (error) {
    if (error.code == 11000) {
      throw new Error("Project name already exist!");
    }
    throw error;
  }

  return project;
};

export const getAllProjectByUserId = async({userId})=>{
    if(!userId){
      throw new Error('UserId is required');

    }
    const allUsersProject = await ProjectModel.find({
      users: userId
    })
     return allUsersProject;
}

export const  addUserToProject= async({projectId , users, userId})=>{
    if(!projectId){
      throw new Error("projectId is required")
    }
    if(!mongoose.Types.ObjectId.isValid(projectId)){
      throw new Error("Invalid projectId")
    }
    if(!users){
      throw new Error("users are required")
    }
    if(!Array.isArray(users) || users.some(userId=> !mongoose.Types.ObjectId.isValid(userId))){
      throw new Error("Invalid userId's in users Array")
    }
    if(!userId){
      throw new Error("userId are required")
    }
    if(!mongoose.Types.ObjectId.isValid(userId)){
      throw new Error("Invalid userId")
    }
    const project = await ProjectModel.findOne({
      _id: projectId,
      users: userId
    })

    if(!project){
      throw new Error('user not belong to this Project')
    }

    const updatedProject = await ProjectModel.findOneAndUpdate({
      _id: projectId
    }, {
      $addToSet:{
        users:{
            $each: users
        }
      }
    },{
        new: true 

    })
    return updatedProject

}

export const getProjectByIdIn = async({projectId})=>{
        if(!projectId){
          throw new Error("project id is required")
        }
        if(!mongoose.Types.ObjectId.isValid(projectId)){
          throw new Error("Invalid Credentials")
        }
        const project = await ProjectModel.findOne({
          _id:projectId
        }).populate('users')
        return project
}  