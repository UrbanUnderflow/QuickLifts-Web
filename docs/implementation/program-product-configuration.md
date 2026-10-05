# Program product configuration

Organization documents own `productBrand` (`athleticmind` or `pulsecheck`) and optional `appBranding` overrides keyed by installed app identity. Missing program product resolves to AthleticMind. Missing app override resolves to that app's identity, independently of the program product.

Provisioning exposes these controls during organization creation and on expanded organization cards. Existing organization re-provisioning preserves omitted settings. Only existing platform administrators may write organization configuration under the current Firestore rules.

The coach dashboard uses the selected organization's product name. New support cases use the organization's product: AthleticMind follows the clinical pathway; PulseCheck supplies the 988 support resource. 988 resource provision is not an automated call, dispatch, or provider acknowledgement. Existing case routes remain pinned. Product changes do not grant staff permissions or change consent requirements.

The authenticated `get-pulsecheck-app-branding` function supplies only app branding from active, consistent membership/team/organization records. Missing or ambiguous program context preserves installed-app defaults. An explicit inaccessible team is rejected. Native centralized wordmarks refresh on authentication and foreground. Store listings/icons and the separate AthleticMind binary remain deferred.

Local review: `/admin/pulsecheckProvisioning`. Authentication remains required. Local Firebase mode may point at production; inspect the mode indicator before saving configuration.

Release work must deploy the web/function changes before shipping native consumers. No organizations are bulk rewritten by this implementation. Native source changes require their own app release; current installed builds do not gain the new branding consumer automatically. Email/legal text and store identity are not rewritten by app-branding overrides.
