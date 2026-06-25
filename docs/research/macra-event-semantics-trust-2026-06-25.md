# Macra Event Semantics & Trust Audit

**Date:** 2026-06-25  
**Owner:** Sage  
**Task:** Audit Macra event semantics and trust guardrails  
**Scope:** Review event definitions, blocking rules, cancellation semantics, and trust guardrails that affect whether Macra trial-start growth signals are safe to scale.

## af_start_trial

_To be populated with cited event definition, firing path, and trust implications._

## af_purchase

_To be populated with cited event definition, firing path, and trust implications._

## af_subscribe

_To be populated with cited event definition, firing path, and trust implications._

## purchase_cancelled

_To be populated with cited event definition, firing path, and trust implications._

## web_checkout_started

_To be populated with cited event definition, firing path, and trust implications._

## StoreKit cancel

_To be populated with cited StoreKit cancellation semantics and relationship to purchase/trial progression._

## age eligibility

_To be populated with cited age-eligibility rules, enforcement points, and blocking behavior._

## missing birthdate blocks

_To be populated with cited birthdate requirement behavior and whether missing birthdate blocks trial progression or only annotates it._

## trial activation

_To be populated with cited definition of trial activation and any state/event distinction from raw trial start._

## Ambiguities

_To be populated with cited mismatches, overlaps, or undefined transitions that could make the team scale a misleading signal._

## Trust Guardrails

_To be populated with concrete pass/fail rules for when a Macra trial start should count as valid and trustworthy._
