import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const ROOT=process.cwd();
const UI_ROOTS=['app'];
const includeFile=(file)=>file.endsWith('.tsx')||file.endsWith('widget.js/route.ts');
const ignoredPath=(file)=>file.includes('/api/')||file.endsWith('/layout.tsx');
const visibleAttrs=new Set(['placeholder','title','aria-label','alt']);
const ignoredAttrs=new Set(['className','href','src','id','key','type','name','value','method','target','rel','accept','role','action','htmlFor','data-no-translate']);
const technical=new Set([
  'NAYROQ','AI','CRM','API','Meta','PayPal','WhatsApp','Instagram','Facebook','Messenger','USD','OMR','SAR','AED','KWD','QAR','BHD','IBAN','ID','N',
  'GET','POST','PUT','PATCH','DELETE','OPTIONS','production','preview','development','sandbox','live','nodejs','active','paused','draft','pending','approved','rejected','trial','trialing','setup','cancelled','expired','suspended','starter','business','growth','sales','support','booking','receptionist','follow_up','collections','auto','text','voice','both','neutral','omani','saudi','emirati','kuwaiti','bahraini','qatari','gulf','msa','professional','friendly','warm','concise','website','whatsapp','instagram','facebook','customer','ai','human','system','open','won','lost','qualified','new','quotation_sent','followup'
]);

function walk(dir,out=[]){
  if(!fs.existsSync(dir))return out;
  for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
    const full=path.join(dir,entry.name);
    if(entry.isDirectory())walk(full,out);else if(includeFile(full)&&!ignoredPath(full))out.push(full);
  }
  return out;
}

function normalize(value){return value.replace(/\s+/g,' ').trim();}
function lineOf(sf,node){const p=sf.getLineAndCharacterOfPosition(node.getStart(sf));return `${p.line+1}:${p.character+1}`;}
function isTechnical(value){
  const s=normalize(value);
  if(!s||!/[A-Za-zÀ-ž\u0600-\u06FF]/u.test(s))return true;
  if(technical.has(s))return true;
  if(/^https?:\/\//i.test(s)||/^mailto:/i.test(s)||/^tel:/i.test(s)||s.startsWith('/')||s.startsWith('@/'))return true;
  if(/^#[0-9a-f]{3,8}$/i.test(s)||/^\d+(?:\.\d+)?$/.test(s))return true;
  if(/^[A-Z0-9_-]{2,}$/.test(s)&&!s.includes(' '))return true;
  if(/^[a-z0-9_./:@-]+$/.test(s)&&!s.includes(' '))return true;
  if(/^\{.*\}$/.test(s))return true;
  return false;
}
function isTCall(node){return ts.isCallExpression(node)&&ts.isIdentifier(node.expression)&&node.expression.text==='t';}
function hasTAncestor(node,stop){let p=node.parent;while(p&&p!==stop){if(isTCall(p))return true;p=p.parent;}return false;}
function addIssue(issues,sf,node,value,kind){const text=normalize(value);if(isTechnical(text))return;issues.push({file:path.relative(ROOT,sf.fileName).replaceAll('\\','/'),loc:lineOf(sf,node),kind,text});}

const issues=[];
for(const file of UI_ROOTS.flatMap(root=>walk(path.join(ROOT,root)))){
  const source=fs.readFileSync(file,'utf8');
  const sf=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,file.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);
  function inspectExpression(expr,container){
    function visit(node){
      if(hasTAncestor(node,container))return;
      if(ts.isStringLiteral(node)||ts.isNoSubstitutionTemplateLiteral(node))addIssue(issues,sf,node,node.text,'jsx-expression');
      ts.forEachChild(node,visit);
    }
    visit(expr);
  }
  function visit(node){
    if(ts.isJsxText(node))addIssue(issues,sf,node,node.getText(sf),'jsx-text');
    if(ts.isJsxAttribute(node)){
      const name=node.name.getText(sf);
      if(node.initializer&&ts.isStringLiteral(node.initializer)&&visibleAttrs.has(name))addIssue(issues,sf,node.initializer,node.initializer.text,`attribute:${name}`);
      if(node.initializer&&ts.isJsxExpression(node.initializer)&&node.initializer.expression&&visibleAttrs.has(name))inspectExpression(node.initializer.expression,node.initializer);
      if(ignoredAttrs.has(name))return;
    }
    if(ts.isJsxExpression(node)&&node.expression)inspectExpression(node.expression,node);
    if(ts.isCallExpression(node)&&ts.isIdentifier(node.expression)&&['alert','confirm','setMsg','setMessage','setError','setStatus'].includes(node.expression.text)){
      for(const arg of node.arguments)if(ts.isStringLiteral(arg)||ts.isNoSubstitutionTemplateLiteral(arg))addIssue(issues,sf,arg,arg.text,`call:${node.expression.text}`);
    }
    ts.forEachChild(node,visit);
  }
  visit(sf);
}

const unique=[];const seen=new Set();
for(const issue of issues){const key=`${issue.file}:${issue.loc}:${issue.text}`;if(!seen.has(key)){seen.add(key);unique.push(issue);}}
unique.sort((a,b)=>a.file.localeCompare(b.file)||a.loc.localeCompare(b.loc));
console.log(`I18N_AUDIT_COUNT=${unique.length}`);
for(const x of unique)console.log(`${x.file}:${x.loc} [${x.kind}] ${JSON.stringify(x.text)}`);
if(unique.length)process.exit(1);
