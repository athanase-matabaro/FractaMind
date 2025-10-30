/**
 * useWorkspace.js - React hook for workspace state management
 */

import { useState, useEffect, useCallback } from 'react';
import {
  initFederation,
  getAllProjectIds,
  getProjectNodes,
  getFederationStats
} from '../core/federation.js';
import { listProjects } from '../core/projectRegistry.js';

/**
 * Custom hook for managing workspace state
 *
 * @returns {Object} Workspace state and actions
 */
export function useWorkspace() {
  const [projects, setProjects] = useState([]);
  const [selectedProjectIds, setSelectedProjectIds] = useState([]);
  const [projectWeights, setProjectWeights] = useState({});
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Initialize workspace
  useEffect(() => {
    let mounted = true;

    async function init() {
      try {
        setLoading(true);
        setError(null);

        // Initialize federation system
        await initFederation();

        // Load project list from registry
        const projectList = await listProjects();

        // Get federation project IDs
        const federationIds = await getAllProjectIds();

        // Merge project metadata with federation status
        const enrichedProjects = projectList.map(project => ({
          ...project,
          inWorkspace: federationIds.includes(project.id)
        }));

        if (mounted) {
          setProjects(enrichedProjects);

          // Auto-select projects that are in workspace
          const autoSelected = enrichedProjects
            .filter(p => p.inWorkspace)
            .map(p => p.id);

          setSelectedProjectIds(autoSelected);

          // Initialize weights to 1.0 for all projects
          const weights = {};
          enrichedProjects.forEach(p => {
            weights[p.id] = 1.0;
          });
          setProjectWeights(weights);
        }
      } catch (err) {
        console.error('Failed to initialize workspace:', err);
        if (mounted) {
          setError(err.message);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    init();

    return () => {
      mounted = false;
    };
  }, []);

  // Load federation stats
  const refreshStats = useCallback(async () => {
    try {
      const federationStats = await getFederationStats();
      setStats(federationStats);
    } catch (err) {
      console.error('Failed to load federation stats:', err);
    }
  }, []);

  // Refresh stats when selected projects change
  useEffect(() => {
    if (!loading && selectedProjectIds.length > 0) {
      refreshStats();
    }
  }, [selectedProjectIds, loading, refreshStats]);

  // Toggle project selection
  const toggleProject = useCallback((projectId) => {
    setSelectedProjectIds(prev => {
      if (prev.includes(projectId)) {
        return prev.filter(id => id !== projectId);
      } else {
        return [...prev, projectId];
      }
    });
  }, []);

  // Select all projects
  const selectAll = useCallback(() => {
    setSelectedProjectIds(projects.map(p => p.id));
  }, [projects]);

  // Deselect all projects
  const deselectAll = useCallback(() => {
    setSelectedProjectIds([]);
  }, []);

  // Set project weight
  const setProjectWeight = useCallback((projectId, weight) => {
    setProjectWeights(prev => ({
      ...prev,
      [projectId]: Math.max(0.1, Math.min(3.0, weight))
    }));
  }, []);

  // Get project by ID
  const getProject = useCallback((projectId) => {
    return projects.find(p => p.id === projectId);
  }, [projects]);

  // Get selected projects
  const getSelectedProjects = useCallback(() => {
    return projects.filter(p => selectedProjectIds.includes(p.id));
  }, [projects, selectedProjectIds]);

  // Reload projects list
  const reloadProjects = useCallback(async () => {
    try {
      setLoading(true);
      const projectList = await listProjects();
      const federationIds = await getAllProjectIds();

      const enrichedProjects = projectList.map(project => ({
        ...project,
        inWorkspace: federationIds.includes(project.id)
      }));

      setProjects(enrichedProjects);
    } catch (err) {
      console.error('Failed to reload projects:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    // State
    projects,
    selectedProjectIds,
    projectWeights,
    stats,
    loading,
    error,

    // Actions
    toggleProject,
    selectAll,
    deselectAll,
    setProjectWeight,
    getProject,
    getSelectedProjects,
    reloadProjects,
    refreshStats
  };
}

/**
 * Custom hook for project details
 *
 * @param {string} projectId - Project ID to load
 * @returns {Object} Project details and loading state
 */
export function useProjectDetails(projectId) {
  const [project, setProject] = useState(null);
  const [nodes, setNodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;

    async function loadProject() {
      if (!projectId) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        // Load project metadata
        const projectList = await listProjects();
        const projectData = projectList.find(p => p.id === projectId);

        // Load project nodes from federation
        const projectNodes = await getProjectNodes(projectId);

        if (mounted) {
          setProject(projectData);
          setNodes(projectNodes);
        }
      } catch (err) {
        console.error(`Failed to load project ${projectId}:`, err);
        if (mounted) {
          setError(err.message);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    loadProject();

    return () => {
      mounted = false;
    };
  }, [projectId]);

  return {
    project,
    nodes,
    loading,
    error
  };
}
