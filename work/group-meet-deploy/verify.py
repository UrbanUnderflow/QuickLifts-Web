import json,pathlib,urllib.request,re
base='https://fitwithpulse.ai'
c=json.loads((pathlib.Path.home()/'Library/Preferences/netlify/config.json').read_text());t=c['users'][c['userId']]['auth']['token']
s=json.load(urllib.request.urlopen(urllib.request.Request('https://api.netlify.com/api/v1/sites/05a6cac5-9994-4883-9e90-5adb69528bda',headers={'Authorization':'Bearer '+t})))
p=s['published_deploy']; assert p['commit_ref'].startswith('05e571890'), 'Expected release not yet published'
r=urllib.request.urlopen(base+'/admin/groupMeet');html=r.read().decode()
urls=re.findall(r'<script[^>]+src="([^"]+)"',html)
chunks='\n'.join(urllib.request.urlopen(base+u).read().decode() for u in urls if u.startswith('/_next/static/'))
checks={key:key in chunks for key in ['Save title','group-meet-calendar-result','Host availability saved. Request updated.','Finish']}
assert all(checks.values()),checks
result={'deploymentId':p['id'],'commit':p['commit_ref'],'state':p['state'],'publishedAt':p['published_at'],'route':base+'/admin/groupMeet','httpStatus':r.status,'assetChecks':checks}
pathlib.Path('work/group-meet-deploy/verified.json').write_text(json.dumps(result,indent=2));print(json.dumps(result,indent=2))
