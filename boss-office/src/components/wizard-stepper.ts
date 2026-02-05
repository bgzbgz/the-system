// WizardStepper Component - 5-step progress indicator
// Feature: Boss Office Redesign

export interface WizardStep {
  number: number;
  title: string;
  shortTitle: string;
}

export const WIZARD_STEPS: WizardStep[] = [
  { number: 1, title: 'Identity & Context', shortTitle: 'IDENTITY' },
  { number: 2, title: 'Framework Selection', shortTitle: 'FRAMEWORK' },
  { number: 3, title: 'Input Design', shortTitle: 'INPUTS' },
  { number: 4, title: 'Decision Logic', shortTitle: 'DECISION' },
  { number: 5, title: 'Review & Submit', shortTitle: 'REVIEW' },
];

interface WizardStepperProps {
  currentStep: number;
  completedSteps: number[];
  onStepClick?: (step: number) => void;
}

/**
 * Render the wizard stepper component
 */
export function renderWizardStepper(
  container: HTMLElement,
  props: WizardStepperProps
): void {
  const { currentStep, completedSteps, onStepClick } = props;

  container.innerHTML = `
    <div class="wizard-stepper">
      <div class="wizard-stepper__track">
        ${WIZARD_STEPS.map((step, index) => {
          const isCompleted = completedSteps.includes(step.number);
          const isCurrent = currentStep === step.number;
          const isClickable = isCompleted || step.number <= currentStep;
          const isLast = index === WIZARD_STEPS.length - 1;

          return `
            <div class="wizard-stepper__step ${isCurrent ? 'wizard-stepper__step--active' : ''} ${isCompleted ? 'wizard-stepper__step--completed' : ''} ${isClickable ? 'wizard-stepper__step--clickable' : ''}" data-step="${step.number}">
              <div class="wizard-stepper__indicator">
                ${isCompleted ? `
                  <svg class="wizard-stepper__check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                ` : `
                  <span class="wizard-stepper__number">${step.number}</span>
                `}
              </div>
              <span class="wizard-stepper__label">${step.shortTitle}</span>
            </div>
            ${!isLast ? `
              <div class="wizard-stepper__connector ${isCompleted ? 'wizard-stepper__connector--completed' : ''}"></div>
            ` : ''}
          `;
        }).join('')}
      </div>
      <div class="wizard-stepper__title">
        STEP ${currentStep}: ${WIZARD_STEPS[currentStep - 1]?.title.toUpperCase() || ''}
      </div>
    </div>
  `;

  // Attach click handlers if onStepClick provided
  if (onStepClick) {
    const stepElements = container.querySelectorAll<HTMLElement>('.wizard-stepper__step--clickable');
    stepElements.forEach((el) => {
      el.addEventListener('click', () => {
        const stepNum = parseInt(el.dataset.step || '1', 10);
        onStepClick(stepNum);
      });
    });
  }
}

/**
 * Get step by number
 */
export function getStepByNumber(stepNumber: number): WizardStep | undefined {
  return WIZARD_STEPS.find((s) => s.number === stepNumber);
}

/**
 * Check if step is valid
 */
export function isValidStep(stepNumber: number): boolean {
  return stepNumber >= 1 && stepNumber <= WIZARD_STEPS.length;
}
