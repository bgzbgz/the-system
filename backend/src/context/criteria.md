# The 8-Point Quality Criteria

Every Fast Track tool must pass ALL 8 criteria. 7/8 is a fail.

---

## 1. CLARITY

**Question**: Is it immediately obvious what this tool does?

### Pass Criteria
- User understands purpose in 5 seconds
- Labels are self-explanatory
- No jargon or technical terms
- Tool name describes the action

### Fail Examples
- "Input your KPIs" (what KPIs? what format?)
- "Strategic Assessment Tool" (assessment of what?)
- "Enter value" (what kind of value?)

### Pass Examples
- "Enter your monthly marketing spend in dollars"
- "Marketing ROI Calculator"
- "Select your primary business goal"

---

## 2. CONSISTENCY

**Question**: Does it follow Fast Track patterns?

### Pass Criteria
- Uses brand colors correctly:
  - Primary: #FF5733 (buttons, accents)
  - Secondary: #1A1A2E (headers, text)
  - Accent: #F5F5F5 (backgrounds)
- Standard layout (header → form → results)
- Consistent spacing (16px padding, 24px gaps)
- System fonts (Arial, Helvetica, sans-serif)

### Fail Examples
- Blue buttons (#3366CC)
- Custom fonts not in brand guidelines
- Centered form with full-width results
- Inconsistent padding (8px here, 20px there)

### Pass Examples
- Orange (#FF5733) submit button
- Navy (#1A1A2E) header background
- 16px padding on all form elements

---

## 3. ACTIONABILITY

**Question**: Does it produce useful, specific output?

### Pass Criteria
- Output leads to immediate action
- Results are specific (numbers, yes/no, specific items)
- Clear next step provided
- No vague advice

### Fail Examples
- "Consider improving your marketing strategy"
- "You might want to look into this further"
- "Results vary depending on circumstances"

### Pass Examples
- "Your ROI is 340%. PROCEED with this campaign."
- "NO-GO: You need 3 more criteria before launch."
- "ACTION: Schedule meeting with finance by Friday."

---

## 4. SIMPLICITY

**Question**: Is it the minimum viable tool?

### Pass Criteria
- Single clear purpose
- Minimum inputs needed (typically 3-5)
- No feature creep
- Could not be simpler while achieving goal

### Fail Examples
- Calculator that also generates reports
- 12 input fields when 4 would suffice
- Optional "advanced settings" section
- Multiple tabs or pages

### Pass Examples
- 3 inputs → 1 clear output
- One-page, one-action flow
- No optional features

---

## 5. COMPLETENESS

**Question**: Does it actually work?

### Pass Criteria
- All functionality implemented
- No placeholder content
- All inputs produce outputs
- No broken features

### Fail Examples
- "TODO: implement calculation"
- "Lorem ipsum" anywhere
- Button that does nothing
- Empty results section

### Pass Examples
- Every button has working functionality
- Real example content
- All edge cases handled

---

## 6. USABILITY

**Question**: Is it easy to use?

### Pass Criteria
- Intuitive top-to-bottom flow
- Clear feedback on every action
- Proper error messages
- Obvious what to do next

### Fail Examples
- Submit button before all inputs
- No loading state during calculation
- "Error" with no explanation
- Hidden required fields

### Pass Examples
- Logical field order
- "Calculating..." during processing
- "Please enter a number greater than 0"
- Clear visual hierarchy

---

## 7. CORRECTNESS

**Question**: Is the logic right?

### Pass Criteria
- Calculations are accurate
- Logic follows stated rules
- Edge cases handled
- Results match expectations

### Fail Examples
- ROI formula that divides wrong
- Percentage that exceeds 100% impossibly
- Negative values where impossible
- 0 input causing crash

### Pass Examples
- Verified calculations match manual math
- Proper rounding and formatting
- Graceful handling of 0, negative, large numbers

---

## 8. POLISH

**Question**: Does it feel professional?

### Pass Criteria
- Zero typos
- Consistent styling throughout
- Proper alignment
- Smooth interactions

### Fail Examples
- "Calulate" instead of "Calculate"
- Misaligned labels and inputs
- Different font sizes in same section
- Jarring color transitions

### Pass Examples
- Spell-checked content
- Pixel-perfect alignment
- Consistent typography
- Smooth hover states

---

## Scoring

| Score | Status | Action |
|-------|--------|--------|
| 8/8 | PASS | Approve for deployment |
| 6-7/8 | FAIL | Fix identified issues |
| 4-5/8 | FAIL | Major revision needed |
| 0-3/8 | FAIL | Complete rebuild |

**Remember**: A tool that's 7/8 "almost perfect" still fails. Excellence is the standard.
