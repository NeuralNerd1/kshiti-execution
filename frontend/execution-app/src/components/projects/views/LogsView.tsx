"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { getLogsTree, getLogFileContent } from "@/services/executionService";

type FileNode = {
  id: string;
  name: string;
  type: "folder" | "file";
  path?: string;
  children?: FileNode[];
};

export default function LogsView({ params }: { params?: any }) {
  const routeParams = useParams();
  const projectId = routeParams?.project_id as string;

  const [fileSystem, setFileSystem] = useState<FileNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [selectedFile, setSelectedFile] = useState<FileNode | null>(null);
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [fileLoading, setFileLoading] = useState(false);

  // Fetch log tree on mount
  useEffect(() => {
    if (!projectId) return;
    async function fetchTree() {
      try {
        setLoading(true);
        const tree = await getLogsTree(projectId);
        setFileSystem(tree || []);
        // Auto-expand first level
        if (tree && tree.length > 0) {
          const ids = new Set<string>();
          tree.forEach((node: FileNode) => {
            ids.add(node.id);
            if (node.children) {
              node.children.forEach((child: FileNode) => ids.add(child.id));
            }
          });
          setExpandedFolders(ids);
        }
      } catch (err) {
        console.error("Failed to fetch logs tree:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchTree();
  }, [projectId]);

  const toggleFolder = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const next = new Set(expandedFolders);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setExpandedFolders(next);
  };

  const handleFileClick = async (file: FileNode, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedFile(file);
    if (!file.path) return;

    try {
      setFileLoading(true);
      setFileContent(null);
      const res = await getLogFileContent(file.path);
      setFileContent(res.content);
    } catch (err) {
      console.error("Failed to load file:", err);
      setFileContent("// Error loading file content");
    } finally {
      setFileLoading(false);
    }
  };

  const handleDownload = () => {
    if (!selectedFile || !fileContent) return;
    const blob = new Blob([fileContent], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = selectedFile.name;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopy = () => {
    if (!fileContent) return;
    navigator.clipboard.writeText(fileContent);
  };

  const FolderIcon = ({ expanded }: { expanded: boolean }) => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill={expanded ? "var(--primary-light)" : "none"} stroke={expanded ? "var(--primary-light)" : "currentColor"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transition: "all 0.2s" }}>
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
    </svg>
  );

  const FileIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
      <polyline points="14 2 14 8 20 8"></polyline>
      <line x1="16" y1="13" x2="8" y2="13"></line>
      <line x1="16" y1="17" x2="8" y2="17"></line>
      <polyline points="10 9 9 9 8 9"></polyline>
    </svg>
  );

  const renderTree = (nodes: FileNode[], depth = 0) => {
    return nodes.map(node => (
      <div key={node.id} style={{ display: "flex", flexDirection: "column" }}>
        <div
          onClick={(e) => node.type === "folder" ? toggleFolder(node.id, e) : handleFileClick(node, e)}
          style={{
            padding: "6px 12px",
            paddingLeft: `${12 + (depth * 16)}px`,
            display: "flex",
            alignItems: "center",
            gap: "8px",
            cursor: "pointer",
            background: selectedFile?.id === node.id ? "rgba(99, 102, 241, 0.15)" : "transparent",
            color: selectedFile?.id === node.id ? "var(--primary-light)" : "var(--text-secondary)",
            borderLeft: selectedFile?.id === node.id ? "2px solid var(--primary)" : "2px solid transparent",
            fontSize: "13px",
          }}
          onMouseOver={(e) => { if (selectedFile?.id !== node.id) e.currentTarget.style.background = "rgba(255,255,255,0.03)" }}
          onMouseOut={(e) => { if (selectedFile?.id !== node.id) e.currentTarget.style.background = "transparent" }}
        >
          {node.type === "folder" && (
            <div style={{ transform: expandedFolders.has(node.id) ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.2s", display: "flex", alignItems: "center" }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
            </div>
          )}
          {node.type === "file" && <div style={{ width: 12 }}></div>}

          {node.type === "folder" ? <FolderIcon expanded={expandedFolders.has(node.id)} /> : <FileIcon />}
          <span style={{ fontFamily: node.type === "file" ? "monospace" : "inherit" }}>{node.name}</span>
        </div>

        {node.type === "folder" && expandedFolders.has(node.id) && node.children && (
          <div style={{ display: "flex", flexDirection: "column" }}>
            {renderTree(node.children, depth + 1)}
          </div>
        )}
      </div>
    ));
  };

  return (
    <div style={{ display: "flex", height: "calc(100vh - 80px)", gap: "16px", backgroundColor: "var(--bg-primary)", padding: "16px", borderRadius: "12px", border: "1px solid var(--border)", overflow: "hidden" }}>

      {/* File Explorer Sidebar */}
      <div style={{ width: "320px", background: "var(--bg-secondary)", borderRadius: "8px", border: "1px solid var(--border)", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "16px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: 600, color: "var(--text-primary)" }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
            Log Storage
          </div>
          <span style={{ fontSize: "11px", background: "linear-gradient(135deg, #3ecf8e, #2db87c)", color: "#fff", padding: "2px 8px", borderRadius: "4px", fontWeight: 600 }}>Supabase</span>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "8px 0" }}>
          {loading && (
            <div style={{ padding: "24px", textAlign: "center", color: "var(--text-muted)", fontSize: "13px" }}>
              <div className="spinner-primary" style={{ width: 20, height: 20, margin: "0 auto 8px" }} />
              Loading log files...
            </div>
          )}
          {!loading && fileSystem.length === 0 && (
            <div style={{ padding: "24px 16px", color: "var(--text-muted)", fontSize: "13px", textAlign: "center" }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ margin: "0 auto 8px", display: "block", opacity: 0.4 }}>
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
              </svg>
              No log files yet. Run an execution to generate logs.
            </div>
          )}
          {!loading && renderTree(fileSystem)}
        </div>
      </div>

      {/* Editor Area */}
      <div style={{ flex: 1, background: "#0d1117", borderRadius: "8px", border: "1px solid var(--border)", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {selectedFile ? (
          <>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderBottom: "1px solid #30363d", background: "#161b22" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px", fontSize: "13px", color: "#c9d1d9", fontFamily: "monospace" }}>
                <FileIcon />
                {selectedFile.name}
              </div>
              <div style={{ display: "flex", gap: "12px" }}>
                <button onClick={handleDownload} style={{ background: "transparent", border: "1px solid #30363d", color: "#c9d1d9", padding: "4px 12px", borderRadius: "6px", fontSize: "12px", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                  Download
                </button>
                <button onClick={handleCopy} style={{ background: "transparent", border: "1px solid #30363d", color: "#c9d1d9", padding: "4px 12px", borderRadius: "6px", fontSize: "12px", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                  Copy Raw
                </button>
              </div>
            </div>
            <div style={{ flex: 1, padding: "20px", overflowY: "auto" }}>
              {fileLoading ? (
                <div style={{ textAlign: "center", color: "#8b949e", padding: "32px" }}>
                  <div className="spinner-primary" style={{ width: 20, height: 20, margin: "0 auto 8px" }} />
                  Loading file content...
                </div>
              ) : (
                <pre style={{ margin: 0, fontFamily: "'Consolas', 'Courier New', monospace", fontSize: "13px", color: "#c9d1d9", lineHeight: "1.6", whiteSpace: "pre-wrap" }}>
                  {fileContent?.split('\n').map((line, idx) => {
                    let color = "#c9d1d9";
                    if (line.includes("[ERROR]") || line.includes("FATAL") || line.includes("Exception")) {
                      color = "#ff7b72";
                    } else if (line.includes("[INFO]")) {
                      color = "#79c0ff";
                    } else if (line.includes("[DEBUG]") || line.includes("-->") || line.includes("<--")) {
                      color = "#d2a8ff";
                    } else if (line.includes("[NETWORK]")) {
                      color = "#56d4dd";
                    } else if (line.includes("[WARN]")) {
                      color = "#e3b341";
                    }

                    return (
                      <div key={idx} style={{ display: "flex" }}>
                        <span style={{ color: "#484f58", width: "40px", minWidth: "40px", userSelect: "none" }}>{idx + 1}</span>
                        <span style={{ color }}>{line}</span>
                      </div>
                    );
                  })}
                </pre>
              )}
            </div>
          </>
        ) : (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "#8b949e", gap: "16px" }}>
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.3 }}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
            <div style={{ fontSize: "15px" }}>Select a log file from the explorer to view.</div>
          </div>
        )}
      </div>
    </div>
  );
}
