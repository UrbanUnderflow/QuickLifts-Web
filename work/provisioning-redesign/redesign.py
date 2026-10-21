from pathlib import Path
import re
p=Path('src/pages/admin/pulsecheckProvisioning.tsx')
s=p.read_text()
s=s.replace("import ProgramProductConfiguration", "import ui from '../../components/admin/ProvisioningWorkspace.module.css';\nimport ProgramProductConfiguration",1)
s=s.replace("  const [organizationSearch, setOrganizationSearch] = useState('');", "  const [organizationSearch, setOrganizationSearch] = useState('');\n  const [selectedOrganizationId, setSelectedOrganizationId] = useState<string | null>(null);")
s=s.replace("    return organizationBundles.filter(({ organization, teams: bundledTeams }) => {", "    return organizationBundles.filter(({ organization, teams: bundledTeams }) => {\n      if (selectedOrganizationId && organization.id !== selectedOrganizationId) return false;",1)
s=s.replace('[organizationBundles, organizationSearch, organizationStatusFilter]);','[organizationBundles, organizationSearch, organizationStatusFilter, selectedOrganizationId]);',1)
s=s.replace('    setExpandedOrganizationIds(organizations.map((organization) => organization.id));\n    setExpandedTeamIds(teams.map((team) => team.id));', '    // Start with a scannable directory. Explicit selections and deep links open details.\n    setExpandedTeamIds(teams.map((team) => team.id));',1)
s=s.replace('    setIntakeFocusHandled(true);', "    setIntakeFocusHandled(true);\n    const organizationId = teams.find((team) => team.id === focusTeam)?.organizationId;\n    if (organizationId) {\n      setSelectedOrganizationId(organizationId);\n      setExpandedOrganizationIds((current) => Array.from(new Set([...current, organizationId])));\n    }",1)
a=s.index('  const handleToggleAllRows = useCallback(')
b=s.index('  const handleOpenProvisioningModal',a)
s=s[:a]+'''  const allVisibleRowsExpanded = filteredOrganizationBundles.length > 0 && filteredOrganizationBundles.every(
    ({ organization, teams: bundledTeams }) => expandedOrganizationIds.includes(organization.id) &&
      bundledTeams.every(({ team, pilots: bundledPilots }) => !collapsedTeamIds.has(team.id) &&
        bundledPilots.every(({ pilot }) => expandedPilotIds.includes(pilot.id)))
  );
  const handleToggleAllRows = () => {
    const orgIds = filteredOrganizationBundles.map(({ organization }) => organization.id);
    const teamIds = filteredOrganizationBundles.flatMap(({ teams }) => teams.map(({ team }) => team.id));
    const pilotIds = filteredOrganizationBundles.flatMap(({ teams }) => teams.flatMap(({ pilots }) => pilots.map(({ pilot }) => pilot.id)));
    setExpandedOrganizationIds((current) => allVisibleRowsExpanded ? current.filter((id) => !orgIds.includes(id)) : Array.from(new Set([...current, ...orgIds])));
    setExpandedTeamIds((current) => allVisibleRowsExpanded ? current.filter((id) => !teamIds.includes(id)) : Array.from(new Set([...current, ...teamIds])));
    setExpandedPilotIds((current) => allVisibleRowsExpanded ? current.filter((id) => !pilotIds.includes(id)) : Array.from(new Set([...current, ...pilotIds])));
    setCollapsedTeamIds((current) => {
      const next = new Set(current);
      teamIds.forEach((id) => allVisibleRowsExpanded ? next.add(id) : next.delete(id));
      return next;
    });
  };
  const selectOrganization = (organizationId: string | null) => {
    setSelectedOrganizationId(organizationId);
    setOrganizationSearch('');
    setOrganizationStatusFilter('all');
    if (organizationId) setExpandedOrganizationIds((current) => Array.from(new Set([...current, organizationId])));
    document.getElementById('organizations-directory')?.scrollIntoView({ block: 'start' });
  };
  const selectedOrganization = organizations.find((organization) => organization.id === selectedOrganizationId);

'''+s[b:]
# Ensure newly created org isn't hidden by an existing organization selection.
s=s.replace("      setIsProvisioningModalOpen(true);", "      setSelectedOrganizationId(null);\n      setIsProvisioningModalOpen(true);",1)
# Root theme also wraps the shared admin bar; portal roots receive the same variables.
s=s.replace('    <AdminRouteGuard>\n      <div className="min-h-screen bg-[#05070c] text-white">','    <div className={ui.theme}>\n    <AdminRouteGuard>\n      <div className="min-h-screen">',1)
s=s.replace('    </AdminRouteGuard>\n  );','    </AdminRouteGuard>\n    </div>\n  );',1)
a=s.index('          <link rel="preconnect"'); b=s.index('        </Head>',a); s=s[:a]+s[b:]
# Replace dark palette with the coach dashboard's warm, readable palette.
a=s.index('        <style jsx global>'); b=s.index('        `}</style>',a)
css=s[a:b]
for old,new in {'#07090f':'#f7f8f5','#00d4aa':'#356b60','#f5a623':'#895817','#4ade80':'#2f6a48','#60a5fa':'#3c647d','#a78bfa':'#70558c',"'Switzer', sans-serif":"Arial, Helvetica, sans-serif","'DM Mono', monospace":"Arial, Helvetica, sans-serif"}.items(): css=css.replace(old,new)
css=re.sub(r'rgba\(255,\s*255,\s*255,\s*([\d.]+)\)',lambda m: f'rgba(34, 48, 46, {m[1]})',css)
css=css.replace('--t1: rgba(34, 48, 46, 0.95)','--t1: #22302e').replace('--t2: rgba(34, 48, 46, 0.52)','--t2: #5c6862').replace('--t3: rgba(34, 48, 46, 0.28)','--t3: #65716c')
css=css.replace('rgba(7, 9, 15, 0.75)','#fff').replace('rgba(7, 9, 15, 0.88)','#f7f8f5').replace('rgba(10, 13, 22, 0.97)','#fff')
css=re.sub(r'font-size: (9|10|11)px',lambda m:f'font-size: {int(m[1])+2}px',css)
css=css.replace('color: rgba(0, 212, 170, 0.85)','color: var(--teal)').replace('color: #efe7ff','color: #70558c')
css=css.replace('color: #fff','color: var(--t1)').replace('background: rgba(0, 0, 0, 0.22)','background: #fff')
s=s[:a]+css+s[b:]
# All inline content colors also apply in portal editors, with contrast-safe values.
s=re.sub(r"rgba\(255,\s*255,\s*255,\s*([\d.]+)\)",lambda m: ('#65716c' if float(m[1])>=.25 and float(m[1])<.7 else '#22302e' if float(m[1])>=.7 else f'rgba(34,48,46,{m[1]})'),s)
s=s.replace("color: '#fff'", "color: '#22302e'").replace("background: '#0d0d12'", "background: '#fff'").replace("background: '#101017'", "background: '#fff'")
s=s.replace("color: '#00d4aa'", "color: '#356b60'").replace("color: '#f87171'", "color: '#b42335'")
# Add explicit theme to portal backdrops (all four).
s=re.sub(r"(<div\n)(\s*)(style=\{\{ position: 'fixed', inset: 0, zIndex: (?:1000|1100))",r'\1\2className={`${ui.theme} ${ui.portal}`}\n\2\3',s)
# Sidebar replaces duplicate account bar, retaining shared environment/account controls above.
a=s.index('          <div className="pcp-amb-layer">');b=s.index('            <main className="pcp-main">',a)
s=s[:a]+'''          <div className="pcp-shell">
            <aside className={ui.sidebar} aria-label="Provisioning navigation">
              <Link href="/admin" className={ui.wordmark}>PulseCheck<span>ADMIN WORKSPACE</span></Link>
              <div className={ui.account}><span className="pcp-av">{adminInitials || 'PA'}</span><span>{currentUser?.displayName || currentUser?.email || 'Pulse Admin'}<small>Organization management</small></span></div>
              <nav aria-label="Organizations" data-tour="admin-organization-navigation">
                <button type="button" className={ui.navItem} aria-current={!selectedOrganizationId ? 'page' : undefined} onClick={() => selectOrganization(null)}><Building2 size={17} />All organizations<span>{organizations.length}</span></button>
                <div className={ui.navLabel}>Your organizations</div>
                {organizations.map((organization) => <button type="button" key={organization.id} className={ui.navItem} aria-current={selectedOrganizationId === organization.id ? 'page' : undefined} onClick={() => selectOrganization(organization.id)}><span className={ui.orgDot} /><span className={ui.navName}>{organization.displayName}</span></button>)}
              </nav>
              <div className={ui.sidebarFooter}>
                <Link href="/coach/dashboard"><Users2 size={17} />Coach dashboard<ExternalLink size={13} /></Link>
                <Link href="/admin/pulsecheckOnboardingOverview"><ClipboardList size={17} />Onboarding playbook</Link>
                <button type="button" onClick={() => setAdminTourOpen(true)}><Sparkles size={17} />Page walkthrough</button>
              </div>
            </aside>

'''+s[b:]
s=s.replace('<div className="pcp-eyebrow">PulseCheck Admin</div>\n                  <div className="pcp-heading">Organizations</div>', '''<div className="pcp-eyebrow">Provisioning / {selectedOrganization ? 'Organization workspace' : 'Directory'}</div>
                  <h1 className="pcp-heading">{selectedOrganization?.displayName || 'Organizations'}</h1>''',1)
s=s.replace('''                    All partner organizations provisioned in PulseCheck. Each org holds teams, pilots, cohorts, support routes,
                    and onboarding links inside one connected hierarchy.''', '''                    {selectedOrganization ? 'Manage this organization’s teams, onboarding, and program settings.' : 'Set up your partners. Keep teams, onboarding, and program settings in one place.'}''',1)
# Existing stats already provide counts; replace redundant header pills with a clear hierarchy key.
a=s.index('                  <div className="pcp-page-context">'); b=s.index('\n                </div>\n\n                <div className="pcp-head-right"',a)
s=s[:a]+'''                  <div className={ui.hierarchyKey} aria-label="Program structure"><span>Organization</span><span aria-hidden="true">/</span><span>Teams</span><span aria-hidden="true">/</span><span>Pilots</span><span aria-hidden="true">/</span><span>Cohorts</span></div>'''+s[b:]
s=s.replace('onChange={(event) => setOrganizationSearch(event.target.value)}','onChange={(event) => { setOrganizationSearch(event.target.value); setSelectedOrganizationId(null); }}\n                    aria-label="Search organizations, teams, pilots, and cohorts"',1)
for v,label,count in [('all','All','organizationCount'),('prov','Provisioning','provisioningCount'),('ready','Ready','organizationReadyCount'),('active','Active','organizationActiveCount')]:
 s=s.replace(f"onClick={{() => setOrganizationStatusFilter('{v}')}}",f"aria-pressed={{organizationStatusFilter === '{v}'}}\n                    onClick={{() => {{ setOrganizationStatusFilter('{v}'); setSelectedOrganizationId(null); }}}}",1)
 s=s.replace(f'                    {label}\n                  </button>',f'                    {label} <span className={{ui.filterCount}}>{{mapSummary.{count}}}</span>\n                  </button>',1)
s=s.replace('                    Toggle all','                    {allVisibleRowsExpanded ? \'Collapse all\' : \'Expand all\'}',1)
s=s.replace('              <div id="organization-hierarchy"', '''              <div className={ui.directoryHeading}><div><h2>{selectedOrganization ? 'Organization details' : 'Partner directory'}</h2><p>{selectedOrganization ? 'Open a section below to review or update its settings.' : 'Choose an organization to manage its teams and settings.'}</p></div><span role="status">{loading ? 'Loading…' : `${filteredOrganizationBundles.length} of ${organizations.length} organizations`}</span></div>
              <div id="organization-hierarchy"''',1)
s=s.replace('<div className="pcp-empty-panel">No organizations match the current filters.</div>', '''<div className="pcp-empty-panel"><p>No organizations match the current filters.</p><button type="button" className="pcp-btn pcp-btn-ghost" onClick={() => selectOrganization(null)}>Clear filters</button></div>''',1)
s=s.replace('''<div className="pcp-org-hd" onClick={() => toggleOrganizationRow(organization.id)}>
                          <div className="pcp-org-chev"><ChevronDown /></div>''','''<div className="pcp-org-hd">
                          <button type="button" className="pcp-org-chev" aria-expanded={organizationExpanded} aria-label={`${organizationExpanded ? 'Collapse' : 'Expand'} ${organization.displayName}`} onClick={() => toggleOrganizationRow(organization.id)}><ChevronDown /></button>''',1)
s=s.replace('<div className="pcp-org-name">{organization.displayName}</div>','<button type="button" className="pcp-org-name" aria-expanded={organizationExpanded} onClick={() => toggleOrganizationRow(organization.id)}>{organization.displayName}</button>',1)
s=s.replace("organization.productBrand === 'pulsecheck' ? 'PulseCheck' : 'AthleticMind',", "organization.productBrand === 'pulsecheck' ? 'PulseCheck' : organization.productBrand === 'athleticmind' ? 'AthleticMind' : 'Product not selected',",1)
s=s.replace('''                                <MoreHorizontal />''','''                                <MoreHorizontal /><span>Manage admins</span>''',1)
# Make product settings progressive without unmounting unsaved component state.
s=s.replace('''                            <ProgramProductConfiguration configuration={organization}''','''                            <details className={ui.settingsDisclosure}>
                              <summary>Product, app appearance &amp; safety settings<span>Program identity, branding, and journal screening</span></summary>
                            <ProgramProductConfiguration configuration={organization}''',1)
s=s.replace('''                            <div className="pcp-org-grid">''','''                            </details>
                            <div className="pcp-org-grid">''',1)
# Replace hierarchy div click targets with real buttons, leave actions as siblings.
for entity,toggle,expanded,name in [('team','toggleTeamCollapsed(team.id)','!teamCollapsed','team.displayName'),('pilot','togglePilotRow(pilot.id)','pilotExpanded','pilot.name')]:
 s=s.replace(f"                                    onClick={{() => {toggle}}}\n",'',1) if entity=='team' else s.replace(f"                                              onClick={{() => {toggle}}}\n",'',1)
 # Chevron has existing style; wrap it in a proper disclosure button.
 anchor='className="pcp-team-hd"'; pos=s.index(f'key={entity}.id') if False else s.index('id={`pcp-team-${team.id}`}') if entity=='team' else s.index('key={pilot.id} className="pcp-card pcp-pilot-card"')
 st=s.index('                                    <ChevronDown',pos) if entity=='team' else s.index('                                              <ChevronDown',pos)
 en=s.index('/>',st)+2
 s=s[:st]+f'<button type="button" className={{ui.disclosureButton}} aria-expanded={{{expanded}}} aria-label={{`Toggle ${{{name}}}`}} onClick={{() => {toggle}}}>\n'+s[st:en]+'</button>'+s[en:]
 s=s.replace(f'<div className="pcp-t-name">{{{name}}}</div>',f'<button type="button" className="pcp-t-name" aria-expanded={{{expanded}}} onClick={{() => {toggle}}}>{{{name}}}</button>',1)
# Accessible card disclosures; prevent nested actions' keyboard events toggling parent.
s=s.replace('      role="button"\n      tabIndex={0}', '      role="button"\n      aria-expanded={open}\n      tabIndex={0}',1)
s=s.replace("      onKeyDown={(e) => {\n        if", "      onKeyDown={(e) => {\n        if (e.target !== e.currentTarget) return;\n        if",1)
# Hide closed wizard from keyboard and accessibility tree, retain drafts and form refs.
s=s.replace("className={`pcp-modal-bg ${isProvisioningModalOpen ? 'open' : ''}`} onClick", "className={`pcp-modal-bg ${isProvisioningModalOpen ? 'open' : ''}`} style={{ visibility: isProvisioningModalOpen ? 'visible' : 'hidden' }} onClick",1)
s=s.replace('<div className="pcp-modal" onClick=', '<div className="pcp-modal" role="dialog" aria-modal="true" aria-label="Provision organization" onClick=',1)
s=s.replace('<button type="button" className="pcp-modal-x" onClick={handleCloseProvisioningModal}>','<button type="button" className="pcp-modal-x" aria-label="Close provisioning" onClick={handleCloseProvisioningModal}>',1)
s=s.replace('<div className="pcp-modal-title">Provision New Organization</div>', '<div className="pcp-modal-title">{activeWizardStep === \'org\' ? \'New organization\' : currentWizardStepLabel}</div>',1)
s=s.replace("title=\"Team Commercial Config\"", "title=\"Billing & subscriptions\"")
s=s.replace("title=\"Support Route + Activation\"", "title=\"Support & admin activation\"")
# Repair tour references to match actual navigation; no dead target steps.
s=s.replace('[data-tour="admin-team-tracker"]','[data-tour="admin-organization-navigation"]').replace('Monitor launch readiness visually','Switch between organizations').replace('The tracker is intentionally simple: one progress bar, four status labels, and one dropdown per launch step.','Use the sidebar to focus on one organization. All organizations returns you to the full directory.')
s=s.replace('[data-tour="admin-launch-day-link"]','[data-tour="admin-provisioning-actions"]').replace('Use Launch-Day Mode in the room','Continue setting up your program').replace('Open this during Meeting 3 to track athlete invites, setup, device status, and next action while the team is present.','New Organization guides you through the organization, team, support route, admin activation, pilot, and cohort. Add Team and Add Pilot let you extend existing programs.')
s=s.replace('and tracker status.','and program settings.')
p.write_text(s)
