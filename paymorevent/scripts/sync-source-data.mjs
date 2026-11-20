import './ensure-card-data.mjs';
import fs from 'node:fs';import {gzipSync} from 'node:zlib';import {fileURLToPath} from 'node:url';
if(process.argv[2]==='build')for(const name of ['cards','document-research']){const file=fileURLToPath(new URL('../data/'+name+'.json',import.meta.url));if(fs.existsSync(file)){const bytes=gzipSync(fs.readFileSync(file));if(!fs.existsSync(file+'.gz')||!fs.readFileSync(file+'.gz').equals(bytes))fs.writeFileSync(file+'.gz',bytes);}}
