import fs from 'node:fs';import {gunzipSync} from 'node:zlib';import {fileURLToPath} from 'node:url';
for(const name of ['cards','document-research']){const file=fileURLToPath(new URL('../data/'+name+'.json',import.meta.url));if(!fs.existsSync(file)&&fs.existsSync(file+'.gz'))fs.writeFileSync(file,gunzipSync(fs.readFileSync(file+'.gz')));}
