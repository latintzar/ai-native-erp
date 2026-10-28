import { parse } from '@babel/parser';
/** Explicit guest builds scope authored asset and browser-storage paths; ordinary builds are unchanged. */
export function guestAssets() {
  const prefix = (process.env.VITE_ATELIER_GUEST_PREFIX || '').trim();
  if (prefix && !/^\/(?:[a-z0-9-]+\/)*[a-z0-9-]+$/.test(prefix)) throw new Error('Invalid guest prefix');
  return {name:'guest-source-scope',enforce:'pre',transform(input,id){
    if (!prefix || !/\/src\/.*\.(?:ts|tsx|js|mjs|json|css)(?:\?.*)?$/.test(id)) return null;
    let code=input.replace(/\/(?:paintings|brand|cedar-artwork|cedar-audio|bodega-artwork|bodega|connection-brands|export-templates|fonts|map)\//g,m=>prefix+m);
    if (!/\.(?:ts|tsx|js|mjs)(?:\?.*)?$/.test(id) || id.endsWith('/guest-storage.mjs'))return code===input?null:{code,map:null};
    if(!/localStorage|sessionStorage|indexedDB|['"]storage['"]/.test(code))return code===input?null:{code,map:null};
    const ast=parse(code,{sourceType:'module',plugins:['typescript','jsx','importAttributes']});const edits=[];
    function visit(node,parent,key){
      if(!node||typeof node!=='object')return;
      if(node.type==='MemberExpression'&&!node.computed&&node.object?.type==='Identifier'&&['window','globalThis'].includes(node.object.name)&&node.property?.type==='Identifier'&&['localStorage','sessionStorage','indexedDB'].includes(node.property.name)){
        edits.push([node.start,node.end,node.property.name==='localStorage'?'__guestLocal':node.property.name==='sessionStorage'?'__guestSession':'__guestIDB']);return;
      }
      if(node.type==='CallExpression'&&node.arguments?.[0]?.type==='StringLiteral'&&node.arguments[0].value==='storage'&&node.callee?.type==='MemberExpression'&&!node.callee.computed&&node.callee.object?.name==='window'&&['addEventListener','removeEventListener'].includes(node.callee.property?.name)){
        edits.push([node.callee.start,node.callee.end,node.callee.property.name==='addEventListener'?'__guestAdd':'__guestRemove']);
      }
      if(node.type==='Identifier'&&['localStorage','sessionStorage','indexedDB'].includes(node.name)){
        const property=(parent?.type==='MemberExpression'&&key==='property'&&!parent.computed)||(parent?.type==='ObjectProperty'&&key==='key'&&!parent.computed);
        const binding=(parent?.type==='VariableDeclarator'&&key==='id')||parent?.type==='ImportSpecifier';
        if(!property&&!binding)edits.push([node.start,node.end,node.name==='localStorage'?'__guestLocal':node.name==='sessionStorage'?'__guestSession':'__guestIDB']);return;
      }
      for(const [k,v] of Object.entries(node)){if(k==='loc'||k==='tokens'||k==='comments')continue;if(Array.isArray(v))v.forEach(x=>visit(x,node,k));else if(v&&typeof v==='object')visit(v,node,k);}
    }
    visit(ast.program,null,'');
    if(edits.length){edits.sort((a,b)=>b[0]-a[0]);for(const [start,end,replacement] of edits)code=code.slice(0,start)+replacement+code.slice(end);
      code="import {guestLocalStorage as __guestLocal,guestSessionStorage as __guestSession,guestAddStorageListener as __guestAdd,guestRemoveStorageListener as __guestRemove,guestIndexedDB as __guestIDB} from '/src/prototypes/cedar/guest-storage.mjs';\n"+code;}
    return code===input?null:{code,map:null};
  }};
}
