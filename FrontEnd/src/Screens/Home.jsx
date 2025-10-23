import React, { useContext, useEffect, useState } from "react";
import { UserContext } from "../Context/user.context";
import axios from "../Config/axios.config"
import {useNavigate} from "react-router-dom"

const Home = () => {
  const { user } = useContext(UserContext);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [projectName, setProjectName] = useState(null);
  const [project,setProject] = useState([]);
  
  const navigate = useNavigate()

function createProject(e) {
  e.preventDefault();

  if (!projectName?.trim()) return;

  axios.post("/projects/create", {
    name: projectName,
  })
  .then((res) => {
    console.log(res);
    // Fetch updated project list after creation
    axios.get('/projects/all')
      .then((res) => setProject(res.data.projects))
      .catch((err) => console.error('Error refreshing projects:', err));
    setIsModalOpen(false);
    setProjectName("");
  })
  .catch((err) => {
    console.error('Error creating project:', err);
  });
}

useEffect(() => {
  const fetchProjects = async () => {
    try {
      const response = await axios.get('/projects/all');
      setProject(response.data.projects);
    } catch (error) {
      console.error('Error fetching projects:', error);
    }
  };

  fetchProjects();

  // Set up polling to refresh projects every 30 seconds
  const intervalId = setInterval(fetchProjects, 30000);

  // Cleanup interval on component unmount
  return () => clearInterval(intervalId);
}, []); // Empty dependency array to run only on mount

  return (
    <main className="p-4">
      <div className="projects flex flex-wrap gap-3">
        <button
          onClick={() => setIsModalOpen(true)}
          className="project border cursor-pointer text-2xl border-slate-300 rounded-md p-4"
        >
          New Project
          <i className="ri-link ml-2"></i>
        </button>
        {
          project.map((project)=>(
            <div onClick={()=> {navigate(`/project`,{
                     state:{project}
            })
            }} key={project._id} className="project border min-w-52 hover:bg-emerald-300 flex flex-col gap-2 cursor-pointer text-2xl border-slate-300 rounded-md p-4">
             <h2 className="font-semibold"> {project.name }</h2>
              

               <div className="flex gap-2">
                <p><i className="ri-user-line"></i><small> Collaborators:</small></p>
                 {project.users.length}
               </div>
               </div>
               
          ))
        }

        
        
      </div>
      
      {isModalOpen && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white p-6 rounded-md w-1/3">
            <h2 className="text-xl font-semibold mb-4 text-gray-800">
              Create New Project
            </h2>
            <form onSubmit={createProject}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700">
                  Project Name
                </label>
                <input
                  onChange={(e) => setProjectName(e.target.value)}
                  value={projectName}
                  type="text"
                  className="mt-1 block w-full p-2 border border-gray-300 rounded-md"
                  required
                />
              </div>
              <div className="flex justify-end">
                <button
                  type="button"
                  className="mr-2 px-4 py-2 bg-gray-300 rounded-md"
                  onClick={() => setIsModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-md"
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
};

export default Home;
