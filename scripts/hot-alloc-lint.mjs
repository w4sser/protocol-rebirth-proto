#!/usr/bin/env node
// Hot-path allocation lint (v2.22.4). Keeps the per-frame game loop allocation-free to cut GC stutter on mobile.
// A module opts in with a header comment listing its per-frame functions:
//   // @hot frameInner renderFrame renderLabels
// Inside those functions (including nested callbacks) this flags: object/array literals, `new`,
// closures created per call, spread, template literals with expressions, and allocating array helpers
// (.map/.filter/.slice/.concat/Array.from/Object.keys|values|entries).
// Allowlist a line with a trailing/preceding `// hot-ok: <reason>` comment (cold branch, risky fix, etc.),
// or a region between `// hot-ok-begin: <reason>` and `// hot-ok-end`. Every allowlist must say why.
import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';
import * as acorn from 'acorn';import {ancestor as walk,base} from 'acorn-walk';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const ALLOC_CALLS=new Set(['map','filter','slice','concat','flatMap','from','keys','values','entries','split']);
export function lintSource(src,file='<src>'){
  const header=src.match(/^\s*\/\/\s*@hot\b([^\n]*)/m);if(!header)return null;
  const hot=new Set(header[1].trim().split(/[\s,]+/).filter(Boolean));
  const comments=[];const ast=acorn.parse(src,{ecmaVersion:'latest',sourceType:'module',locations:true,onComment:comments,allowHashBang:true});
  const ok=new Set();let blockFrom=null;
  for(const c of comments){const v=c.value.trim();
    if(/^hot-ok-begin\b/.test(v))blockFrom=c.loc.start.line;
    else if(/^hot-ok-end\b/.test(v)&&blockFrom!=null){for(let l=blockFrom;l<=c.loc.start.line;l++)ok.add(l);blockFrom=null;}
    else if(/^hot-ok\b/.test(v)){ok.add(c.loc.start.line);ok.add(c.loc.start.line+1);}}
  const lines=src.split('\n');const found=[];const seen=new Set();
  const report=(node,what)=>{const line=node.loc.start.line;if(ok.has(line))return;const k=line+':'+node.start;if(seen.has(k))return;seen.add(k);found.push({file,line,col:node.loc.start.column+1,what,text:lines[line-1].trim().slice(0,100)});};
  const fnName=n=>n.id?.name??null;
  const hotRoots=[];
  walk(ast,{FunctionDeclaration(n){if(hot.has(fnName(n)))hotRoots.push(n);},VariableDeclarator(n){if(n.id.type==='Identifier'&&hot.has(n.id.name)&&/Function/.test(n.init?.type??'')){n.init.hotName=n.id.name;hotRoots.push(n.init);}}});
  for(const name of hot)if(!hotRoots.some(r=>r.id?.name===name||r.hotName===name))found.push({file,line:1,col:1,what:`@hot function '${name}' not found`,text:''});
  for(const fn of hotRoots){
    walk(fn.body,{
      ObjectExpression:n=>report(n,'object literal'),ArrayExpression:n=>report(n,'array literal'),
      NewExpression:n=>report(n,`new ${n.callee.name??n.callee.property?.name??''}`),
      ArrowFunctionExpression:n=>report(n,'closure (arrow fn)'),FunctionExpression:n=>report(n,'closure (function)'),
      SpreadElement:n=>report(n,'spread'),
      TemplateLiteral:(n,anc)=>{if(n.expressions.length&&anc.at(-2)?.type!=='TaggedTemplateExpression')report(n,'template string');},
      CallExpression:n=>{const p=n.callee.type==='MemberExpression'&&!n.callee.computed?n.callee.property.name:null;if(p&&ALLOC_CALLS.has(p))report(n,`.${p}() allocates`);},
    },base);
  }
  return found;
}
function hotFiles(){const out=[];const scan=d=>{for(const e of fs.readdirSync(d,{withFileTypes:true})){if(['node_modules','.git','test','tests','tools','assets'].includes(e.name))continue;const p=path.join(d,e.name);if(e.isDirectory())scan(p);else if(/\.(m?js)$/.test(e.name)&&/^\s*\/\/\s*@hot\b/m.test(fs.readFileSync(p,'utf8').slice(0,4000)))out.push(p);}};scan(root);return out;}
if(process.argv[1]===fileURLToPath(import.meta.url)){
  const files=hotFiles();let total=0;
  for(const f of files){const r=lintSource(fs.readFileSync(f,'utf8'),path.relative(root,f))||[];total+=r.length;for(const x of r)console.log(`${x.file}:${x.line}:${x.col} ${x.what}  | ${x.text}`);}
  console.log(`hot-alloc-lint: ${files.length} hot module(s), ${total} allocation(s) in per-frame code`);
  if(total)process.exit(1);
}
