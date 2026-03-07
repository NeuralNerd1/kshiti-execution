"use client";

import { useState } from "react";

// --- Mock Data ---
type ArtefactNode = {
  id: string;
  name: string;
  type: "folder" | "video" | "image";
  url?: string;
  children?: ArtefactNode[];
};

const mockArtefacts: ArtefactNode[] = [
  {
    id: "run-8042",
    name: "2026-03-04_10-15 (RUN-8042)",
    type: "folder",
    children: [
      {
        id: "s1-videos",
        name: "Videos",
        type: "folder",
        children: [
          {
            id: "v-success",
            name: "Success",
            type: "folder",
            children: [
              { id: "vid-1", name: "tc-101_login_success.mp4", type: "video", url: "https://www.w3schools.com/html/mov_bbb.mp4" },
              { id: "vid-2", name: "tc-104_promo_code.mp4", type: "video", url: "https://www.w3schools.com/html/mov_bbb.mp4" }
            ]
          },
          {
            id: "v-failure",
            name: "Failure",
            type: "folder",
            children: [
              { id: "vid-3", name: "tc-102_checkout_fail.mp4", type: "video", url: "https://www.w3schools.com/html/mov_bbb.mp4" }
            ]
          }
        ]
      },
      {
        id: "s1-images",
        name: "Images",
        type: "folder",
        children: [
          {
            id: "i-failure",
            name: "Failure",
            type: "folder",
            children: [
              { id: "img-1", name: "tc-102_assert_error.png", type: "image", url: "https://placehold.co/600x400/1e1e1e/ef4444?text=TC-102+Assertion+Failed" },
              { id: "img-2", name: "tc-103_timeout.png", type: "image", url: "https://placehold.co/600x400/1e1e1e/ef4444?text=TC-103+Timeout" }
            ]
          }
        ]
      }
    ]
  }
];

export default function ArtefactsView({ params }: { params?: any }) {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(["run-8042", "s1-videos", "v-success", "v-failure", "s1-images", "i-failure"]));
  const [selectedFile, setSelectedFile] = useState<ArtefactNode | null>(null);

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

  const handleFileClick = (file: ArtefactNode, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedFile(file);
  };

  const FileIcon = ({ type }: { type: string }) => {
    if (type === "video") {
      return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="23 7 16 12 23 17 23 7"></polygon><rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect></svg>;
    }
    if (type === "image") {
      return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>;
    }
    return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>;
  };

  const renderTree = (nodes: ArtefactNode[], depth = 0) => {
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
          {node.type !== "folder" && <div style={{ width: 12 }}></div>}

          <FileIcon type={node.type} />
          <span style={{
            fontFamily: node.type !== "folder" ? "monospace" : "inherit",
            color: node.name === "Success" ? "#10b981" : node.name === "Failure" ? "#ef4444" : "inherit"
          }}>{node.name}</span>
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
    <div style={{ display: "flex", height: "calc(100vh - 40px)", gap: "16px", backgroundColor: "var(--bg-primary)", padding: "16px", borderRadius: "12px", border: "1px solid var(--border)", overflow: "hidden" }}>

      {/* Explorer Sidebar */}
      <div style={{ width: "280px", background: "var(--bg-secondary)", borderRadius: "8px", border: "1px solid var(--border)", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "16px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: "8px", fontWeight: 600, color: "var(--text-primary)" }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path></svg>
          Artefacts Gallery
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "8px 0" }}>
          {renderTree(mockArtefacts)}
        </div>
      </div>

      {/* Media Viewer Area */}
      <div style={{ flex: 1, background: "#0b0c10", borderRadius: "8px", border: "1px solid var(--border)", display: "flex", flexDirection: "column", overflow: "hidden", position: "relative" }}>
        {selectedFile ? (
          <>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 24px", borderBottom: "1px solid #1f2937", background: "rgba(0,0,0,0.5)", position: "absolute", top: 0, left: 0, right: 0, zIndex: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px", fontSize: "14px", color: "white", fontFamily: "monospace", letterSpacing: "0.5px" }}>
                <FileIcon type={selectedFile.type} />
                {selectedFile.name}
              </div>
              <button style={{ background: "var(--primary)", border: "none", color: "white", padding: "6px 16px", borderRadius: "6px", fontSize: "13px", fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: "8px" }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                Download Media
              </button>
            </div>

            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "80px 40px 40px 40px" }}>
              {selectedFile.type === "video" ? (
                <div style={{ width: "100%", maxWidth: "900px", borderRadius: "8px", overflow: "hidden", boxShadow: "0 24px 48px rgba(0,0,0,0.5)", border: "1px solid #333" }}>
                  <video
                    controls
                    autoPlay
                    src={selectedFile.url}
                    style={{ width: "100%", display: "block", aspectRatio: "16/9", background: "black" }}
                  >
                    Your browser does not support the video tag.
                  </video>
                </div>
              ) : (
                <div style={{ width: "100%", maxWidth: "900px", borderRadius: "8px", overflow: "hidden", boxShadow: "0 24px 48px rgba(0,0,0,0.5)", border: "1px solid #333" }}>
                  <img
                    src={selectedFile.url}
                    alt={selectedFile.name}
                    style={{ width: "100%", height: "auto", display: "block" }}
                  />
                </div>
              )}
            </div>
          </>
        ) : (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", gap: "16px" }}>
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.3 }}><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>
            <div style={{ fontSize: "15px" }}>Select a video or image from the explorer to view.</div>
          </div>
        )}
      </div>
    </div>
  );
}
