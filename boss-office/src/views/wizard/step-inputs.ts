// Step 3: Input Design
// Feature: Boss Office Redesign

import type { WizardState, InputFieldDefinition } from '../../types/index.ts';
import { renderInputBuilder, createDefaultField } from '../../components/input-builder.ts';

/**
 * Render Step 3: Input Design
 */
export function renderStepInputs(
  container: HTMLElement,
  state: WizardState,
  updateState: (updates: Partial<WizardState>) => void
): void {
  container.innerHTML = `
    <div class="wizard-step wizard-step--inputs">
      <p class="wizard-step__intro">
        Design the input fields that users will fill out. Each field captures information needed for the calculation.
      </p>

      ${state.errors.inputFields ? `
        <div class="wizard-step__error-banner">
          <span class="wizard-step__error-icon">!</span>
          ${state.errors.inputFields}
        </div>
      ` : ''}

      <div id="input-builder-container"></div>
    </div>
  `;

  // Render the input builder component
  const builderContainer = container.querySelector<HTMLElement>('#input-builder-container');
  if (builderContainer) {
    renderInputBuilder(builderContainer, {
      fields: state.inputFields,
      onAdd: () => {
        const newField = createDefaultField();
        updateState({
          inputFields: [...state.inputFields, newField],
          errors: {},
        });
      },
      onUpdate: (index: number, updates: Partial<InputFieldDefinition>) => {
        const newFields = [...state.inputFields];
        newFields[index] = { ...newFields[index], ...updates };
        updateState({ inputFields: newFields, errors: {} });
      },
      onDelete: (index: number) => {
        const newFields = [...state.inputFields];
        newFields.splice(index, 1);
        updateState({ inputFields: newFields, errors: {} });
      },
      onReorder: (fromIndex: number, toIndex: number) => {
        const newFields = [...state.inputFields];
        const [moved] = newFields.splice(fromIndex, 1);
        newFields.splice(toIndex, 0, moved);
        updateState({ inputFields: newFields, errors: {} });
      },
    });
  }
}
