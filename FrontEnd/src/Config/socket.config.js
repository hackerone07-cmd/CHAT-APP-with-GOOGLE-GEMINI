import socket from "socket.io-client";

let socketInstance = null;

export const initializeSocket = (projectId) => {
  if (!socketInstance) {
    socketInstance = socket(import.meta.env.VITE_API_URL, {
      auth: {
        token: localStorage.getItem("token")
      },
      query: {
        projectId
      },
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000
    });
  }
  return socketInstance;
};

export const receiveMessage = (eventName,data) => {
    socketInstance.on(eventName,data);
}

export const sendMessage = (eventName, data) => {
    socketInstance.emit(eventName, data);
}
// export const getSocket = () => socketInstance;

// export const disconnectSocket = () => {
//   if (socketInstance) {
//     socketInstance.disconnect();
//     socketInstance = null;
//   }
// };
