import React, { useEffect, useState, useContext, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import ReactDOM from 'react-dom'
import axios from "../Config/axios.config.js"
import { initializeSocket, receiveMessage, sendMessage } from "../Config/socket.config.js"
import { UserContext } from '../Context/user.context'
import Markdown from 'markdown-to-jsx';  // Add this import

const Project = () => {
  const location = useLocation()
  const projectId = location.state?.project?._id ?? location.state?.projectId

  const [isSidePanelOpen, setIsSidePanelOpen] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [users, setUsers] = useState([]) // all users
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [message, setMessage] = useState("");
  const {user} = useContext(UserContext);
  const messageBox = useRef(null)
  // project object (set from /projects/get-project/...)
  // Removed unused project state

  // NEW: messages state (rendered declaratively instead of DOM-manipulation)
  const [messages, setMessages] = useState([])

  // store selected user ids (string) using Set for toggling
  const [selectedUserIds, setSelectedUserIds] = useState(new Set())

  // read current logged-in user from localStorage (quick sync fallback)
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('user')) ?? null
    } catch {
      return null
    }
  })

  // helper to get stable string id from various user shapes
  const getIdFromUser = (u) => String(u?._id ?? u?.id ?? u?.email ?? u?.user_unique_id ?? u?.web_id ?? u ?? '')

  const myEmail = user?.email || currentUser?.email || 'You'

  // Removed unused project fetching functionality

  function sendMessageHandler(){
    if (!message?.trim()) return
    const payload = {
      message: message.trim(),
      sender: myEmail,
      timestamp: new Date().toISOString()
    }

    // send payload object
    sendMessage('project-message', payload)

    // update messages state (creates a new message div in the messages list)
    setMessages(prev => [...prev, { ...payload, direction: 'outgoing', id: Date.now() }])
    setMessage("")
  }
   

  useEffect(() => {
    // initialize socket (may be a no-op if socket already exists)
    const socket = initializeSocket(projectId)

    // handler should accept the data object
    const onProjectMessage = (data) => {
      console.log("New project message received:", data);
      // add incoming message to state (renders on left)
      setMessages(prev => [...prev, { ...data, direction: 'incoming', id: Date.now() }])
    }

    // register listener via helper
    receiveMessage('project-message', onProjectMessage);

    let mounted = true
    setLoading(true)

    // fetch all users list
    const usersReq = axios.get('/users/all').then((res) => {
      const payload = res?.data?.users ?? res?.data ?? []
      return Array.isArray(payload) ? payload : []
    })

    // fetch project details
    const projectReq = projectId
      ? axios
          .get(`/projects/get-project/${projectId}`)
          .then((res) => res?.data?.project ?? res?.data ?? null)
          .catch(() => null)
      : Promise.resolve(null)

    Promise.all([usersReq, projectReq])
      .then(([allUsers, proj]) => {
        if (!mounted) return
        setUsers(allUsers)

        if (proj) {
          // Set current user as initial selection
          if (currentUser) {
            const myId = getIdFromUser(currentUser)
            if (myId) setSelectedUserIds(new Set([myId]))
          } else {
            setSelectedUserIds(new Set())
          }
        }

        setError(null)
      })
      .catch((err) => {
        console.error(err)
        if (!mounted) return
        setUsers([])
        setSelectedUserIds(new Set())
        setError('Failed to load data')
      })
      .finally(() => {
        if (mounted) setLoading(false)
      })

    return () => {
      mounted = false
      // cleanup listener; don't forcibly disconnect global socket here
      try {
        if (socket && typeof socket.off === 'function') {
          socket.off('project-message', onProjectMessage)
        }
      } catch {
        // ignore cleanup errors
      }
    }
  }, [projectId, currentUser])

  // scroll to bottom when messages array changes
  useEffect(() => {
    const box = messageBox.current
    if (box) {
      // small timeout to allow DOM render
      requestAnimationFrame(() => {
        box.scrollTop = box.scrollHeight
      })
    }
  }, [messages])

  const toggleSelection = (id) => {
    setSelectedUserIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }



  return (
    <div className="bg-gray-100 h-screen flex">
      {/* Left Panel */}
      <div className="w-[25rem] bg-blue-100 relative flex flex-col justify-between p-4">
        {/* Side Panel */}
        <div
          className={`bg-red-500 flex flex-col gap-2 absolute h-full w-full left-0 top-0 transition-transform ${
            isSidePanelOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <header className="flex justify-end p-4 px-6 bg-slate-300">
            <button className="cursor-pointer text-3xl" onClick={() => setIsSidePanelOpen(false)}>
              <i className="ri-close-fill"></i>
            </button>
          </header>

          <div className="users flex flex-col gap-2 p-4 overflow-auto text-white">
            {loading ? (
              <p className="text-center">Loading users...</p>
            ) : error ? (
              <p className="text-center text-red-300">{error}</p>
            ) : users.length > 0 ? (
              users.map((u) => {
                const id = getIdFromUser(u)
                const email = u?.email ?? ''
                const active = selectedUserIds.has(id)
                return (
                  <div
                    key={id || email}
                    className={`user flex items-center gap-2 p-4 rounded-md cursor-pointer ${
                      active ? 'bg-blue-600 text-white' : 'hover:bg-gray-400'
                    }`}
                    onClick={() => toggleSelection(id)}
                  >
                    <div className="w-fit h-fit flex justify-center items-center rounded-full p-5 bg-gray-50 text-black">
                      <i className="ri-user-fill"></i>
                    </div>
                    <h1 className="w-full font-semibold text-lg">{email || 'unknown'}</h1>
                    {active && <span className="ml-2 text-xl">✓</span>}
                  </div>
                )
              })
            ) : (
              <p className="text-center">No users found</p>
            )}
          </div>
        </div>

        {/* Header */}
        <div className="flex items-center space-x-2 border-b px-1 py-2 mb-4">
          <button className="flex gap-2 items-center px-2 py-1 bg-white rounded-md shadow-sm" onClick={() => setIsModalOpen(true)}>
            <i className="ri-add-fill"></i>
            <p>Add Collaborators</p>
          </button>

          <div className="w-8 h-8 bg-blue-300 rounded-full flex items-center justify-center ml-auto text-white text-xl">
            <button className="cursor-pointer" onClick={() => setIsSidePanelOpen(!isSidePanelOpen)}>
              <i className="ri-user-line"></i>
            </button>
          </div>
        </div>

        {/* Message Area */}
        <div className="flex-1 flex flex-col gap-4 overflow-hidden">
          {/* Messages container */}
          <div
            ref={messageBox}
            id='message-box'
            className="flex-1 overflow-y-auto overflow-x-hidden p-4 flex flex-col scroll-smooth gap-3 no-scrollbar"
            style={{ 
              scrollbarWidth: 'none',  // Firefox
              msOverflowStyle: 'none'  // IE/Edge
            }}
            aria-live="polite"
          >
              {messages.length === 0 ? (
              <div className="text-center text-sm text-gray-500">No messages yet</div>
            ) : (
              messages.map((m) => {
                const isOutgoing = (m.direction === 'outgoing') || (m.sender === myEmail)
                const isAI = m.sender === "AI Assistant"
                return (
                  <div
                    key={m.id}
                    className={`${isAI ? 'max-w-[95%]' : 'max-w-[70%]'} w-auto break-words p-2 rounded-lg border-none shadow-sm ${
                      isOutgoing
                        ? 'self-end bg-blue-600 text-white'
                        : 'self-start bg-white border'
                    }`}
                    role="article"
                    aria-label={`${isOutgoing ? 'Sent' : 'Received'} message`}
                  >
                    <div className="text-[9px] font-semibold mb-1">{ isOutgoing ? 'You' : (m.sender || 'Anonymous') }</div>
                    {/* Render AI responses as markdown, keep others plain text. Ensure wrapping to avoid horizontal scroll */}
                    {isAI ? (
                      <div className="text-sm max-h-auto overflow-auto whitespace-pre-wrap break-words prose prose-sm dark:prose-invert p-1 bg-transparent">
                        {(() => {
                          try {
                            // Try to parse as JSON and extract text
                            const jsonContent = JSON.parse(m.message);
                            return jsonContent.text || String(m.message);
                          } catch {
                            // If not JSON, return as is
                            return String(m.message);
                          }
                        })()}
                      </div>
                    ) : (
                      <div className="text-sm whitespace-pre-wrap break-words overflow-hidden max-w-full">{String(m.message)}</div>
                    )}
                    <div className="text-[8px] text-gray-400 mt-1 text-right">{ new Date(m.timestamp || Date.now()).toLocaleTimeString() }</div>
                  </div>
                )
              })
            )}
          </div>

          {/* Input area */}
          <div className="mt-4 flex items-center bg-white rounded-full px-3 py-2 shadow-sm">
            <input
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') sendMessageHandler() }}
              type="text"
              placeholder="Enter message"
              className="flex-1 outline-none text-sm text-gray-700 bg-transparent"
            />
            <button onClick={sendMessageHandler} className="text-blue-500 text-xl ml-2" aria-label="Send message">
              <i className="ri-send-plane-2-fill"></i>
            </button>
          </div>
        </div>

        {/* Modal */}
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50" onClick={() => setIsModalOpen(false)} />

            <div role="dialog" aria-modal="true" className="relative bg-white rounded-lg w-full max-w-2xl mx-auto shadow-lg overflow-hidden">
              <header className="flex justify-between items-center p-4 border-b">
                <h3 className="text-lg font-semibold">Select collaborator(s)</h3>
                <button className="text-2xl leading-none p-2 rounded-md hover:bg-gray-100" onClick={() => setIsModalOpen(false)} aria-label="Close modal">
                  <i className="ri-close-line"></i>
                </button>
              </header>

              <div className="p-4 max-h-[60vh] overflow-auto">
                <div className="flex flex-col gap-2">
                  {loading ? (
                    <p className="text-center">Loading...</p>
                  ) : users.length > 0 ? (
                    users.map((u) => {
                      const id = getIdFromUser(u)
                      const email = u?.email ?? ''
                      const active = selectedUserIds.has(id)
                      return (
                        <button
                          key={id || email}
                          onClick={() => toggleSelection(id)}
                          className={`w-full text-left p-3 rounded-lg flex items-center gap-3 hover:bg-gray-50 transition ${active ? 'bg-blue-50 ring-2 ring-blue-200' : 'bg-white'}`}
                          aria-pressed={active}
                        >
                          <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-sm font-medium">
                            {(email?.charAt(0) ?? '?').toUpperCase()}
                          </div>
                          <div className="flex-1">
                            <div className="font-medium">{email || u.name || id}</div>
                            {u.name && <div className="text-sm text-gray-500">{u.name}</div>}
                          </div>
                          {active && (
                            <div className="text-blue-600 text-xl">
                              <i className="ri-checkbox-circle-fill"></i>
                            </div>
                          )}
                        </button>
                      )
                    })
                  ) : (
                    <p className="text-center text-gray-500">No users found</p>
                  )}
                </div>
              </div>

              <footer className="flex justify-end items-center gap-2 p-4 border-t">
                <button className="px-4 py-2 rounded-md bg-gray-100" onClick={() => setIsModalOpen(false)}>
                  Close
                </button>
              </footer>
            </div>
          </div>
        )}
      </div>

      {/* Right Panel - Code Display Area */}
      <div className="w-2/3 bg-white p-6 flex flex-col h-full">
        <h2 className="text-lg font-semibold mb-4">AI Generated Code</h2>
        <div className="flex-1 overflow-y-auto">
          {messages.filter(m => m.sender === "AI Assistant").map((m) => {
            try {
              const content = m.message;
              if (content.code) {
                return (
                  <div key={m.id} className="mb-6 bg-gray-50 rounded-lg p-4">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium text-gray-700">
                        {content.language || 'Code'}
                      </span>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(content.code);
                        }}
                        className="text-blue-600 hover:text-blue-700 text-sm"
                      >
                        Copy Code
                      </button>
                    </div>
                    <pre className="overflow-x-auto p-4 bg-gray-800 rounded text-gray-100 text-sm">
                      <code>{content.code}</code>
                    </pre>
                    {content.explanation && (
                      <div className="mt-2 text-sm text-gray-600">
                        {content.explanation}
                      </div>
                    )}
                  </div>
                );
              }
            } catch {
              // Not a code message, skip
              return null;
            }
            return null;
          })}
        </div>
      </div>
    </div>
  )
}

export default Project
