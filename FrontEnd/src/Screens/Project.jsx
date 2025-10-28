// src/components/Project.jsx
import React, {
  useEffect,
  useState,
  useContext,
  useRef,
  useCallback,
} from "react";
import { useLocation } from "react-router-dom";
import axios from "../Config/axios.config.js";
import {
  initializeSocket,
  receiveMessage,
  sendMessage,
} from "../Config/socket.config.js";
import { UserContext } from "../Context/user.context";
import hljs from "highlight.js";
import "highlight.js/styles/github-dark.css";
import { getWebcontainer } from "../Config/Webcontainer.js";

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

  // SINGLE SOURCE OF TRUTH for files generated/edited (includes AI-provided files):
  const [aiCodeBlocks, setAiCodeBlocks] = useState([]);

  const [selectedUserIds, setSelectedUserIds] = useState(new Set());
  const [activeFile, setActiveFile] = useState(null);
  const [userWebcontainer, setUserWebcontainer] = useState(null);
  const [iframeUrl, setIframeUrl] = useState(null);

  const { user } = useContext(UserContext);
  const messageBox = useRef(null);

  const [currentUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("user")) ?? null;
    } catch {
      return null;
    }
  });

  // UTILITIES
  const getIdFromUser = (u) =>
    String(
      u?._id ?? u?.id ?? u?.email ?? u?.user_unique_id ?? u?.web_id ?? u ?? ""
    );

  const myEmail = user?.email || currentUser?.email || "You";

  // Normalize a block to a consistent shape
  const normalizeBlock = (block) => {
    const nb = { ...block };
    if (!nb.filename) {
      nb.filename = `snippet-${String(nb.id ?? Math.random()).replace(
        ".",
        "-"
      )}.${nb.language || "txt"}`;
    }
    if (!nb.language) nb.language = "plaintext";
    if (typeof nb.code !== "string") nb.code = String(nb.code ?? "");
    return nb;
  };

  // Build a nested tree used for rendering and for mounting files to the webcontainer
  const buildTree = useCallback((blocks) => {
    const root = { type: "dir", name: "/", children: {} };
    blocks.forEach((b) => {
      const block = normalizeBlock(b);
      const path = (block.filename || `/${block.filename}`).replace(/^\//, "");
      const parts = path.split("/").filter(Boolean);
      let cursor = root;
      parts.forEach((part, idx) => {
        const isLast = idx === parts.length - 1;
        if (isLast) {
          cursor.children[part] = {
            type: "file",
            name: part,
            fullPath: parts.join("/"),
            block,
          };
        } else {
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
  }, []);

  // `tree` is derived from aiCodeBlocks (single source of truth)
  const tree = buildTree(aiCodeBlocks);

  // Update a single block's code inside aiCodeBlocks by filename or id
  const updateBlockCode = (identifier, newCode) => {
    setAiCodeBlocks((prev) => {
      const next = prev.map((b) => {
        if (
          b.id === identifier ||
          b.filename === identifier ||
          (b.filename && identifier === b.filename)
        ) {
          return { ...b, code: newCode };
        }
        return b;
      });
      // if the currently active file is the updated one, reflect the change
      setActiveFile((af) => {
        if (!af) return af;
        if (af.id === identifier || af.filename === identifier) {
          return { ...af, code: newCode };
        }
        return af;
      });
      // persist to localStorage for quick reloads
      try {
        const key = `code-${identifier}`;
        localStorage.setItem(key, newCode);
      } catch (e) {
        // ignore
      }
      return next;
    });
  };

  // When user edits code in the UI, call this to persist the change to the source of truth
  const handleUserEdit = (filenameOrId, newCode) => {
    updateBlockCode(filenameOrId, newCode);
  };

  // Called when AI message supplies new file(s) — merges into aiCodeBlocks and selects first file if none
  const handleAIBlocks = (blocks) => {
    if (!blocks || blocks.length === 0) return;
    const normalized = blocks.map(normalizeBlock);
    setAiCodeBlocks((prev) => {
      // Merge by filename: replace if filename exists, otherwise append
      const byFilename = new Map(prev.map((b) => [b.filename, b]));
      normalized.forEach((nb) => byFilename.set(nb.filename, nb));
      const merged = Array.from(byFilename.values());

      // If no active file, select the first merged file
      setActiveFile((af) => af || merged[0] || null);
      return merged;
    });
  };

  // Socket: incoming project messages may include file trees or code snippets
  useEffect(() => {
    const socket = initializeSocket(projectId);

    if (!userWebcontainer) {
      getWebcontainer().then((container) => setUserWebcontainer(container));
    }

    const onProjectMessage = (data) => {
      setMessages((prev) => [
        ...prev,
        { ...data, direction: "incoming", id: Date.now() + Math.random() },
      ]);

      const raw = String(data?.message ?? "");

      // Try JSON first
      let text = raw.trim();
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
          handleAIBlocks(blocks);
          return;
        }

        if (parsed?.code) {
          const fenceMatch = String(parsed.code).match(
            /```(\w+)?\n([\s\S]*?)```/
          );
          handleAIBlocks([
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
        // not JSON — continue
      }

      // fallback: extract fenced code blocks
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
        handleAIBlocks(blocks);
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
        // If project returned files, merge them into our blocks
        if (proj?.fileTree) {
          const blocks = Object.entries(proj.fileTree)
            .map(([filename, node]) => {
              const contents = node?.file?.contents ?? "";
              const ext = filename.split(".").pop() || "text";
              return {
                id: Date.now() + Math.random(),
                filename,
                language: ext === "js" ? "javascript" : ext,
                code: contents,
                explanation: "",
              };
            })
            .filter(Boolean);
          if (blocks.length) handleAIBlocks(blocks);
        }

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

  // Highlight the active code block when it changes
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
  }, [activeFile, aiCodeBlocks]);

  const toggleSelection = (id) => {
    setSelectedUserIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  useEffect(() => {
    const handleFileSelect = (e) => {
      const { filename, id } = e.detail;
      if (!filename) return;

      // Find the file in aiCodeBlocks or tree
      const found =
        aiCodeBlocks.find((f) => f.filename === filename || f.id === id) ||
        null;

      if (found) {
        setActiveFile({
          filename: found.filename,
          language: found.language || "javascript",
          code: found.code || "",
          explanation: found.explanation || "",
        });
      }
    };

    window.addEventListener("project-file-select", handleFileSelect);
    return () =>
      window.removeEventListener("project-file-select", handleFileSelect);
  }, [aiCodeBlocks]);

  // Message sending
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
      { ...payload, direction: "outgoing", id: Date.now() + Math.random() },
    ]);
    setMessage("");
  };

  // When user clicks Run -> collect files from the tree and mount
  const handleRun = async () => {
    console.clear();
    console.log("🚀 Mounting files to user web container...");

    // ✅ 1. Sync latest editor code before running
    const editor = document.querySelector("pre code[contenteditable]");
    if (editor && activeFile) {
      const updatedCode = editor.textContent;
      if (updatedCode !== activeFile.code) {
        console.log("💾 Updating active file with latest edits before run...");
        handleUserEdit(activeFile.filename || activeFile.id, updatedCode);
      }
    }

    // ✅ 2. Continue with normal run logic
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
          const content = node.block?.code ?? "";
          let finalContent = content;

          if (node.name === "package.json") {
            packageFound = true;
            try {
              JSON.parse(finalContent);
            } catch (err) {
              console.error("❌ Invalid JSON in package.json:", err);
              throw new Error("Invalid package.json");
            }
          }

          files[fullPath] = { file: { contents: String(finalContent) } };
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

      if (!packageFound || !files["package.json"]) {
        console.error("❌ No valid package.json found in project tree.");
        return;
      }

      await userWebcontainer.mount(files);
      console.log("✅ Files mounted in userWebcontainer.");

      // Prevent double run
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
      window._startProcess = startProcess;

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
  };

  // When a user edits the contenteditable code block and blurs, we persist the change
  const onCodeBlur = (e) => {
    const updatedCode = e.currentTarget.textContent;
    if (!activeFile) return;
    handleUserEdit(activeFile.filename || activeFile.id, updatedCode);
  };

  // Helper to safely read plain text from AI messages
  const plainTextFromAI = (raw) => {
    if (raw === null || raw === undefined) return "";
    let s = String(raw);
    s = s.replace(/```[\s\S]*?```/g, "");
    s = s.replace(/`([^`]+)`/g, "$1");
    s = s.replace(/\[([^\]]+)\]\((?:[^)]+)\)/g, "$1");
    return s.trim();
  };

  return (
    <div className="bg-gray-100 h-screen flex">
      <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
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
              ×
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
                      👤
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

        <div className="flex items-center space-x-2 border-b px-1 py-2 mb-4">
          <button
            className="flex gap-2 items-center px-2 py-1 bg-white rounded-md shadow-sm"
            onClick={() => setIsModalOpen(true)}
          >
            ➕ <p>Add Collaborators</p>
          </button>
          <div className="w-8 h-8 bg-blue-300 rounded-full flex items-center justify-center ml-auto text-white text-xl">
            <button onClick={() => setIsSidePanelOpen(!isSidePanelOpen)}>
              👥
            </button>
          </div>
        </div>

        <div className="flex-1 flex flex-col gap-4 overflow-hidden">
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
                const isOutgoing =
                  m.direction === "outgoing" || m.sender === myEmail;
                const isAI = m.sender === "AI Assistant";
                let displayText = m.message;
                if (isAI) {
                  try {
                    const parsed = JSON.parse(m.message);
                    displayText = parsed?.text || m.message;
                  } catch (e) {
                    displayText = m.message;
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
                    <div className="text-[9px] font-semibold mb-1">
                      {isOutgoing ? "You" : m.sender || "Anonymous"}
                    </div>
                    <div className="text-sm whitespace-pre-wrap break-words overflow-hidden max-w-full">
                      {displayText}
                    </div>
                    <div className="text-[8px] text-gray-400 mt-1 text-right">
                      {new Date(m.timestamp || Date.now()).toLocaleTimeString()}
                    </div>
                  </div>
                );
              })
            )}
          </div>

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
              ✉️
            </button>
          </div>
        </div>

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
                  ×
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
                          <div className="text-blue-600 text-xl">✔️</div>
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

      {/* Right Panel: File Explorer + Code Viewer */}
      <div className="w-2/3 shrink flex bg-white h-full">
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
                    onClick={handleRun}
                    className="text-xs px-2 py-1 bg-blue-600 hover:bg-blue-700 rounded-md"
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
                  onBlur={onCodeBlur}
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

      {iframeUrl && userWebcontainer && (
        <div className="flex min-w-96 flex-col h-full">
          <div className="address-bar">
            <input
              type="text"
              onChange={(e) => setIframeUrl(e.target.value)}
              value={iframeUrl}
              className="w-full p-2 px-4 bg-slate-200"
            />
          </div>
          <iframe src={iframeUrl} className="w-full h-full" />
        </div>
      )}
    </div>
  );
};

// FileTree component moved below to keep top-level return clean
const FileTree = ({ node, depth = 0 }) => {
  const [expanded, setExpanded] = useState(depth < 1);
  if (!node) return null;
  if (node.type === "dir") {
    const entries = Object.values(node.children).sort((a, b) => {
      if (a.type === b.type) return a.name.localeCompare(b.name);
      return a.type === "dir" ? -1 : 1;
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
  const isActive = window?.__REACT_DEVTOOLS_GLOBAL_HOOK__ ? false : false; // noop placeholder so linter won't complain about unused
  return (
    <div
      className={`flex items-center justify-between gap-2 p-1 rounded cursor-pointer hover:bg-gray-100`}
      onClick={() => {
        // set active file by updating top-level state via a custom event to avoid prop drilling in this extracted component
        const ev = new CustomEvent("project-file-select", {
          detail: { filename: node.block.filename, id: node.block.id },
        });
        window.dispatchEvent(ev);
      }}
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

export default Project;
