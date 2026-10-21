from pathlib import Path
import re,json
root=Path.cwd(); preview=root/'work/provisioning-redesign/preview';(preview/'pages/admin').mkdir(parents=True,exist_ok=True)
for name in ['node_modules','public']:
 p=preview/name
 if not p.exists():p.symlink_to(root/name,target_is_directory=True)
(preview/'package.json').write_text('{"private":true}')
(preview/'next.config.js').write_text('module.exports={experimental:{externalDir:true},distDir:".next",typescript:{ignoreBuildErrors:true}}')
(preview/'postcss.config.js').write_text((root/'postcss.config.js').read_text())
(preview/'tailwind.config.js').write_text('module.exports={...require("../../../tailwind.config.js"),content:["./pages/**/*.tsx","../../../src/components/admin/ProgramProductConfiguration.tsx"]}')
(preview/'pages/_app.tsx').write_text('import "../../../../src/index.css"; export default function App({Component,pageProps}) {return <Component {...pageProps}/>;}')
s=(root/'src/pages/admin/pulsecheckProvisioning.tsx').read_text()
replacements={'../../components/auth/AdminRouteGuard':'../../fixture','../../hooks/useUser':'../../fixture','../../api/firebase/config':'../../fixture','../../api/firebase/pulsecheckProvisioning/service':'../../fixture','../../api/firebase/pulsecheckSportConfig':'../../fixture','react-redux':'../../fixture'}
s=re.sub(r"from '([^']+)'",lambda m:"from '"+(replacements[m[1]] if m[1] in replacements else str((root/'src/pages/admin'/m[1]).resolve()) if m[1].startswith('.') else m[1])+"'",s)
(preview/'pages/admin/pulsecheckProvisioning.tsx').write_text(s)
