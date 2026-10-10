import {build} from 'esbuild';
import ts from 'typescript';
import fs from 'node:fs/promises';
const sync = context => root => {
 const visit=node=>{
  if(ts.isAwaitExpression(node))return ts.visitNode(node.expression,visit);
  if(node.kind===ts.SyntaxKind.AsyncKeyword)return undefined;
  return ts.visitEachChild(node,visit,context);
 };
 return ts.visitNode(root,visit);
};
await build({entryPoints:['google-backend/entry.js'],bundle:true,format:'iife',globalName:'KDFY',target:'es2020',outfile:'google-backend/Code.gs',minify:true,banner:{js:'var GAS_ENV = {};'},plugins:[{name:'synchronous-apps-script',setup(b){
 b.onLoad({filter:/\.(ts|js)$/},async args=>{
  if(args.path.includes('node_modules')||args.path.includes('/vendor/'))return;
  let source=await fs.readFile(args.path,'utf8');
  source=source.replace(/import \{env\} from 'cloudflare:workers';/g,'const env = GAS_ENV;');
  if(args.path.endsWith('/app/api/action/route.ts'))source=source.replace(/async function hash\(p:string,s:string\)\{.*?\}\n/, 'function hash(p:string,s:string){return GAS_HASH(p,s)}\n');
  if(args.path.endsWith('/app/api/finance/route.ts'))source=source.replace(/const digest=async.*?;\n/, 'const digest=(s:string)=>GAS_DIGEST(s);\n').replace('Promise.all([','GAS_ALL([');
  const result=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.ESNext},transformers:{before:[sync]}});
  return {contents:result.outputText,loader:'js'};
 });
}}]});
await fs.appendFile('google-backend/Code.gs','\nfunction doGet(e){return KDFY.doGet(e)}\nfunction doPost(e){return KDFY.doPost(e)}\nfunction initializeWorkspace(){return KDFY.initializeWorkspace()}\n');
