import json,urllib.request,pathlib
c=json.loads((pathlib.Path.home()/'Library/Preferences/netlify/config.json').read_text()); token=c['users'][c['userId']]['auth']['token']
base='https://api.netlify.com/api/v1'
def get(path):
 return json.load(urllib.request.urlopen(urllib.request.Request(base+path,headers={'Authorization':'Bearer '+token})))
deploy=get('/deploys/6ad6b6cdb0f0eaf5e52b48ec')
result={k:deploy.get(k) for k in ['id','state','commit_ref','published_at','error_message']}
if deploy.get('state')=='ready':
 functions=get('/sites/05a6cac5-9994-4883-9e90-5adb69528bda/functions')
 functions=functions.get('functions',[]) if isinstance(functions,dict) else functions
 result['function']=[f for f in functions if f.get('n',f.get('name'))=='scheduled-organization-deletion']
 result['published_deploy_id']=get('/sites/05a6cac5-9994-4883-9e90-5adb69528bda').get('published_deploy',{}).get('id')
 pathlib.Path('work/organization-lifecycle/deploy-verified.json').write_text(json.dumps(result))
print(json.dumps(result))
