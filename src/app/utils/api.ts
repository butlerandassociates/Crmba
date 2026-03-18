/**
 * API Client for Supabase Backend
 * Provides simple CRUD operations for CRM data
 */

import { projectId, publicAnonKey } from "/utils/supabase/info";

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-9d56a30d`;

// TEMPORARY: Use localStorage instead of backend
const USE_LOCAL_STORAGE = true;

// LocalStorage helpers
const getFromStorage = (key: string) => {
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
};

const saveToStorage = (key: string, data: any) => {
  localStorage.setItem(key, JSON.stringify(data));
};

// Get auth token from session storage
const getAuthHeaders = () => {
  const session = sessionStorage.getItem("supabase.auth.token");
  const token = session ? JSON.parse(session).access_token : null;
  
  console.log("API Request - Token exists:", !!token);
  
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token || publicAnonKey}`,
  };
};

// ==========================================
// Clients API
// ==========================================

export const clientsAPI = {
  getAll: async () => {
    if (USE_LOCAL_STORAGE) {
      return getFromStorage("clients");
    }
    const response = await fetch(`${API_BASE}/clients`, { headers: getAuthHeaders() });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: "Failed to fetch clients" }));
      console.error("API Error:", error);
      throw new Error(error.error || "Failed to fetch clients");
    }
    return response.json();
  },

  getById: async (id: string) => {
    if (USE_LOCAL_STORAGE) {
      const clients = getFromStorage("clients");
      return clients.find((client: any) => client.id === id);
    }
    const response = await fetch(`${API_BASE}/clients/${id}`, { headers: getAuthHeaders() });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: "Failed to fetch client" }));
      console.error("API Error:", error);
      throw new Error(error.error || "Failed to fetch client");
    }
    return response.json();
  },

  create: async (client: any) => {
    if (USE_LOCAL_STORAGE) {
      const clients = getFromStorage("clients");
      const newClient = { ...client, id: Date.now().toString() };
      saveToStorage("clients", [...clients, newClient]);
      return newClient;
    }
    const response = await fetch(`${API_BASE}/clients`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(client),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: "Failed to create client" }));
      console.error("API Error:", error);
      throw new Error(error.error || "Failed to create client");
    }
    return response.json();
  },

  update: async (id: string, client: any) => {
    if (USE_LOCAL_STORAGE) {
      const clients = getFromStorage("clients");
      const updatedClients = clients.map((c: any) => (c.id === id ? client : c));
      saveToStorage("clients", updatedClients);
      return client;
    }
    const response = await fetch(`${API_BASE}/clients/${id}`, {
      method: "PUT",
      headers: getAuthHeaders(),
      body: JSON.stringify(client),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: "Failed to update client" }));
      console.error("API Error:", error);
      throw new Error(error.error || "Failed to update client");
    }
    return response.json();
  },

  delete: async (id: string) => {
    if (USE_LOCAL_STORAGE) {
      const clients = getFromStorage("clients");
      const updatedClients = clients.filter((c: any) => c.id !== id);
      saveToStorage("clients", updatedClients);
      return { id };
    }
    const response = await fetch(`${API_BASE}/clients/${id}`, {
      method: "DELETE",
      headers: getAuthHeaders(),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: "Failed to delete client" }));
      console.error("API Error:", error);
      throw new Error(error.error || "Failed to delete client");
    }
    return response.json();
  },
};

// ==========================================
// Projects API
// ==========================================

export const projectsAPI = {
  getAll: async () => {
    if (USE_LOCAL_STORAGE) {
      return getFromStorage("projects");
    }
    const response = await fetch(`${API_BASE}/projects`, { headers: getAuthHeaders() });
    if (!response.ok) throw new Error("Failed to fetch projects");
    return response.json();
  },

  getById: async (id: string) => {
    if (USE_LOCAL_STORAGE) {
      const projects = getFromStorage("projects");
      return projects.find((project: any) => project.id === id);
    }
    const response = await fetch(`${API_BASE}/projects/${id}`, { headers: getAuthHeaders() });
    if (!response.ok) throw new Error("Failed to fetch project");
    return response.json();
  },

  create: async (project: any) => {
    if (USE_LOCAL_STORAGE) {
      const projects = getFromStorage("projects");
      const newProject = { ...project, id: Date.now().toString() };
      saveToStorage("projects", [...projects, newProject]);
      return newProject;
    }
    const response = await fetch(`${API_BASE}/projects`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(project),
    });
    if (!response.ok) throw new Error("Failed to create project");
    return response.json();
  },

  update: async (id: string, project: any) => {
    if (USE_LOCAL_STORAGE) {
      const projects = getFromStorage("projects");
      const updatedProjects = projects.map((p: any) => (p.id === id ? project : p));
      saveToStorage("projects", updatedProjects);
      return project;
    }
    const response = await fetch(`${API_BASE}/projects/${id}`, {
      method: "PUT",
      headers: getAuthHeaders(),
      body: JSON.stringify(project),
    });
    if (!response.ok) throw new Error("Failed to update project");
    return response.json();
  },

  delete: async (id: string) => {
    if (USE_LOCAL_STORAGE) {
      const projects = getFromStorage("projects");
      const updatedProjects = projects.filter((p: any) => p.id !== id);
      saveToStorage("projects", updatedProjects);
      return { id };
    }
    const response = await fetch(`${API_BASE}/projects/${id}`, {
      method: "DELETE",
      headers: getAuthHeaders(),
    });
    if (!response.ok) throw new Error("Failed to delete project");
    return response.json();
  },
};

// ==========================================
// Products API
// ==========================================

export const productsAPI = {
  getAll: async () => {
    if (USE_LOCAL_STORAGE) {
      return getFromStorage("products");
    }
    const response = await fetch(`${API_BASE}/products`, { headers: getAuthHeaders() });
    if (!response.ok) throw new Error("Failed to fetch products");
    return response.json();
  },

  save: async (product: any) => {
    if (USE_LOCAL_STORAGE) {
      const products = getFromStorage("products");
      const existingIndex = products.findIndex((p: any) => p.id === product.id);
      if (existingIndex >= 0) {
        products[existingIndex] = product;
      } else {
        products.push({ ...product, id: product.id || Date.now().toString() });
      }
      saveToStorage("products", products);
      return product;
    }
    const response = await fetch(`${API_BASE}/products`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(product),
    });
    if (!response.ok) throw new Error("Failed to save product");
    return response.json();
  },
};

// ==========================================
// Users/Team API
// ==========================================

export const usersAPI = {
  getAll: async () => {
    if (USE_LOCAL_STORAGE) {
      return getFromStorage("users");
    }
    const response = await fetch(`${API_BASE}/users`, { headers: getAuthHeaders() });
    if (!response.ok) throw new Error("Failed to fetch users");
    return response.json();
  },

  save: async (user: any) => {
    if (USE_LOCAL_STORAGE) {
      const users = getFromStorage("users");
      const existingIndex = users.findIndex((u: any) => u.id === user.id);
      if (existingIndex >= 0) {
        users[existingIndex] = user;
      } else {
        users.push({ ...user, id: user.id || Date.now().toString() });
      }
      saveToStorage("users", users);
      return user;
    }
    const response = await fetch(`${API_BASE}/users`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(user),
    });
    if (!response.ok) throw new Error("Failed to save user");
    return response.json();
  },
};

// ==========================================
// Photos API
// ==========================================

export const photosAPI = {
  upload: async (clientId: string, file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    
    const session = sessionStorage.getItem("supabase.auth.token");
    const token = session ? JSON.parse(session).access_token : null;
    
    const response = await fetch(`${API_BASE}/upload-photo/${clientId}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token || publicAnonKey}`,
      },
      body: formData,
    });
    if (!response.ok) throw new Error("Failed to upload photo");
    return response.json();
  },

  getAll: async (clientId: string) => {
    const response = await fetch(`${API_BASE}/photos/${clientId}`, { 
      headers: getAuthHeaders() 
    });
    if (!response.ok) throw new Error("Failed to fetch photos");
    return response.json();
  },

  delete: async (clientId: string, fileName: string) => {
    const response = await fetch(`${API_BASE}/photos/${clientId}/${fileName}`, {
      method: "DELETE",
      headers: getAuthHeaders(),
    });
    if (!response.ok) throw new Error("Failed to delete photo");
    return response.json();
  },
};

// ==========================================
// Data Migration Helper
// ==========================================

export const migrateData = async (data: {
  clients?: any[];
  projects?: any[];
  products?: any[];
  users?: any[];
}) => {
  const response = await fetch(`${API_BASE}/migrate-data`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error("Failed to migrate data");
  return response.json();
};