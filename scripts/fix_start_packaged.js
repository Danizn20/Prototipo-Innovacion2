const fs = require('fs');
const paths = ['Backend/start-packaged.js', 'PrototipoPortable/Backend/start-packaged.js'];
paths.forEach(p => {
  if (!fs.existsSync(p)) { console.log('not found', p); return; }
  let s = fs.readFileSync(p, 'utf8');
  s = s.replace("process.env.APPDATA || path.join(process.env.USERPROFILE || 'C:\\\\', 'AppData', 'Roaming')",
                "process.env.APPDATA || path.join(process.env.USERPROFILE || 'C:\\\\\\\\', 'AppData', 'Roaming')");
  fs.writeFileSync(p, s, 'utf8');
  console.log('patched', p);
});
