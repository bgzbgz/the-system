# Feedback Formatting Rules

When providing feedback on Fast Track tools, follow these rules to ensure feedback is actionable and useful.

---

## The Golden Rule

**Be specific enough that someone could fix the issue without asking questions.**

---

## Good vs Bad Feedback

### Bad Feedback (Vague)
- "The styling is wrong"
- "Fix the layout"
- "The button doesn't look right"
- "Improve the user experience"

### Good Feedback (Specific)
- "Button uses #3366CC instead of brand color #FF5733"
- "Form container has 24px padding, should be 16px"
- "Submit button text says 'Go' but should say 'Calculate ROI'"
- "Error message appears below the fold; move above the form"

---

## Feedback Structure

For each issue, provide:

1. **What** is wrong (the specific element)
2. **Where** it is (location in the tool)
3. **How** to fix it (the correct value/behavior)

### Example Format
```
WHAT: Header color
WHERE: <header> element, line 15
HOW: Change background from #000000 to #1A1A2E
```

---

## Forbidden Feedback Phrases

### Hedge Words (Remove these)
- "might want to consider"
- "perhaps you could"
- "it seems like"
- "you may want to"

### Replace With
- "Change X to Y"
- "Remove X"
- "Add X after Y"
- "Replace X with Y"

---

## Feedback by Category

### Clarity Issues
- ❌ "Labels are confusing"
- ✅ "Label 'Value' should be 'Monthly Revenue (USD)'"

### Consistency Issues
- ❌ "Colors are off-brand"
- ✅ "Button background #2196F3 should be #FF5733"

### Actionability Issues
- ❌ "Output is vague"
- ✅ "Output says 'Good result' but should say 'GO: Your ROI of 150% exceeds the 100% threshold'"

### Simplicity Issues
- ❌ "Too complex"
- ✅ "Remove optional 'Advanced Settings' section - not needed for core functionality"

### Completeness Issues
- ❌ "Missing features"
- ✅ "Line 45: 'TODO: calculate total' - implement the addition of costA + costB"

### Usability Issues
- ❌ "Hard to use"
- ✅ "Add 'required' attribute to email input and display 'Email is required' error"

### Correctness Issues
- ❌ "Math is wrong"
- ✅ "ROI formula on line 67 divides by revenue instead of cost. Change: roi = (revenue - cost) / cost"

### Polish Issues
- ❌ "Has typos"
- ✅ "Line 23: 'Calulate' should be 'Calculate'"

---

## Priority Levels

When listing issues, order by priority:

1. **Critical** (Blocks deployment)
   - Broken functionality
   - Incorrect calculations
   - Missing core features

2. **Major** (Must fix before approval)
   - Off-brand colors
   - Unclear labels
   - Vague outputs

3. **Minor** (Fix if time permits)
   - Typos
   - Slight alignment issues
   - Minor polish

---

## Example Complete Feedback

```json
{
  "mustFix": [
    "Line 67: ROI calculation wrong. Formula should be: (revenue - cost) / cost * 100",
    "Line 23: Button text 'Calulate' should be 'Calculate'",
    "Line 15: Header background #000000 should be #1A1A2E",
    "Output section: Add clear GO/NO-GO verdict after the ROI percentage"
  ]
}
```

Each item is specific, locatable, and actionable.
