from pathlib import Path
p=Path('src/pages/admin/pulsecheckProvisioning.tsx');s=p.read_text()
s=s.replace('<div className="pcp-org-dashboard">','<div className={`pcp-org-dashboard ${directoryOrganization ? ui.focusedWorkspace : \'\'}`}>',1)
s=s.replace('''              <div className={ui.directoryHeading}>''','''              {directoryOrganization && <div className={ui.backRow}><button type="button" className="pcp-btn pcp-btn-ghost" onClick={() => selectOrganization(null)}>← All organizations</button><button type="button" className="pcp-btn pcp-btn-ghost" onClick={handleToggleAllRows}>{allVisibleRowsExpanded ? 'Collapse all' : 'Expand all'}</button></div>}
              <div className={ui.directoryHeading}>''',1)
# Keeping stats and search mounted avoids changing tour behavior; focused workspace uses CSS to remove redundant directory chrome.
# Every editor has one identifiable dialog surface for keyboard containment.
s=s.replace('className="pcp-modal" role="dialog"', 'className="pcp-modal" data-provisioning-dialog={isProvisioningModalOpen ? "active" : undefined} tabIndex={-1} role="dialog"',1)
s=s.replace('''className={`${ui.theme} ${ui.portal}`}
''','''className={`${ui.theme} ${ui.portal}`}
                                              data-provisioning-dialog="active" role="dialog" aria-modal="true" aria-label="Team configuration editor" tabIndex={-1}
''')
s=s.replace('<div className="fixed inset-0 z-50 overflow-y-auto bg-black/70 px-4 py-4 sm:px-6 sm:py-6">','<div data-provisioning-dialog="active" role="dialog" aria-modal="true" aria-label="Manage onboarding links" tabIndex={-1} className="fixed inset-0 z-50 overflow-y-auto bg-black/70 px-4 py-4 sm:px-6 sm:py-6">',1)
# Stable ref lets keyboard handling use current close callbacks without resetting focus on form edits.
pos=s.index('  return (\n    <div className={ui.theme}>')
s=s[:pos]+'''  const closeActiveDialogRef = useRef<() => void>(() => {});
  closeActiveDialogRef.current = () => {
    if (coachIntakeShareTeamId) setCoachIntakeShareTeamId(null);
    else if (intakeModalTeamId) setIntakeModalTeamId(null);
    else if (consentModalTeamId) setConsentModalTeamId(null);
    else if (copyLinkModalTeamId) handleCloseCopyLinkModal();
    else if (onboardingModal) handleCloseOnboardingModal();
    else if (isProvisioningModalOpen) handleCloseProvisioningModal();
  };
  useEffect(() => {
    if (!isProvisioningModalOpen && !onboardingModal && !copyLinkModalTeamId && !consentModalTeamId && !intakeModalTeamId && !coachIntakeShareTeamId) return;
    const dialog = document.querySelector<HTMLElement>('[data-provisioning-dialog="active"]');
    if (!dialog) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const focusable = () => Array.from(dialog.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex="0"]'))
      .filter((element) => element.getClientRects().length > 0 && getComputedStyle(element).visibility !== 'hidden');
    (focusable()[0] || dialog).focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); closeActiveDialogRef.current(); }
      if (event.key !== 'Tab') return;
      const elements = focusable();
      const first = elements[0];
      const last = elements[elements.length - 1];
      if (!first) { event.preventDefault(); dialog.focus(); return; }
      if (event.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || !dialog.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, [isProvisioningModalOpen, onboardingModal, copyLinkModalTeamId, consentModalTeamId, intakeModalTeamId, coachIntakeShareTeamId]);

'''+s[pos:]
# Walkthrough starts in directory so each target is visible.
s=s.replace('onClick={() => setAdminTourOpen(true)}', 'onClick={() => { selectOrganization(null); setAdminTourOpen(true); }}')
p.write_text(s)
p=Path('tests/e2e/pulsecheck-onboarding-workspace.spec.ts');s=p.read_text();a=s.index("    await expect(page.getByRole('heading', { name: /PulseCheck Provisioning/i }));") if False else s.index("    await expect(page.getByRole('heading', { name: /PulseCheck Provisioning/i })).toBeVisible")
b=s.index('\n  });',a)
s=s[:a]+'''    await expect(page.getByRole('heading', { name: 'Organizations', exact: true })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('navigation', { name: 'Organizations', exact: true })).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Search organizations, teams, pilots, and cohorts' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Partner directory' })).toBeVisible();
    await page.getByRole('button', { name: 'New Organization', exact: true }).click();
    await expect(page.getByRole('dialog', { name: 'Provision organization', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Save & Continue', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Close provisioning', exact: true }).click();
    await expect(page.getByRole('dialog', { name: 'Provision organization', exact: true })).toBeHidden();'''+s[b:];p.write_text(s)
