// src/components/Project.jsx
import React, { useEffect, useState, useContext, useRef } from "react";
import { useLocation } from "react-router-dom";
import axios from "../Config/axios.config.js";
import {
  initializeSocket,
  receiveMessage,
  sendMessage,
} from "../Config/socket.config.js";
import { UserContext } from "../Context/user.context";
import hljs from "highlight.js";
import "highlight.js/styles/github-dark.css"; // change theme if you prefer
import { getWebcontainer } from "../Config/Webcontainer.js";
import Prism from "prismjs";



const Project = () => {
  const location = useLocation();
  const projectId = location.state?.project?._id ?? location.state?.projectId;

  const [isSidePanelOpen, setIsSidePanelOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);
  const [aiCodeBlocks, setAiCodeBlocks] = useState([]);
  const [selectedUserIds, setSelectedUserIds] = useState(new Set());
  const [activeFile, setActiveFile] = useState(null);
  const [userWebcontainer, setUserWebcontainer] = useState(null);
  const [iframeUrl, setIframeUrl] = useState(null);


  const { user } = useContext(UserContext);
  const messageBox = useRef(null);

//   useEffect(() => {
//   const savedCode = localStorage.getItem(`code-${activeFile.filename}`);
//   if (savedCode) {
//     setActiveFile((prev) => ({
//       ...prev,
//       code: savedCode,
//     }));
//   }
// }, [activeFile.filename]);

  const [currentUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("user")) ?? null;
    } catch {
      return null;
    }
  });


  useEffect(() => {
    Prism.highlightAll();
  }, [activeFile]);

  const getIdFromUser = (u) =>
    String(
      u?._id ?? u?.id ?? u?.email ?? u?.user_unique_id ?? u?.web_id ?? u ?? ""
    );

  const myEmail = user?.email || currentUser?.email || "You";

  // Ensure a block always has filename (for tree)
  const normalizeBlock = (block) => {
    const nb = { ...block };
    if (!nb.filename) {
      nb.filename = `snippet-${String(nb.id).replace(".", "-")}.${
        nb.language || "txt"
      }`;
    }
    if (!nb.language) nb.language = "plaintext";
    if (typeof nb.code !== "string") nb.code = String(nb.code ?? "");
    return nb;
  };

  const sendMessageHandler = () => {
    if (!message.trim()) return;

    const payload = {
      message: message.trim(),
      sender: myEmail,
      timestamp: new Date().toISOString(),
    };

    sendMessage("project-message", payload);
    setMessages((prev) => [
      ...prev,
      { ...payload, direction: "outgoing", id: Date.now() },
    ]);
    setMessage("");
  };

  useEffect(() => {
    const socket = initializeSocket(projectId);

    if (!userWebcontainer) {
      getWebcontainer().then((container) => setUserWebcontainer(container));
      console.log("container");
    }
    const onProjectMessage = (data) => {
      setMessages((prev) => [
        ...prev,
        { ...data, direction: "incoming", id: Date.now() },
      ]);

      userWebcontainer?.mount(message.FileTree);

      const raw = String(data?.message ?? "");
      const pushBlocks = (blocks) => {
        if (!blocks || blocks.length === 0) return;
        const normalized = blocks.map(normalizeBlock);
        setAiCodeBlocks((prev) => {
          const merged = [...prev, ...normalized];
          // If no active file, select the first appended file
          if (!activeFile && merged.length > 0) {
            setActiveFile(merged[0]);
          }
          return merged;
        });
      };

      let text = raw.trim();

      // unwrap simple wrapper fenced block
      const wrapperMatch = text.match(/^```(?:\w+)?\n([\s\S]*)```$/);
      if (wrapperMatch) text = wrapperMatch[1].trim();

      try {
        const parsed = JSON.parse(text);
        if (parsed?.fileTree) {
          const blocks = Object.entries(parsed.fileTree)
            .map(([filename, node]) => {
              const contents = node?.file?.contents;
              if (!contents) return null;
              const ext = filename.split(".").pop() || "text";
              return {
                id: Date.now() + Math.random(),
                filename,
                language: ext === "js" ? "javascript" : ext,
                code: contents.replace(/\\n/g, "\n").replace(/\\t/g, "\t"),
                explanation: "",
              };
            })
            .filter(Boolean);
          pushBlocks(blocks);
          return;
        }

        if (parsed?.code) {
          const fenceMatch = String(parsed.code).match(
            /```(\w+)?\n([\s\S]*?)```/
          );
          pushBlocks([
            {
              id: Date.now() + Math.random(),
              filename: parsed.filename || null,
              language: fenceMatch?.[1] || parsed.language || "plaintext",
              code: fenceMatch?.[2]?.trim() || parsed.code,
              explanation: parsed.explanation || "",
            },
          ]);
          return;
        }
      } catch (err) {
        // not JSON — continue to regex parse
      }

      // fallback: extract fenced code blocks (may not have filenames)
      const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
      const matches = [...text.matchAll(codeBlockRegex)];
      if (matches.length > 0) {
        const blocks = matches.map((m) => ({
          id: Date.now() + Math.random(),
          filename: null,
          language: m[1] || "plaintext",
          code: m[2].trim(),
          explanation: "",
        }));
        pushBlocks(blocks);
      }
    };

    receiveMessage("project-message", onProjectMessage);

    let mounted = true;
    setLoading(true);

    const usersReq = axios
      .get("/users/all")
      .then((res) => res.data?.users ?? []);
    const projectReq = projectId
      ? axios
          .get(`/projects/get-project/${projectId}`)
          .then((res) => res.data?.project ?? null)
          .catch(() => null)
      : Promise.resolve(null);

    Promise.all([usersReq, projectReq])
      .then(([allUsers, proj]) => {
        if (!mounted) return;
        setUsers(allUsers);
        if (proj && currentUser) {
          const myId = getIdFromUser(currentUser);
          if (myId) setSelectedUserIds(new Set([myId]));
        }
      })
      .catch(() => setError("Failed to load data"))
      .finally(() => mounted && setLoading(false));

    return () => {
      mounted = false;
      if (socket && typeof socket.off === "function")
        socket.off("project-message", onProjectMessage);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, currentUser]);

  useEffect(() => {
    const box = messageBox.current;
    if (box) requestAnimationFrame(() => (box.scrollTop = box.scrollHeight));
  }, [messages]);

  // When activeFile changes, highlight with highlight.js
  useEffect(() => {
    if (activeFile) {
      requestAnimationFrame(() => {
        document.querySelectorAll("pre code").forEach((block) => {
          try {
            hljs.highlightElement(block);
          } catch (e) {
            // ignore
          }
        });
      });
    }
  }, [activeFile]);

  const toggleSelection = (id) => {
    setSelectedUserIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // ---- Utilities to build nested tree from filenames ----
  // Returns something like: { name: 'src', children: { 'index.js': node, 'components': { ... } } }
  const buildTree = (blocks) => {
    const root = { type: "dir", name: "/", children: {} };

    blocks.forEach((b) => {
      const block = normalizeBlock(b);
      const path = (block.filename || `/${block.filename}`).replace(/^\//, "");
      const parts = path.split("/").filter(Boolean);
      let cursor = root;
      parts.forEach((part, idx) => {
        const isLast = idx === parts.length - 1;
        if (isLast) {
          // file node
          cursor.children[part] = {
            type: "file",
            name: part,
            fullPath: parts.join("/"),
            block,
          };
        } else {
          // dir node
          cursor.children[part] = cursor.children[part] || {
            type: "dir",
            name: part,
            children: {},
          };
          cursor = cursor.children[part];
        }
      });
    });

    return root;
  };

  // recursively render tree
  const FileTree = ({ node, depth = 0 }) => {
    const [expanded, setExpanded] = useState(depth < 1); // expand root immediate children
    if (!node) return null;
    if (node.type === "dir") {
      const entries = Object.values(node.children).sort((a, b) => {
        if (a.type === b.type) return a.name.localeCompare(b.name);
        return a.type === "dir" ? -1 : 1; // dirs first
      });
      return (
        <div className={`pl-${Math.min(depth * 4, 24)}`}>
          {depth > 0 && (
            <div
              className="flex items-center gap-2 cursor-pointer select-none p-1 rounded hover:bg-gray-100"
              onClick={() => setExpanded((s) => !s)}
            >
              <div className="w-4 text-sm">{expanded ? "▾" : "▸"}</div>
              <div className="text-sm font-medium">{node.name}</div>
            </div>
          )}
          {expanded && (
            <div className="ml-4">
              {entries.map((child) => (
                <div key={child.name + (child.fullPath || "")}>
                  <FileTree node={child} depth={depth + 1} />
                </div>
              ))}
            </div>
          )}
        </div>
      );
    }

    // file
    const isActive = activeFile?.id === node.block?.id;
    return (
      <div
        className={`flex items-center justify-between gap-2 p-1 rounded cursor-pointer hover:bg-gray-100 ${
          isActive ? "bg-blue-50 text-blue-700 font-semibold" : ""
        }`}
        onClick={() => setActiveFile(node.block)}
      >
        <div className="flex items-center gap-2">
          <div className="text-sm w-4">📄</div>
          <div className="text-sm break-all">{node.name}</div>
        </div>
        <div className="text-xs text-gray-400">
          {(node.block?.language || "").toUpperCase()}
        </div>
      </div>
    );
  };

  // Build tree for render
  const tree = buildTree(aiCodeBlocks);

  // Helper to strip code fences and inline code from AI messages:
  const plainTextFromAI = (raw) => {
    if (raw === null || raw === undefined) return "";
    let s = String(raw);
    // remove fenced code blocks
    s = s.replace(/```[\s\S]*?```/g, "");
    // remove inline code ticks
    s = s.replace(/`([^`]+)`/g, "$1");
    // optional: remove markdown links formatting [text](url) -> text
    s = s.replace(/\[([^\]]+)\]\((?:[^)]+)\)/g, "$1");
    // Trim excessive whitespace
    return s.trim();
  };

  return (
    <div className="bg-gray-100 h-screen flex">
      {/* Embedded small CSS so you can copy/paste without changing external files */}
      <style>{`
        /* hide scrollbar but keep scrolling */
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        /* small padding control for nested file tree indentation */
        .pl-0 { padding-left: 0px; }
        .pl-4 { padding-left: 16px; }
        .pl-8 { padding-left: 32px; }
        .pl-12 { padding-left: 48px; }
        .pl-16 { padding-left: 64px; }
        .pl-20 { padding-left: 80px; }
        .pl-24 { padding-left: 96px; }
      `}</style>

      {/* Left Panel (Chat Area) */}
      <div className="w-[25rem] bg-blue-100 relative flex flex-col justify-between p-4">
        {/* Side Panel */}
        <div
          className={`bg-red-500 flex flex-col gap-2 absolute h-full w-full left-0 top-0 transition-transform ${
            isSidePanelOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <header className="flex justify-end p-4 bg-slate-300">
            <button
              onClick={() => setIsSidePanelOpen(false)}
              className="text-3xl"
            >
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
                const id = getIdFromUser(u);
                const email = u?.email ?? "";
                const active = selectedUserIds.has(id);
                return (
                  <div
                    key={id}
                    className={`flex items-center gap-2 p-4 rounded-md cursor-pointer ${
                      active ? "bg-blue-600 text-white" : "hover:bg-gray-400"
                    }`}
                    onClick={() => toggleSelection(id)}
                  >
                    <div className="w-fit h-fit flex justify-center items-center rounded-full p-5 bg-gray-50 text-black">
                      <i className="ri-user-fill"></i>
                    </div>
                    <h1 className="font-semibold text-lg">
                      {email || "unknown"}
                    </h1>
                    {active && <span className="ml-2 text-xl">✓</span>}
                  </div>
                );
              })
            ) : (
              <p className="text-center">No users found</p>
            )}
          </div>
        </div>

        {/* Header */}
        <div className="flex items-center space-x-2 border-b px-1 py-2 mb-4">
          <button
            className="flex gap-2 items-center px-2 py-1 bg-white rounded-md shadow-sm"
            onClick={() => setIsModalOpen(true)}
          >
            <i className="ri-add-fill"></i>
            <p>Add Collaborators</p>
          </button>
          <div className="w-8 h-8 bg-blue-300 rounded-full flex items-center justify-center ml-auto text-white text-xl">
            <button onClick={() => setIsSidePanelOpen(!isSidePanelOpen)}>
              <i className="ri-user-line"></i>
            </button>
          </div>
        </div>

        {/* Message Area */}
        <div className="flex-1 flex flex-col gap-4 overflow-hidden">
          {/* Message Box */}
          <div
            ref={messageBox}
            className="flex-1 overflow-y-scroll [&::-webkit-scrollbar]:hidden p-4 flex flex-col gap-3"
            aria-live="polite"
          >
            {messages.length === 0 ? (
              <div className="text-center text-sm text-gray-500">
                No messages yet
              </div>
            ) : (
              messages.map((m) => {
                console.log("Debugging message:", m);

                const isOutgoing =
                  m.direction === "outgoing" || m.sender === myEmail;
                const isAI = m.sender === "AI Assistant";

                // Safely parse AI message if it's a stringified JSON
                let displayText = m.message;
                if (isAI) {
                  try {
                    const parsed = JSON.parse(m.message);
                    displayText = parsed?.text || m.message;
                  } catch (e) {
                    displayText = m.message; // fallback to raw string
                  }
                }

                return (
                  <div
                    key={m.id}
                    className={`${
                      isOutgoing
                        ? "self-end bg-blue-600 text-white"
                        : "self-start bg-white border-none"
                    } p-2 rounded-lg shadow-sm max-w-[80%]`}
                  >
                    {/* Sender Label */}
                    <div className="text-[9px] font-semibold mb-1">
                      {isOutgoing ? "You" : m.sender || "Anonymous"}
                    </div>

                    {/* Message Text */}
                    <div className="text-sm whitespace-pre-wrap break-words overflow-hidden max-w-full">
                      {displayText}
                    </div>

                    {/* Timestamp */}
                    <div className="text-[8px] text-gray-400 mt-1 text-right">
                      {new Date(m.timestamp || Date.now()).toLocaleTimeString()}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Input Area */}
          <div className="mt-4 flex items-center bg-white rounded-full px-3 py-2 shadow-sm">
            <input
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendMessageHandler()}
              placeholder="Enter message"
              className="flex-1 outline-none text-sm text-gray-700 bg-transparent"
            />
            <button
              onClick={sendMessageHandler}
              className="text-blue-500 text-xl ml-2"
            >
              <i className="ri-send-plane-2-fill"></i>
            </button>
          </div>
        </div>

        {/* Modal (unchanged) */}
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
              className="absolute inset-0 bg-black/50"
              onClick={() => setIsModalOpen(false)}
            />
            <div className="relative bg-white rounded-lg w-full max-w-2xl shadow-lg overflow-hidden">
              <header className="flex justify-between items-center p-4 border-b">
                <h3 className="text-lg font-semibold">
                  Select collaborator(s)
                </h3>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="text-2xl hover:bg-gray-100 rounded-md p-2"
                >
                  <i className="ri-close-line"></i>
                </button>
              </header>
              <div className="p-4 max-h-[60vh] overflow-auto">
                {loading ? (
                  <p className="text-center">Loading...</p>
                ) : (
                  users.map((u) => {
                    const id = getIdFromUser(u);
                    const email = u?.email ?? "";
                    const active = selectedUserIds.has(id);
                    return (
                      <button
                        key={id}
                        onClick={() => toggleSelection(id)}
                        className={`w-full text-left p-3 rounded-lg flex items-center gap-3 hover:bg-gray-50 transition ${
                          active
                            ? "bg-blue-50 ring-2 ring-blue-200"
                            : "bg-white"
                        }`}
                      >
                        <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-sm font-medium">
                          {(email?.charAt(0) ?? "?").toUpperCase()}
                        </div>
                        <div className="flex-1">
                          <div className="font-medium">
                            {email || u.name || id}
                          </div>
                          {u.name && (
                            <div className="text-sm text-gray-500">
                              {u.name}
                            </div>
                          )}
                        </div>
                        {active && (
                          <div className="text-blue-600 text-xl">
                            <i className="ri-checkbox-circle-fill"></i>
                          </div>
                        )}
                      </button>
                    );
                  })
                )}
              </div>
              <footer className="flex justify-end items-center gap-2 p-4 border-t">
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-md bg-gray-100"
                >
                  Close
                </button>
              </footer>
            </div>
          </div>
        )}
      </div>

      {/* Right Panel: File Explorer (nested) + Code Viewer */}
      <div className="w-2/3 shrink flex bg-white h-full">
        {/* File List */}
        <div className="w-1/3 border-r bg-gray-50 overflow-y-auto p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-md font-semibold text-gray-700">
              Project Files
            </h2>
            <div className="text-sm text-gray-500">
              {aiCodeBlocks.length} files
            </div>
          </div>

          {aiCodeBlocks.length === 0 ? (
            <p className="text-gray-500 text-sm">No files generated yet</p>
          ) : (
            <div className="space-y-1">
              {/* root children */}
              {Object.values(tree.children)
                .sort((a, b) => {
                  if (a.type === b.type) return a.name.localeCompare(b.name);
                  return a.type === "dir" ? -1 : 1;
                })
                .map((child) => (
                  <div key={child.name + (child.fullPath || "")}>
                    <FileTree node={child} depth={0} />
                  </div>
                ))}
            </div>
          )}
        </div>

        {/* Code Viewer */}
        <div className="flex-1 bg-gray-900 text-white overflow-y-auto p-6">
          {!activeFile ? (
            <div className="text-gray-400 text-sm text-center mt-20">
              Select a file to view its contents
            </div>
          ) : (
            <div>
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-sm font-medium text-gray-300">
                  {activeFile.filename || "Untitled File"}
                </h3>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400">
                    {(activeFile.language || "").toUpperCase()}
                  </span>
                  <button
                    onClick={() =>
                      navigator.clipboard.writeText(activeFile.code)
                    }
                    className="text-xs px-2 py-1 bg-blue-600 hover:bg-blue-700 rounded-md"
                  >
                    Copy
                  </button>
                  <button
  className="text-xs px-2 py-1 bg-blue-600 hover:bg-blue-700 rounded-md"
  onClick={async () => {
    console.clear();
    console.log("🚀 Mounting files to user web container...");

    if (!userWebcontainer) {
      console.error("❌ userWebcontainer not initialized.");
      return;
    }

    try {
      const files = {};
      let packageFound = false;

      const collectFiles = (node, path = "") => {
        if (!node) return;
        const fullPath = `${path}${node.name}`;

        if (node.type === "file") {
          let content =
            node.content ?? node.block?.code ?? node.block?.content ?? "";

          if (node.name === "package.json") {
            packageFound = true;
            if (typeof content !== "string") {
              content = JSON.stringify(content, null, 2);
            }
            try {
              JSON.parse(content);
            } catch (err) {
              console.error("❌ Invalid JSON in package.json:", err);
              return;
            }
          }

          files[fullPath] = {
            file: { contents: String(content) },
          };
        } else if (node.type === "dir" && node.children) {
          Object.values(node.children).forEach((child) =>
            collectFiles(
              child,
              `${path}${node.name !== "/" ? node.name + "/" : ""}`
            )
          );
        }
      };

      collectFiles(tree);

      if (!packageFound || !files["package.json"]) {
        console.error("❌ No valid package.json found in project tree.");
        return;
      }

      await userWebcontainer.mount(files);
      console.log("✅ Files mounted in userWebcontainer.");

      // 🛑 Prevent double run
      if (window._startProcess) {
        try {
          await window._startProcess.kill();
          console.log("🛑 Previous server process killed.");
        } catch (err) {
          console.warn("⚠️ Could not kill previous process:", err);
        }
      }

      console.log("📦 Running npm install...");
      const installProcess = await userWebcontainer.spawn("npm", ["install"]);
      installProcess.output.pipeTo(
        new WritableStream({
          write(data) {
            console.log("[npm install]", data);
          },
        })
      );

      const installExitCode = await installProcess.exit;
      if (installExitCode !== 0) {
        console.error("❌ npm install failed");
        return;
      }

      console.log("✅ npm install completed successfully!");

      console.log("🚀 Starting server...");
      const startProcess = await userWebcontainer.spawn("npm", ["start"]);
      window._startProcess = startProcess; // 💾 store globally

      startProcess.output.pipeTo(
        new WritableStream({
          write(data) {
            console.log("[npm start]", data);
          },
        })
      );

      userWebcontainer.on("server-ready", (port, url) => {
        console.log("🌐 Server ready at:", url);
        setIframeUrl(url);
      });

      const startExitCode = await startProcess.exit;
      if (startExitCode !== 0) {
        console.error("❌ npm start exited with error code:", startExitCode);
        return;
      }

      console.log("✅ Server started successfully!");
    } catch (error) {
      console.error("❌ Error during Run:", error);
    }
  }}
>
  Run
</button>
                </div>
              </div>

  

<pre className="rounded-md text-sm overflow-x-auto bg-black p-4">
  <code
    key={activeFile.filename}
    className={`language-${activeFile.language || "javascript"}`}
    contentEditable
    suppressContentEditableWarning
    onBlur={(e) => {
      const updatedCode = e.currentTarget.textContent;
      setActiveFile((prev) => ({ ...prev, code: updatedCode }));
      localStorage.setItem(`code-${activeFile.filename}`, updatedCode);
    }}
    style={{
      whiteSpace: "pre-wrap",
      outline: "none",
      color: "white",
      fontFamily: "monospace",
    }}
  >
    {activeFile.code}
  </code>
</pre>

              {activeFile.explanation && (
                <div className="mt-3 text-sm text-gray-300">
                  {activeFile.explanation}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      {iframeUrl && userWebcontainer &&
                    (<div className="flex min-w-96 flex-col h-full">
                        <div className="address-bar">
                            <input type="text"
                                onChange={(e) => setIframeUrl(e.target.value)}
                                value={iframeUrl} className="w-full p-2 px-4 bg-slate-200" />
                        </div>
                        <iframe src={iframeUrl} className="w-full h-full"></iframe>
                    </div>)
                }
     
    </div>
  );
};

export default Project;
