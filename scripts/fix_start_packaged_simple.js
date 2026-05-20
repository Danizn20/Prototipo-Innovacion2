const fs=require('fs');
const paths=['Backend/start-packaged.js','PrototipoPortable/Backend/start-packaged.js'];
paths.forEach(p=>{
  if(!fs.existsSync(p)){console.log('not found',p);return}
  let s=fs.readFileSync(p,'utf8');
  const old="'C:\\'"; // literal sequence '\\' in JS string becomes '\\' -> represents '\' in file? Careful
  // However file currently contains 'C:\' (one backslash). We will replace both possible variants.
  s = s.replace(/'C:\\/g, "'C:\\\\\\\\");
  // above: replace 'C:\ with 'C:\\\\ (makes two backslashes in file)
  fs.writeFileSync(p,s,'utf8');
  console.log('patched',p);
});
