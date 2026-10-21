import json,urllib.request,pathlib
c=json.loads((pathlib.Path.home()/'Library/Preferences/netlify/config.json').read_text()); token=c['users'][c['userId']]['auth']['token']
base='https://api.netlify.com/api/v1'
def get(path):
 return json.load(urllib.request.urlopen(urllib.request.Request(base+path,headers={'Authorization':'Bearer '+token})))
d=get('/sites/05a6cac5-9994-4883-9e90-5adb69528bda/deploys?per_page=3')
print(json.dumps([{k:p.get(k) for k in ['id','state','commit_ref','created_at','published_at','error_message','build_id']} for p in d],indent=2))
pathlib.Path('work/group-meet-deploy/latest.json').write_text(json.dumps(d))
