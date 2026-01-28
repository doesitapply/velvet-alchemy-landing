# AI Agent Navigation - Element ID Reference

This document provides a comprehensive mapping of all interactive element IDs across the Velvet Alchemy platform for AI agent navigation.

## Landing Page (Home.tsx)

### Navigation Header
- `nav-link-pricing` - Link to pricing section
- `nav-link-how-it-works` - Link to how it works section
- `nav-button-login` - Login button

### Hero Section
- `hero-button-start-audit` - Primary CTA button to start free audit
- `hero-button-demo-dashboard` - Secondary button to view demo dashboard

### Revenue Calculator
- `revenue-calculator-slider` - Slider input for leads per week (range: 5-50)

### Bottom CTA
- `cta-button-get-dashboard-access` - Final CTA button for dashboard access

## Audit Request Dialog (AuditRequestDialog.tsx)

### Form Inputs
- `audit-form-input-company-name` - Company name text input
- `audit-form-input-website-url` - Website URL input (type: url)
- `audit-form-button-submit` - Submit button to start audit
- `audit-form-button-close` - Close button after submission

## Semantic HTML Structure

### Landing Page
- Uses semantic `<header>`, `<section>`, `<footer>` elements
- Proper heading hierarchy (h1, h2, h3)
- ARIA labels on form inputs
- Accessible button elements with clear text

### Forms
- All inputs have associated `<label>` elements
- Form fields have `name` attributes for accessibility
- Required fields marked with `required` attribute
- Proper input types (url, text, range)

## Navigation Patterns

### Primary Actions
1. Start audit flow: `hero-button-start-audit` → opens dialog with `audit-form-input-*` fields
2. View dashboard: `hero-button-demo-dashboard` or `cta-button-get-dashboard-access`
3. Login: `nav-button-login`

### Calculator Interaction
- Adjust `revenue-calculator-slider` to see real-time revenue projections
- Values automatically update based on slider position

## Best Practices for AI Agents

1. **Always use IDs** when targeting interactive elements
2. **Check element state** before interaction (disabled, loading, etc.)
3. **Wait for form submission** responses before proceeding
4. **Use semantic selectors** as fallback (button[type="submit"], input[type="url"])
5. **Verify URL format** before submitting audit requests

## Future Additions

As new pages are added to the platform, interactive elements should follow this naming convention:
- `{page}-{element-type}-{descriptive-name}`
- Example: `dashboard-button-export-leads`, `settings-input-email-address`
