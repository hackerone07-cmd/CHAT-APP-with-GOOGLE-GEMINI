import mongoose from "mongoose";

const projectSchema = new mongoose.Schema({
    name:{
        type:String,
        lowercase: true,
        unique: true,
        require:true,
        trim: true,
    },

    users: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        }
    ]
})

const Project = mongoose.model('project',projectSchema);

export default Project;