# Stripe Tax Compliance Setup Guide

## Overview
This guide covers the exact Stripe dashboard settings needed to enable tax compliance for the Pulse platform's creator economy (trainers + prize winners).

## Required Stripe Dashboard Settings

### 1. Enable Tax Reporting & Documents

**Path**: Stripe Dashboard → Connect → Settings → Tax reporting

**Settings to Enable**:
- ✅ **Tax Reporting & Documents**: ON
- ✅ **1099-K reporting**: Enabled 
- ✅ **1099-MISC reporting**: Enabled
- ✅ **1099-NEC reporting**: Enabled
- ✅ **Form 1042-S reporting**: Enabled (for international payees)

**What this does**:
- Automatically collects TIN (SSN/EIN) during onboarding
- Generates and e-delivers 1099 forms to connected accounts
- Provides downloadable tax reports for your CPA
- Handles international tax reporting (1042-S)

### 2. Enable TIN Collection & Verification

**Path**: Stripe Dashboard → Connect → Settings → Identity verification

**Required Settings**:
- ✅ **Tax ID collection**: Required
- ✅ **Tax ID verification**: Enabled
- ✅ **W-9 form collection**: Automatic (US)
- ✅ **W-8BEN form collection**: Automatic (International)
- ✅ **Backup withholding**: Enabled (recommended)

**What this does**:
- Forces users to provide SSN/EIN during onboarding
- Verifies tax IDs with IRS database
- Automatically enables 24% backup withholding for missing/invalid TINs
- Collects proper international tax forms

### 3. Configure Platform Settings

**Path**: Stripe Dashboard → Settings → Connect

**Platform Configuration**:
- ✅ **Platform name**: "Pulse Technologies Inc"
- ✅ **Platform URL**: "https://fitwithpulse.ai"
- ✅ **Support email**: your-support@yourdomain.com
- ✅ **Platform type**: "Marketplace"
- ✅ **Business model**: "Commission/Fees"

### 4. Enable Multi-Currency (Future-Proofing)

**Path**: Stripe Dashboard → Settings → Payment methods

**Settings**:
- ✅ **Multi-currency**: Enabled
- ✅ **Supported currencies**: USD, CAD, EUR, GBP, AUD (add others as needed)
- ✅ **Settlement currencies**: USD (primary)

### 5. Tax Document Settings

**Path**: Stripe Dashboard → Connect → Settings → Tax documents

**Configuration**:
- ✅ **Electronic delivery**: Enabled (default)
- ✅ **Email notifications**: Enabled
- ✅ **Reminder emails**: Enabled
- ✅ **Document availability**: January 31st
- ✅ **Download format**: PDF + CSV

**Thresholds** (automatically set by Stripe):
- **1099-NEC**: $600+ per year (service income)
- **1099-MISC**: $600+ per year (prize/other income)
- **1099-K**: $5,000+ and 200+ transactions per year

### 6. Enable Stripe Tax (for Sales Tax on Purchases)

**Path**: Stripe Dashboard → Products → Stripe Tax

**Settings**:
- ✅ **Stripe Tax**: Enabled
- ✅ **Automatic tax calculation**: On
- ✅ **Tax registration**: Configure for your business states
- ✅ **Product tax codes**: "Digital products" or "Services"

**Note**: This handles sales tax on customer purchases, separate from 1099 reporting on payouts.

---

## Account Creation Requirements

### For All Connected Accounts (Trainers & Winners)

**Required Capabilities** (auto-added by our code):
```javascript
capabilities: {
    card_payments: { requested: true },
    transfers: { requested: true },
    tax_reporting_us_1099_k: { requested: true },
    tax_reporting_us_1099_misc: { requested: true }
}
```

**Required Information Collected**:
- Legal name (must match bank account)
- Date of birth
- SSN (US) or Foreign TIN (international)
- Address
- Phone number
- Bank routing & account number

**Business Profile**:
- MCC Code: 7991 (Physical fitness facilities)
- Business type: individual
- Product description: Fitness-related services

---

## Tax Classification System

### Payment Types & Tax Forms

| Payment Type | Tax Form | Box | Description |
|--------------|----------|-----|-------------|
| Trainer Revenue | 1099-NEC | Box 1 | Non-employee compensation |
| Profit Sharing | 1099-NEC | Box 1 | Non-employee compensation |
| Prize Money | 1099-MISC | Box 3 | Other income |
| Referral Bonuses | 1099-MISC | Box 3 | Other income |

### Metadata Classification

**Service Income** (1099-NEC):
```javascript
metadata: {
    tax_classification: 'service_income',
    payment_type: 'trainer_revenue'
}
```

**Prize Income** (1099-MISC):
```javascript
metadata: {
    tax_classification: 'prize_income',
    payment_type: 'prize_money'
}
```

---

## Year-End Tax Process

### Timeline
- **Throughout Year**: Stripe collects TIN info and tracks payments
- **December 31**: Tax year cutoff for reporting
- **January 31**: Stripe delivers 1099s electronically
- **February 28**: Paper 1099s due to IRS (if any recipients didn't e-consent)
- **March 31**: Electronic 1099s due to IRS

### Platform Responsibilities
1. **Download tax reports** from Stripe dashboard
2. **Provide to CPA** for review and IRS filing
3. **No mailing required** if all connected accounts e-consent
4. **Keep records** for 7 years

### Connected Account Experience
1. **Automatic email** from Stripe in January
2. **Click to view/download** their 1099 form
3. **Use for tax filing** (TurboTax, CPA, etc.)
4. **No paper mail** unless they opt out of electronic delivery

---

## International Payees

### Automatic Handling
- **W-8BEN collection** during onboarding
- **1042-S forms** generated automatically
- **Treaty rate application** (0-30% withholding)
- **Electronic delivery** same as US forms

### Supported Countries
- **All major countries** supported by Stripe Connect
- **Treaty rates** applied automatically
- **Local tax compliance** remains with recipient
- **Multi-currency payouts** available

---

## Compliance Checklist

### ✅ Setup Tasks
- [ ] Enable Tax Reporting & Documents in Stripe
- [ ] Enable TIN collection and verification
- [ ] Configure backup withholding
- [ ] Update account creation code with tax capabilities
- [ ] Add payment metadata for tax classification
- [ ] Test with sample accounts

### ✅ Ongoing Tasks
- [ ] Monitor Stripe dashboard for verification issues
- [ ] Download monthly tax reports
- [ ] Address any TIN verification failures
- [ ] Review year-end tax reports with CPA
- [ ] File consolidated 1099s with IRS by March 31

### ✅ User Communication
- [ ] Update terms of service to mention tax reporting
- [ ] Add tax FAQ to help center
- [ ] Explain 1099 process during onboarding
- [ ] Provide tax guidance resources

---

## Testing Tax Features

### Test Mode Limitations
- **No real TIN verification** in test mode
- **No actual 1099 generation** in test mode
- **Simulated tax flows** only

### Live Mode Testing
- **Use real test accounts** with valid SSNs
- **Small amounts** ($1-10) for verification
- **Check TIN verification** works correctly
- **Verify metadata** appears in Stripe dashboard

---

## Troubleshooting

### Common Issues

**TIN Verification Failed**:
- User provided incorrect SSN format
- Name mismatch with IRS records
- Solution: User updates info in Stripe dashboard

**Backup Withholding Triggered**:
- Missing or invalid TIN
- Solution: User completes TIN verification

**International User Issues**:
- W-8BEN not completed
- Invalid foreign TIN format
- Solution: Re-complete onboarding with correct info

---

This setup ensures full tax compliance for your creator economy while minimizing manual work and providing excellent user experience. 