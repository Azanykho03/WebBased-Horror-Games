import { createRequire } from 'node:module';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const browser=await chromium.launch({headless:true,...(process.env.BROWSER_PATH?{executablePath:process.env.BROWSER_PATH}:{})});
try{const page=await browser.newPage({viewport:{width:1000,height:800}});page.on('pageerror',e=>console.log(String(e)));
await page.goto((process.env.GAME_URL||'http://127.0.0.1:5175')+'/tests/legs-review.html'+(process.argv[2]?'?file='+process.argv[2]:''),{waitUntil:'domcontentloaded',timeout:60000});
await page.waitForFunction(()=>window.loaded,null,{timeout:60000});
for(const [name,angle]of [['front',-Math.PI/2],['side',0],['back',Math.PI/2]]){await page.evaluate(a=>window.camera.alpha=a,angle);await page.waitForTimeout(200);await page.screenshot({path:`tests/legs-${process.argv[2]?'rig':'source'}-${name}.png`});}
console.log('PASS source / rig visual inspection screenshots');}finally{await browser.close();}
