import React,{ createContext, useState, useContext, Children} from "react";

const UserContext = createContext();

export const UserProvider = ({children})=>{
    const [user, setUser] = useState(null);
    return (
        <useContext.Provider value={{user,setUser}}>
            {children}
        </useContext.Provider>
    )
}

export const useUser =()=>{
    return useContext(UserContext)
}