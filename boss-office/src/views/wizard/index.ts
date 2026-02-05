// Wizard View - 5-Step Tool Creation
// Feature: Boss Office Redesign

import { navigate } from '../../utils/router.ts';
import { renderWizardStepper, WIZARD_STEPS } from '../../components/wizard-stepper.ts';
import { createJob } from '../../api/jobs.ts';
import { showSuccess, showError, addToast } from '../../store/actions.ts';
import type { WizardState } from '../../types/index.ts';
import { renderStepIdentity } from './step-identity.ts';
import { renderStepFramework } from './step-framework.ts';
import { renderStepInputs } from './step-inputs.ts';
import { renderStepDecision } from './step-decision.ts';
import { renderStepReview } from './step-review.ts';

// Local wizard state (not stored globally to avoid pollution)
let wizardState: WizardState = {
  currentStep: 1,
  completedSteps: [],
  toolName: '',
  sprintId: '',
  category: 'B2B_PRODUCT',
  fileUpload: null,
  frameworkDescription: '',
  keyTerminology: [],
  expertQuotes: [],
  inputFields: [],
  decisionQuestion: '',
  verdictCriteria: '',
  errors: {},
};

// Current container reference
let currentContainer: HTMLElement | null = null;

/**
 * Reset wizard to initial state
 */
export function resetWizard(): void {
  wizardState = {
    currentStep: 1,
    completedSteps: [],
    toolName: '',
    sprintId: '',
    category: 'B2B_PRODUCT',
    fileUpload: null,
    frameworkDescription: '',
    keyTerminology: [],
    expertQuotes: [],
    inputFields: [],
    decisionQuestion: '',
    verdictCriteria: '',
    errors: {},
  };
}

/**
 * Get current wizard state
 */
export function getWizardState(): WizardState {
  return wizardState;
}

/**
 * Update wizard state and re-render
 */
export function updateWizardState(updates: Partial<WizardState>): void {
  wizardState = { ...wizardState, ...updates };
  if (currentContainer) {
    renderWizardView(currentContainer);
  }
}

/**
 * Go to a specific step
 */
export function goToStep(step: number): void {
  if (step < 1 || step > WIZARD_STEPS.length) return;

  // Validate current step before moving forward
  if (step > wizardState.currentStep) {
    const errors = validateCurrentStep();
    if (Object.keys(errors).length > 0) {
      wizardState.errors = errors;
      if (currentContainer) {
        renderWizardView(currentContainer);
      }
      return;
    }
    // Mark current step as completed
    if (!wizardState.completedSteps.includes(wizardState.currentStep)) {
      wizardState.completedSteps.push(wizardState.currentStep);
    }
  }

  wizardState.currentStep = step;
  wizardState.errors = {};
  if (currentContainer) {
    renderWizardView(currentContainer);
  }
}

/**
 * Go to next step
 */
export function nextStep(): void {
  goToStep(wizardState.currentStep + 1);
}

/**
 * Go to previous step
 */
export function prevStep(): void {
  goToStep(wizardState.currentStep - 1);
}

/**
 * Validate the current step
 */
function validateCurrentStep(): Record<string, string> {
  const errors: Record<string, string> = {};

  switch (wizardState.currentStep) {
    case 1: // Identity & Context
      if (!wizardState.toolName.trim()) {
        errors.toolName = 'Tool name is required';
      } else if (wizardState.toolName.length < 3) {
        errors.toolName = 'Tool name must be at least 3 characters';
      }
      if (!wizardState.sprintId) {
        errors.sprintId = 'Please select a sprint/module';
      }
      if (!wizardState.fileUpload || wizardState.fileUpload.status !== 'ready') {
        errors.fileUpload = 'Please upload source content';
      }
      break;

    case 2: // Framework Selection
      if (!wizardState.frameworkDescription.trim()) {
        errors.frameworkDescription = 'Framework description is required';
      } else if (wizardState.frameworkDescription.length < 50) {
        errors.frameworkDescription = 'Please provide more detail (at least 50 characters)';
      }
      break;

    case 3: // Input Design
      if (wizardState.inputFields.length === 0) {
        errors.inputFields = 'Add at least one input field';
      } else {
        const invalidFields = wizardState.inputFields.filter((f) => !f.label.trim());
        if (invalidFields.length > 0) {
          errors.inputFields = 'All fields must have a label';
        }
      }
      break;

    case 4: // Decision Logic
      if (!wizardState.decisionQuestion.trim()) {
        errors.decisionQuestion = 'Decision question is required';
      }
      if (!wizardState.verdictCriteria.trim()) {
        errors.verdictCriteria = 'Verdict criteria is required';
      } else if (wizardState.verdictCriteria.length < 50) {
        errors.verdictCriteria = 'Please provide more detail (at least 50 characters)';
      }
      break;
  }

  return errors;
}

/**
 * Submit the wizard
 */
export async function submitWizard(): Promise<void> {
  // Final validation of all steps
  const allErrors: Record<string, string> = {};

  // Check all steps
  for (let step = 1; step <= 4; step++) {
    wizardState.currentStep = step;
    const stepErrors = validateCurrentStep();
    Object.assign(allErrors, stepErrors);
  }
  wizardState.currentStep = 5; // Back to review

  if (Object.keys(allErrors).length > 0) {
    showError('Please fix all validation errors before submitting');
    return;
  }

  // Build the job request
  const jobRequest = {
    fileName: wizardState.fileUpload?.name || 'untitled.txt',
    fileContent: wizardState.fileUpload?.extractedText || '',
    questionnaire: {
      category: wizardState.category,
      decision: wizardState.decisionQuestion,
      teachingPoint: wizardState.frameworkDescription,
      inputs: formatInputsForBackend(),
      verdictCriteria: wizardState.verdictCriteria,
    },
  };

  try {
    addToast('info', 'Creating tool...', 5000);
    const job = await createJob(jobRequest);
    showSuccess(`Tool "${wizardState.toolName}" submitted successfully!`);
    resetWizard();
    navigate(`/job/${job._id}`);
  } catch (error) {
    console.error('Failed to create job:', error);
    showError(error instanceof Error ? error.message : 'Failed to create tool');
  }
}

/**
 * Format inputs for backend
 */
function formatInputsForBackend(): string {
  if (wizardState.inputFields.length === 0) return '';

  return wizardState.inputFields
    .map((field) => {
      let desc = `${field.label} (${field.type})`;
      if (field.hint) desc += `: ${field.hint}`;
      if (field.minValue !== undefined || field.maxValue !== undefined) {
        desc += ` [Range: ${field.minValue ?? '0'} - ${field.maxValue ?? '∞'}]`;
      }
      if (field.options && field.options.length > 0) {
        desc += ` [Options: ${field.options.join(', ')}]`;
      }
      if (!field.required) desc += ' (optional)';
      return desc;
    })
    .join('\n');
}

/**
 * Render the wizard view
 */
export function renderWizardView(container: HTMLElement): void {
  currentContainer = container;

  container.innerHTML = `
    <div class="view view--wizard">
      <div class="wizard">
        <div class="wizard__header">
          <h1 class="wizard__title">CREATE NEW TOOL</h1>
          <button type="button" class="btn btn--secondary wizard__cancel-btn">CANCEL</button>
        </div>

        <div id="wizard-stepper" class="wizard__stepper"></div>

        <form id="wizard-form" class="wizard__form">
          <div id="wizard-step-content" class="wizard__step-content"></div>

          <div class="wizard__navigation">
            <button type="button" class="btn btn--secondary wizard__prev-btn" ${wizardState.currentStep === 1 ? 'disabled' : ''}>
              ← BACK
            </button>

            ${wizardState.currentStep === WIZARD_STEPS.length ? `
              <button type="submit" class="btn btn--primary wizard__submit-btn">
                SUBMIT TOOL →
              </button>
            ` : `
              <button type="button" class="btn btn--primary wizard__next-btn">
                NEXT →
              </button>
            `}
          </div>
        </form>
      </div>
    </div>
  `;

  // Render stepper
  const stepperContainer = container.querySelector<HTMLElement>('#wizard-stepper');
  if (stepperContainer) {
    renderWizardStepper(stepperContainer, {
      currentStep: wizardState.currentStep,
      completedSteps: wizardState.completedSteps,
      onStepClick: goToStep,
    });
  }

  // Render current step content
  const stepContent = container.querySelector<HTMLElement>('#wizard-step-content');
  if (stepContent) {
    renderCurrentStep(stepContent);
  }

  // Attach navigation listeners
  attachWizardListeners(container);
}

/**
 * Render the current step content
 */
function renderCurrentStep(container: HTMLElement): void {
  switch (wizardState.currentStep) {
    case 1:
      renderStepIdentity(container, wizardState, updateWizardState);
      break;
    case 2:
      renderStepFramework(container, wizardState, updateWizardState);
      break;
    case 3:
      renderStepInputs(container, wizardState, updateWizardState);
      break;
    case 4:
      renderStepDecision(container, wizardState, updateWizardState);
      break;
    case 5:
      renderStepReview(container, wizardState, goToStep);
      break;
    default:
      container.innerHTML = '<p>Unknown step</p>';
  }
}

/**
 * Attach wizard navigation listeners
 */
function attachWizardListeners(container: HTMLElement): void {
  // Cancel button
  const cancelBtn = container.querySelector<HTMLButtonElement>('.wizard__cancel-btn');
  cancelBtn?.addEventListener('click', () => {
    if (confirm('Are you sure you want to cancel? All progress will be lost.')) {
      resetWizard();
      navigate('/');
    }
  });

  // Previous button
  const prevBtn = container.querySelector<HTMLButtonElement>('.wizard__prev-btn');
  prevBtn?.addEventListener('click', prevStep);

  // Next button
  const nextBtn = container.querySelector<HTMLButtonElement>('.wizard__next-btn');
  nextBtn?.addEventListener('click', nextStep);

  // Form submit
  const form = container.querySelector<HTMLFormElement>('#wizard-form');
  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    await submitWizard();
  });
}
