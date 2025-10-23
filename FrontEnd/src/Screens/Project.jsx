import React, { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import axios from "../Config/axios.config"

const Project = () => {
  const location = useLocation()
  const projectId = location.state?.project?._id ?? location.state?.projectId

  const [isSidePanelOpen, setIsSidePanelOpen] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [users, setUsers] = useState([]) // all users
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // project object (set from /projects/get-project/...)
  const [project, setProject] = useState(null)

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

  // fetch latest project and normalize users -> full objects
  const fetchProject = async () => {
    if (!projectId) return
    try {
      const res = await axios.get(`/projects/get-project/${projectId}`)
      const proj = res?.data?.project ?? res?.data ?? null
      if (!proj) {
        setProject(null)
        setSelectedUserIds(new Set())
        return
      }
      const rawProjectUsers = proj?.users ?? proj?.collaborators ?? proj?.members ?? []
      const projectUsersFull = Array.isArray(rawProjectUsers)
        ? rawProjectUsers.map((pu) => {
            const idStr = getIdFromUser(pu)
            const matched = users.find((u) => getIdFromUser(u) === idStr)
            return matched ?? (typeof pu === 'object' ? pu : { _id: idStr })
          })
        : []
      setProject({ ...proj, users: projectUsersFull })
      setSelectedUserIds(new Set(projectUsersFull.map((u) => getIdFromUser(u))))
    } catch (err) {
      console.error('fetchProject error', err)
    }
  }

  // try to refresh current user from API (optional)
  useEffect(() => {
    axios
      .get('/auth/me')
      .then((res) => {
        const me = res?.data?.user ?? res?.data ?? null
        if (me) setCurrentUser(me)
      })
      .catch(() => {
        /* ignore if endpoint missing */
      })
  }, [])

  useEffect(() => {
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
          // normalize project.users (may be objectIds) to full user objects where possible
          const rawProjectUsers = proj?.users ?? proj?.collaborators ?? proj?.members ?? []
          const normalize = (v) => getIdFromUser(v)
          const projectUsersFull = Array.isArray(rawProjectUsers)
            ? rawProjectUsers.map((pu) => {
                const idStr = normalize(pu)
                const matched = allUsers.find((u) => getIdFromUser(u) === idStr)
                return matched ?? (typeof pu === 'object' ? pu : { _id: idStr })
              })
            : []

          // ensure currentUser is included
          const myId = currentUser ? getIdFromUser(currentUser) : null
          if (myId && !projectUsersFull.some((u) => getIdFromUser(u) === myId)) {
            const matched = allUsers.find((u) => getIdFromUser(u) === myId)
            projectUsersFull.unshift(matched ?? (currentUser && typeof currentUser === 'object' ? currentUser : { _id: myId }))
          }

          setProject({ ...proj, users: projectUsersFull })

          // initialize selectedUserIds from project users
          const collabIds = projectUsersFull.map((u) => getIdFromUser(u))
          setSelectedUserIds(new Set(collabIds))
        } else {
          // no project: still add current user if available to selection
          if (currentUser) {
            const myId = getIdFromUser(currentUser)
            if (myId) setSelectedUserIds(new Set([myId]))
          } else {
            setSelectedUserIds(new Set())
          }
          setProject(null)
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
    }
  }, [projectId, currentUser])

  const toggleSelection = (id) => {
    setSelectedUserIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function addCollaborators() {
    if (!projectId) {
      console.warn('No projectId to add collaborators')
      setIsModalOpen(false)
      return
    }

    try {
      // send only IDs (most backends expect ids); server will persist and return updated project
      const ids = Array.from(selectedUserIds)
      await axios.put('/projects/add-user', {
        projectId,
          users: ids
      })

      // re-fetch project to reflect server state (and normalize to full user objects)
      await fetchProject()
      setIsModalOpen(false)
    } catch (err) {
      console.error('addCollaborators error', err)
    }
  }

  // helpers to display selected collaborators (prefer project.users which now contains full objects)
  const selectedList = Array.from(selectedUserIds)
  const lookupUser = (id) => {
    const idStr = String(id)
    const fromProject = (project?.users ?? []).find((u) => getIdFromUser(u) === idStr)
    if (fromProject) return fromProject
    return users.find((u) => getIdFromUser(u) === idStr) ?? (currentUser && getIdFromUser(currentUser) === idStr ? currentUser : null)
  }

  const selectedDetails = selectedList.map((id) => {
    const u = lookupUser(id)
    return {
      id,
      label: u ? `${u.email ?? u.name ?? u._id ?? u.id}` : id,
      full: u
    }
  })

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
                    role="button"
                    tabIndex={0}
                    onClick={() => toggleSelection(id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') toggleSelection(id)
                    }}
                    aria-pressed={active}
                  >
                    <div className="w-fit h-fit flex justify-center items-center rounded-full p-5 bg-gray-50 text-black">
                      <i className="ri-user-fill"></i>
                    </div>
                    <h1 className="w-full font-semibold text-lg">{email || u.name || 'unknown'}</h1>
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
        <div className="flex-1 space-y-4 overflow-y-auto">
          <div className="bg-white p-3 w-72 rounded-lg shadow-sm">
            <h3 className="text-sm font-semibold">{project?.name ?? 'Project'}</h3>
            <p className="text-sm text-gray-700">Lorem ipsum dolor sit amet. Lorem ipsum dolor sit amet.</p>
          </div>
          <div className="bg-white p-3 ml-auto w-72 rounded-lg shadow-sm">
            <h3 className="text-sm font-semibold">{project?.name ?? 'Project'}</h3>
            <p className="text-sm text-gray-700">Lorem ipsum dolor sit amet.</p>
          </div>
        </div>

        {/* Message Input */}
        <div className="mt-4 flex items-center bg-white rounded-full px-3 py-2 shadow-sm">
          <input type="text" placeholder="Enter message" className="flex-1 outline-none text-sm text-gray-700 bg-transparent" />
          <button className="text-blue-500 text-xl">
            <i className="ri-send-plane-2-fill"></i>
          </button>
        </div>
      </div>

      {/* Right Panel */}
      <div className="w-2/3 bg-white p-6">
        <h2 className="text-lg font-semibold mb-4">Project Area</h2>
        <p className="text-sm text-gray-600 mb-4">
          Selected collaborator(s):
          <span className="font-medium ml-2">{selectedDetails.length ? selectedDetails.map((s) => s.label).join(', ') : 'none'}</span>
        </p>

        {/* show chips without remove button (no remove route) */}
        <div className="flex flex-wrap gap-2 mb-4">
          {selectedDetails.length ? (
            selectedDetails.map((s) => (
              <div key={s.id} className="flex items-center gap-2 bg-gray-100 px-3 py-1 rounded-full">
                <span className="text-sm">{s.label}</span>
              </div>
            ))
          ) : (
            <span className="text-sm text-gray-500">No collaborators</span>
          )}
        </div>

        <button className="px-4 py-2 bg-blue-600 text-white rounded-md" onClick={() => setIsModalOpen(true)}>
          Manage Collaborators
        </button>
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

            <footer className="flex justify-between items-center gap-2 p-4 border-t">
              <div className="text-sm text-gray-500">Selected: {selectedList.length}</div>
              <div>
                <button className="px-4 py-2 rounded-md bg-gray-100 mr-2" onClick={() => setIsModalOpen(false)}>
                  Cancel
                </button>
                <button className="px-4 py-2 bg-blue-600 text-white rounded-md" onClick={addCollaborators}>
                  Confirm
                </button>
              </div>
            </footer>
          </div>
        </div>
      )}
    </div>
  )
}

export default Project
