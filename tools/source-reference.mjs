/** Static TypeScript symbol navigation; no application modules are executed. */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
const root=process.cwd();
const require=createRequire(resolve(root,'app/package.json'));
const {parse}=require('@babel/parser');
const modules=[];
for(const file of process.argv.slice(2)){
  const ast=parse(readFileSync(resolve(root,file),'utf8'),{sourceType:'unambiguous',plugins:['typescript',...(file.endsWith('.tsx')?['jsx']:[])]});
  const symbols=[];
  function walk(node,scope=[]){
    if(!node||typeof node!=='object')return;
    let next=scope;
    const declaration=['FunctionDeclaration','ClassDeclaration','TSInterfaceDeclaration','TSTypeAliasDeclaration','TSEnumDeclaration'].includes(node.type);
    if(declaration&&node.id?.name){
      symbols.push({name:[...scope,node.id.name].join('.'),kind:node.type,line:node.loc.start.line});
      if(['FunctionDeclaration','ClassDeclaration'].includes(node.type))next=[...scope,node.id.name];
    }else if(['ClassMethod','ObjectMethod'].includes(node.type)&&node.key?.name){
      symbols.push({name:[...scope,node.key.name].join('.'),kind:node.type,line:node.loc.start.line});next=[...scope,node.key.name];
    }else if(node.type==='VariableDeclarator'&&node.id?.name&&['ArrowFunctionExpression','FunctionExpression'].includes(node.init?.type)){
      symbols.push({name:[...scope,node.id.name].join('.'),kind:'FunctionValue',line:node.loc.start.line});next=[...scope,node.id.name];
    }
    for(const [key,value]of Object.entries(node)){
      if(['loc','start','end','extra','comments','tokens'].includes(key))continue;
      if(Array.isArray(value))value.forEach(item=>walk(item,next));else if(value&&typeof value==='object')walk(value,next);
    }
  }
  walk(ast.program);
  modules.push({path:file,language:'TypeScript',summary:'',symbols});
}
process.stdout.write(JSON.stringify(modules));
