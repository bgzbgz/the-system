import type { AppState } from '../types/index.ts';

// Initial application state
export const initialState: AppState = {
  // Navigation
  currentRoute: '/',

  // Jobs
  jobs: [],
  jobsLoading: false,
  jobsError: null,

  // Current job
  currentJob: null,
  currentJobLoading: false,

  // Submission form
  fileUpload: null,
  questionnaire: {},
  submitting: false,

  // UI state
  toasts: [],
  modalOpen: null,

  // Polling
  pollingActive: false,
  lastPollTime: null,
};

// Type for partial state updates
export type PartialState = Partial<AppState>;

// Subscriber function type
export type Subscriber = (state: AppState, prevState: AppState) => void;
