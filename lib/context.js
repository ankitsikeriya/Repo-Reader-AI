"use client";

import { createContext, useContext, useState, useEffect } from "react";

const NotebookContext = createContext();

export function NotebookProvider({ children }) {
  const [notebooks, setNotebooks] = useState([]);
  const [activeNotebookId, setActiveNotebookId] = useState(null);
  const [sources, setSources] = useState({}); // { notebookId: [documents] }

  // Load from localStorage on mount
  useEffect(() => {
    const savedNotebooks = localStorage.getItem("notebooks");
    const savedSources = localStorage.getItem("sources");
    if (savedNotebooks) setNotebooks(JSON.parse(savedNotebooks));
    if (savedSources) setSources(JSON.parse(savedSources));
  }, []);

  // Save to localStorage on change
  useEffect(() => {
    if (notebooks.length > 0) {
      localStorage.setItem("notebooks", JSON.stringify(notebooks));
    }
  }, [notebooks]);

  useEffect(() => {
    if (Object.keys(sources).length > 0) {
      localStorage.setItem("sources", JSON.stringify(sources));
    }
  }, [sources]);

  const createNotebook = (name) => {
    const newNotebook = {
      id: crypto.randomUUID(),
      name,
      createdAt: new Date().toISOString(),
    };
    setNotebooks((prev) => [...prev, newNotebook]);
    setActiveNotebookId(newNotebook.id);
    return newNotebook;
  };

  const switchNotebook = (id) => {
    setActiveNotebookId(id);
  };

  const addSource = (notebookId, source) => {
    setSources((prev) => ({
      ...prev,
      [notebookId]: [...(prev[notebookId] || []), source],
    }));
  };

  const activeNotebook = notebooks.find((n) => n.id === activeNotebookId);
  const activeSources = activeNotebookId ? sources[activeNotebookId] || [] : [];

  return (
    <NotebookContext.Provider
      value={{
        notebooks,
        activeNotebookId,
        activeNotebook,
        createNotebook,
        switchNotebook,
        sources,
        activeSources,
        addSource,
      }}
    >
      {children}
    </NotebookContext.Provider>
  );
}

export function useNotebook() {
  return useContext(NotebookContext);
}
