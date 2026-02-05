import type {
  AppState,
  Job,
  FileUpload,
  Questionnaire,
  Toast,
  ModalType,
} from '../types/index.ts';
import { initialState, type PartialState, type Subscriber } from './state.ts';

// Store implementation
class Store {
  private state: AppState = { ...initialState };
  private subscribers: Set<Subscriber> = new Set();

  // Get current state
  getState(): AppState {
    return this.state;
  }

  // Update state with partial update
  setState(partial: PartialState): void {
    const prevState = this.state;
    this.state = { ...this.state, ...partial };
    this.notifySubscribers(prevState);
  }

  // Subscribe to state changes
  subscribe(fn: Subscriber): () => void {
    this.subscribers.add(fn);
    return () => this.subscribers.delete(fn);
  }

  // Notify all subscribers
  private notifySubscribers(prevState: AppState): void {
    this.subscribers.forEach((fn) => fn(this.state, prevState));
  }

  // Reset state to initial
  reset(): void {
    const prevState = this.state;
    this.state = { ...initialState };
    this.notifySubscribers(prevState);
  }
}

// Singleton store instance
export const store = new Store();

// Action: Set current route
export function setRoute(route: string): void {
  store.setState({ currentRoute: route });
}

// Action: Set jobs list
export function setJobs(jobs: Job[]): void {
  store.setState({ jobs, jobsLoading: false, jobsError: null });
}

// Action: Set jobs loading
export function setJobsLoading(loading: boolean): void {
  store.setState({ jobsLoading: loading });
}

// Action: Set jobs error
export function setJobsError(error: string | null): void {
  store.setState({ jobsError: error, jobsLoading: false });
}

// Action: Set current job
export function setCurrentJob(job: Job | null): void {
  store.setState({ currentJob: job, currentJobLoading: false });
}

// Action: Set current job loading
export function setCurrentJobLoading(loading: boolean): void {
  store.setState({ currentJobLoading: loading });
}

// Action: Update job in list
export function updateJobInList(updatedJob: Job): void {
  const { jobs } = store.getState();
  const updatedJobs = jobs.map((job) =>
    job._id === updatedJob._id ? updatedJob : job
  );
  store.setState({ jobs: updatedJobs });
}

// Action: Add a new job to the list (at the beginning for immediate visibility)
export function addJob(job: Job): void {
  const { jobs } = store.getState();
  // Only add if not already in list (avoid duplicates)
  const exists = jobs.some((j) => j._id === job._id);
  if (!exists) {
    store.setState({ jobs: [job, ...jobs] });
  }
}

// Action: Set file upload
export function setFileUpload(fileUpload: FileUpload | null): void {
  store.setState({ fileUpload });
}

// Action: Update file upload status
export function updateFileUploadStatus(
  status: FileUpload['status'],
  extractedText?: string,
  error?: string
): void {
  const { fileUpload } = store.getState();
  if (fileUpload) {
    store.setState({
      fileUpload: {
        ...fileUpload,
        status,
        extractedText: extractedText ?? fileUpload.extractedText,
        error: error ?? null,
      },
    });
  }
}

// Action: Set questionnaire field
export function setQuestionnaireField<K extends keyof Questionnaire>(
  field: K,
  value: Questionnaire[K]
): void {
  const { questionnaire } = store.getState();
  store.setState({
    questionnaire: { ...questionnaire, [field]: value },
  });
}

// Action: Reset submission form
export function resetSubmissionForm(): void {
  store.setState({
    fileUpload: null,
    questionnaire: {},
    submitting: false,
  });
}

// Action: Set submitting
export function setSubmitting(submitting: boolean): void {
  store.setState({ submitting });
}

// Action: Add toast
export function addToast(
  type: Toast['type'],
  message: string,
  duration: number = 4000
): string {
  const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const toast: Toast = {
    id,
    type,
    message,
    dismissAt: Date.now() + duration,
  };

  const { toasts } = store.getState();
  // Keep max 3 toasts
  const updatedToasts = [...toasts, toast].slice(-3);
  store.setState({ toasts: updatedToasts });

  // Auto-dismiss
  setTimeout(() => removeToast(id), duration);

  return id;
}

// Action: Remove toast
export function removeToast(id: string): void {
  const { toasts } = store.getState();
  store.setState({
    toasts: toasts.filter((t) => t.id !== id),
  });
}

// Action: Set modal
export function setModal(modal: ModalType): void {
  store.setState({ modalOpen: modal });
}

// Action: Close modal
export function closeModal(): void {
  store.setState({ modalOpen: null });
}

// Action: Set polling active
export function setPollingActive(active: boolean): void {
  store.setState({ pollingActive: active });
}

// Action: Update last poll time
export function updateLastPollTime(): void {
  store.setState({ lastPollTime: Date.now() });
}

// Helper: Show success toast
export function showSuccess(message: string): string {
  return addToast('success', message);
}

// Helper: Show error toast
export function showError(message: string): string {
  return addToast('error', message);
}

// Helper: Show info toast
export function showInfo(message: string): string {
  return addToast('info', message);
}
