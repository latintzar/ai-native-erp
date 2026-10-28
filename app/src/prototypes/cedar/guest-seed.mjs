/** One-time public-preview posture using Cedar's existing native browser-store schema. */
export const previewSeedKey='atelier-erp-preview-seed:v1';
export function initializePreviewWorkspace(storage){
  const configKey='rocoto-app-config',doorKey='rocoto-app-front-door',capabilityKey='rocoto-workspace-capabilities:fish';
  try{
    if(storage.getItem(previewSeedKey)!==null)return false;
    // Existing visitor choices own the whole workspace; add no native state to that browser.
    if([configKey,doorKey,capabilityKey].some(key=>storage.getItem(key)!==null))return false;
    storage.setItem(configKey,JSON.stringify({version:1,sector:['fish'],cast:'fish'}));
    storage.setItem(doorKey,'months');
    storage.setItem(capabilityKey,JSON.stringify({version:1,pricing:true,inventory:true,money:false,country:'spain',moneyByCountry:{peru:true,spain:false}}));
    storage.setItem(previewSeedKey,'spain-fish-established');
    return true;
  }catch{return false;}
}
