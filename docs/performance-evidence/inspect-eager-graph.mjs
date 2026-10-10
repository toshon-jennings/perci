import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, statSync } from 'node:fs';
import { resolve, dirname, basename } from 'node:path';
const require=createRequire(import.meta.url);
const { parse }=require(resolve('release-build/performance-clean-0.50.4/node_modules/acorn'));
const dist=resolve(process.argv[2] || 'release-build/performance-clean-0.50.4', 'dist');
const html=readFileSync(resolve(dist,'index.html'),'utf8');
const entry=html.match(/<script[^>]+type="module"[^>]+src="([^\"]+)"/)?.[1];
if(!entry)throw Error('Compiled entry unavailable');
const chunks=[];const seen=new Set();
function visit(file){
 if(seen.has(file))return;seen.add(file);
 const tree=parse(readFileSync(file,'utf8'),{ecmaVersion:'latest',sourceType:'module'});
 const imports=tree.body.filter(n=>['ImportDeclaration','ExportAllDeclaration','ExportNamedDeclaration'].includes(n.type)&&n.source?.value?.endsWith('.js')).map(n=>resolve(dirname(file),n.source.value));
 chunks.push({file:basename(file),bytes:statSync(file).size,staticImports:imports.map(file => basename(file))});
 for(const dependency of imports)visit(dependency);
}
visit(resolve(dist,entry));
const result={entry:basename(resolve(dist,entry)),entryBytes:chunks[0].bytes,totalStaticJSBytes:chunks.reduce((n,c)=>n+c.bytes,0),chunks,caveat:'AST static import/export reachability; neither parse-time measurement nor runtime execution trace.'};
writeFileSync(process.argv[3] || 'docs/performance-evidence/eager-chunk-graph-0.50.4.json',JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result));
