/**
 * Internationalization Strings for FractaMind
 *
 * Centralized copy for UI components.
 * Future: Can be extended to support multiple languages.
 *
 * Usage:
 * import { strings } from './i18n/strings';
 * <h1>{strings.hero.title}</h1>
 */

export const strings = {
  /**
   * Hero section
   */
  hero: {
    title: 'Explore ideas like a fractal',
    subtitle: 'Turn any text into an interactive, zoomable map of knowledge. Privacy-first — runs on your device.',
    ctaPrimary: 'Paste text or URL to begin',
    ctaSecondary: 'See demo',
    privacyBadge: 'All processing happens locally in your browser — private & offline by default.',
    privacyBadgeAria: 'All processing happens locally in your browser. Your data never leaves your device.',
  },

  /**
   * Onboarding popover
   */
  onboard: {
    title: 'Start Your Knowledge Fractal',
    textareaLabel: 'Paste text, an article, or a URL to explore:',
    textareaPlaceholder: `Paste your content here... (up to ~10,000 words)

Examples:
• Copy/paste an article or research paper
• Drop a URL to extract text
• Enter your notes or brainstorm ideas`,
    sampleDropdownLabel: 'Or try a sample:',
    submitButton: 'Generate Fractal',
    submittingButton: 'Processing...',
    trySampleButton: 'Try sample',
    privacyHint: 'All processing happens locally in your browser. Your data never leaves your device.',
    helperHint: 'Examples: copy/paste an article, drop a URL, or paste notes. Max ~10,000 words.',
    keyboardHint: 'Press Ctrl+Enter to generate',
    progressAnnouncement: 'Analyzing document — this may take up to 2 minutes. All processing happens locally.',
    successAnnouncement: 'Analysis complete — fractal ready.',
    fallbackAnnouncement: 'AI not reachable — using local demo summary to continue.',
    aiTakingLonger: 'AI taking longer — Continue with demo summary',

    // Sample options
    samples: {
      student: 'Student - Study notes',
      founder: 'Founder - Business plan',
      journalist: 'Journalist - Research article',
    },
  },

  /**
   * Tone selector
   */
  tone: {
    label: 'Tone preference:',
    concise: 'Concise',
    deep: 'Deep',
    creative: 'Creative',
    description: {
      concise: 'Quick summaries, essential points only',
      deep: 'Detailed analysis with context',
      creative: 'Engaging, narrative style',
    },
  },

  /**
   * Examples carousel
   */
  examples: {
    title: 'Quick Start Examples',
    subtitle: 'Click to try a sample document',

    student: {
      title: 'Student',
      description: 'Study notes and learning materials',
      content: `Photosynthesis is the process by which plants convert light energy into chemical energy. It occurs in chloroplasts and involves two main stages: the light-dependent reactions and the Calvin cycle.

Light-dependent reactions occur in the thylakoid membranes and produce ATP and NADPH. These molecules are then used in the Calvin cycle, which takes place in the stroma, to fix carbon dioxide into glucose.

The overall equation for photosynthesis is: 6CO2 + 6H2O + light energy → C6H12O6 + 6O2. This process is crucial for life on Earth as it produces oxygen and forms the base of most food chains.`,
    },

    founder: {
      title: 'Founder',
      description: 'Business plans and strategy docs',
      content: `FractaMind is building the future of knowledge exploration through fractal visualization. Our mission is to help people understand complex information by transforming static text into interactive, zoomable maps.

Market Opportunity: The knowledge management market is projected to reach $1.2B by 2027. Current solutions (Notion, Obsidian, Roam) focus on linear organization, leaving a gap for spatial, visual approaches.

Product Strategy: We start with a free, privacy-first web app powered by Chrome's Built-in AI. No API keys, no cloud costs. Our competitive advantage is local-first architecture and fractal metaphor for intuitive navigation.

Go-to-Market: Launch on Product Hunt targeting students, researchers, and knowledge workers. Partner with education platforms. Monetize through premium features (team workspaces, advanced export).`,
    },

    journalist: {
      title: 'Journalist',
      description: 'Research and investigation notes',
      content: `Investigation into climate change impact on coastal communities reveals urgent need for adaptation strategies. Over the past decade, sea levels have risen 3.2mm annually, displacing thousands of families from low-lying areas.

Key Findings:
1. Infrastructure damage costs exceed $50M annually in affected regions
2. Migration patterns show 25% population decrease in vulnerable coastal towns
3. Local governments lack adequate funding for protective measures

Expert Interviews: Dr. Sarah Chen, climate scientist at MIT, warns that current projections underestimate the pace of change. "We're looking at 1-2 meters of sea level rise by 2100 under current emissions scenarios," she states.

Community Response: Grassroots organizations are developing innovative solutions, including floating architecture and mangrove restoration projects. However, these efforts require coordinated policy support and sustained funding to scale effectively.`,
    },
  },

  /**
   * Processing states
   */
  processing: {
    analyzing: 'Analyzing document...',
    summarizing: 'Summarizing...',
    embedding: 'Generating embeddings...',
    complete: 'Complete!',
    success: 'Nice — your idea map is ready.',
    growing: 'Growing ideas — one branch at a time.',
    error: 'Something went wrong. Please try again.',
  },

  /**
   * Onboarding tour (3-step)
   */
  tour: {
    welcome: {
      title: 'Welcome to FractaMind!',
      description: 'Let us show you around in just 3 steps.',
      button: 'Start Tour',
      skip: 'Skip',
    },

    step1: {
      title: 'Zoom & Navigate',
      description: 'Pinch or scroll to zoom in and out. Click and drag to pan around your fractal.',
      benefit: 'See the big picture or dive into details.',
      next: 'Next',
      skip: 'Skip Tour',
    },

    step2: {
      title: 'Expand Nodes',
      description: 'Click any node to grow 2-4 child ideas. Each idea branches further — infinitely.',
      benefit: 'Explore depth without losing context.',
      next: 'Next',
      skip: 'Skip Tour',
    },

    step3: {
      title: 'Search & Save',
      description: 'Use semantic search to find related ideas across your fractal. Export as JSON or Markdown.',
      benefit: 'Find connections and share your work.',
      next: 'Got it!',
      skip: 'Skip Tour',
    },

    completed: {
      title: 'You\'re all set!',
      description: 'Start exploring your knowledge fractal.',
      button: 'Let\'s go',
    },
  },

  /**
   * Fractal canvas
   */
  fractal: {
    rootNodeLabel: 'Root node - click to expand',
    expandNodeLabel: 'Click to expand this node',
    collapseNodeLabel: 'Click to collapse this node',
    zoomInLabel: 'Zoom in',
    zoomOutLabel: 'Zoom out',
    resetViewLabel: 'Reset view',
    searchPlaceholder: 'Search nodes...',
    noResults: 'No matching nodes found',
    loading: 'Loading fractal...',
  },

  /**
   * Workspace (Phase 5)
   */
  workspace: {
    title: 'Workspace',
    subtitle: 'Manage your knowledge fractals',
    searchPlaceholder: 'Search across all projects...',
    noProjects: 'No projects yet. Import a document to get started.',
    projectCard: {
      nodes: 'nodes',
      lastAccessed: 'Last accessed',
      weight: 'Weight',
      active: 'Active',
      inactive: 'Inactive',
    },
  },

  /**
   * Accessibility announcements
   */
  a11y: {
    fractalSeedReady: 'Fractal seed ready, press Enter to explore',
    nodeExpanded: 'Node expanded with {count} children',
    nodeCollapsed: 'Node collapsed',
    searchResultsFound: '{count} results found',
    loadingComplete: 'Loading complete',
    errorOccurred: 'An error occurred: {message}',
  },

  /**
   * Error messages
   */
  errors: {
    generic: 'Something went wrong. Please try again.',
    aiUnavailable: 'Chrome Built-in AI is not available. Enable it in chrome://flags or try demo mode.',
    timeout: 'Operation timed out. Please try again with a shorter document.',
    networkError: 'Network error. Check your connection.',
    parseError: 'Failed to parse document. Please check the format.',
    storageError: 'Failed to save to local storage. Check available space.',
  },

  /**
   * Success messages
   */
  success: {
    imported: 'Document imported successfully!',
    exported: 'Fractal exported successfully!',
    saved: 'Changes saved.',
    copied: 'Copied to clipboard.',
  },

  /**
   * Common actions
   */
  actions: {
    cancel: 'Cancel',
    close: 'Close',
    save: 'Save',
    export: 'Export',
    import: 'Import',
    delete: 'Delete',
    edit: 'Edit',
    copy: 'Copy',
    paste: 'Paste',
    undo: 'Undo',
    redo: 'Redo',
    search: 'Search',
    filter: 'Filter',
    sort: 'Sort',
    refresh: 'Refresh',
    help: 'Help',
    settings: 'Settings',
  },
};

/**
 * Helper function to replace placeholders in strings
 * Example: interpolate(strings.a11y.nodeExpanded, { count: 3 })
 * Result: "Node expanded with 3 children"
 */
export function interpolate(str, vars) {
  return str.replace(/\{(\w+)\}/g, (match, key) => {
    return vars[key] !== undefined ? vars[key] : match;
  });
}

/**
 * Default export
 */
export default strings;
