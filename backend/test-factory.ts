/**
 * Test Factory Script
 * Generates a tool from course content and saves the HTML
 */

import 'dotenv/config';
import { toolFactory } from './src/services/factory/index';
import { aiService } from './src/services/ai';
import { initializePrompts } from './src/prompts';
import { preloadAllContext } from './src/context';
import { writeFileSync } from 'fs';

const courseContent = `
# [MODULE:MASTER THE CORE ELEMENT OF PERFORMANCE]
## Cash Flow Analysis - The Power of One

### Key Outcomes and Benefits
* **Enhanced decision-making** - Better cash flow visibility and stronger financial health.
* **Improved processes** - Minimized cash flow gaps and optimized liquidity.

### Focus Areas

#### Concepts to Be Learned
* Understanding Cash Flow
* The Power of One
* Working Capital

#### Decisions to be Made
* Cash Allocation
* Debt Management
* Expense Prioritization

### Fast Track 80/20: Key Learnings

1. **The Cash Flow Story** - Understanding your business's financial health in four key areas: Profit, Working Capital, Other Capital, and Funding.

2. **The Power of One** - Small 1% changes in key levers create big cash flow impact:
   - LEVER 1: Price - 1% increase in price
   - LEVER 2: Volume - 1% increase in units sold
   - LEVER 3: COGS - 1% decrease in cost of goods sold
   - LEVER 4: Overhead - 1% decrease in overhead costs
   - LEVER 5: AR Days - 1 day reduction in accounts receivable collection
   - LEVER 6: AP Days - 1 day increase in accounts payable
   - LEVER 7: Inventory Days - 1 day reduction in inventory holding

3. **Importance of Cash Flow over Profit** - Profit does not equal cash. Cash flow is the oxygen of a company.

### Expert Wisdom
"Cash flow is the oxygen of a company. You can have every dream, every strategy you want, but if you don't have the cash, it's academic." - Alan Miltz

### Reflection Questions
1. How can you apply the Power of One to your current cash flow practices?
2. Which of the 7 levers has the highest potential impact for your business?
3. How will regular financial health checks improve your decision-making?

### Books Referenced
* SCALING UP by Verne Harnish - Power of One concept
* Profit First by Mike Michalowicz

### Sprint Checklist
[01] We understand how the seven Cash Flow levers impact cash flow. Yes/No
[02] We have assigned people responsible for the seven levers. Yes/No
`;

async function main() {
  console.log('Initializing services...');

  // Initialize AI service
  aiService.initialize();

  // Initialize prompts and context
  initializePrompts();
  preloadAllContext();

  console.log('Running Tool Factory...');
  console.log('This will take 2-3 minutes as it runs through 8 AI stages...\n');

  const startTime = Date.now();

  const result = await toolFactory.processRequest({
    jobId: 'test-' + Date.now(),
    userRequest: courseContent
  });

  const elapsed = Math.round((Date.now() - startTime) / 1000);
  console.log(`\nCompleted in ${elapsed} seconds`);
  console.log(`Success: ${result.success}`);
  console.log(`Status: ${result.status}`);
  console.log(`Revision Count: ${result.revisionCount}`);

  if (result.toolSpec) {
    console.log(`Tool Name: ${result.toolSpec.name}`);
  }

  if (result.qaResult) {
    console.log(`QA Score: ${result.qaResult.score}/8`);
    console.log(`QA Passed: ${result.qaResult.passed}`);
  }

  if (result.toolHtml) {
    const outputPath = './generated-cash-flow-tool.html';
    writeFileSync(outputPath, result.toolHtml);
    console.log(`\nHTML saved to: ${outputPath}`);
    console.log(`HTML length: ${result.toolHtml.length} characters`);
  } else {
    console.log('\nNo HTML generated');
    if (result.error) {
      console.log('Error:', result.error);
    }
  }
}

main().catch(console.error);
