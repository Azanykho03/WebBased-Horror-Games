// Real imported skins / IK and camera validation in an isolated local browser.
import { createRequire } from 'node:module';
import { writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_PATH || 'playwright');
const browser = await chromium.launch({ headless:true, ...(process.env.BROWSER_PATH ? {executablePath:process.env.BROWSER_PATH} : {}), args:['--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({viewport:{width:1280,height:720},hasTouch:true});
const report=[], errors=[];
page.on('pageerror', e=>errors.push(String(e)));
async function sample(name, screenshot=true) {
  const value=await page.evaluate(() => {
    const h=window.grabValidation, B=window.BABYLON, legs=h.world.legs;
    const contacts=legs.contacts.map(p=>p.asArray()), grips=h.grabPresentation.gripTargets.map(p=>p.asArray());
    const dist=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
    const error=Math.min(Math.max(dist(contacts[0],grips[0]),dist(contacts[1],grips[1])),Math.max(dist(contacts[0],grips[1]),dist(contacts[1],grips[0])));
    let minY=Infinity, maxY=-Infinity, finite=true;
    legs.skeleton.prepare();
    for(const mesh of legs.meshes) {
      const v=mesh.getPositionData(true,true), m=mesh.computeWorldMatrix(true);
      for(let i=0;i<v.length;i+=3) {
        const p=B.Vector3.TransformCoordinates(B.Vector3.FromArray(v,i),m);
        minY=Math.min(minY,p.y); maxY=Math.max(maxY,p.y); finite&&=Number.isFinite(p.x+p.y+p.z);
      }
    }
    return {phase:h.grab.phase,time:h.grab.time,remaining:h.grab.remaining,attempts:h.grab.attempts,required:h.grab.required,
      body:{...h.player.position},eye:h.player.eye,view:h.world.camera.position.asArray(),pitch:h.player.pitch,
      ghost:{...h.ghost.position},contacts,grips,error,minY,maxY,finite,
      bones:legs.skeleton.bones.length,vertices:legs.meshes.reduce((n,m)=>n+m.getTotalVertices(),0),
      joints:legs.skeleton.bones.map(b=>({name:b.name,q:b.getTransformNode()?.rotationQuaternion?.asArray()}))};
  });
  report.push({name,...value});
  if(screenshot) await page.screenshot({path:`tests/leg-${name}.png`});
  return value;
}
async function phase(name,time=0) {
  await page.waitForFunction(({name,time})=>window.grabValidation.grab.phase===name&&window.grabValidation.grab.time>=time,{name,time},{timeout:15000});
}
try {
  await page.goto(process.env.GAME_URL||'http://127.0.0.1:5175',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.grabValidation,null,{timeout:60000});
  await page.getByRole('button',{name:/Enter the house|Start a new night/}).click();
  await page.evaluate(()=>{
    const h=window.grabValidation;h.action('new');h.action('difficulty:easy');h.action('start-game');h.action('skip-intro');
    h.progress().collected=['flashlight','note'];h.world.syncProgress(h.progress());h.world.viewmodel.reset(true);h.player.flashlight=true;
    h.player.position={x:0,y:0,z:-8,level:0};h.player.yaw=0;h.player.pitch=-1.1;h.player.halt(h.world);
    h.ghost.grace=100;h.ghost.position={x:0,y:0,z:-14,level:0};h.world.ghost.setEnabled(true);h.input.setTouchMode(false);
    document.querySelector('aside[aria-label="Development validation"]').hidden=true;
  });
  await page.waitForTimeout(150);await sample('standing');
  await page.keyboard.down('w'); await page.waitForTimeout(170); const walking=await sample('walking');
  await page.keyboard.down('Shift'); await page.waitForTimeout(120); const running=await sample('running');
  await page.keyboard.press('Space'); await page.waitForTimeout(140); const jumping=await sample('jumping');
  await page.keyboard.up('w');await page.keyboard.up('Shift');
  assert(jumping.body.y>.1);assert.notDeepEqual(walking.joints,running.joints);assert.notDeepEqual(running.joints,jumping.joints);
  await page.waitForFunction(()=>window.grabValidation.player.grounded);await sample('landing');
  await page.evaluate(()=>{const h=window.grabValidation;h.player.position={x:0,y:0,z:-8,level:0};h.player.halt(h.world);});
  await page.evaluate(()=>{const h=window.grabValidation;h.ghost.state='Chase';h.ghost.grace=0;h.ghost.yaw=Math.PI;h.ghost.position={x:0,y:0,z:-9.02,level:0};h.world.corazon.updateLocomotion(0,h.ghost,h.settings());});
  await phase('grab-start'); await sample('reach');
  await phase('falling',.4); const falling=await sample('fall');assert(falling.minY>-.02);assert(falling.error<.05);
  await phase('dragging',.25); const dragging=await sample('drag');assert(dragging.minY>-.02);assert(dragging.error<.05);
  await phase('struggling'); const held=await sample('ground');
  assert.equal(held.bones,7);assert(held.finite);assert(held.minY>-.02&&held.minY<.06,'Ground pose must rest near the floor');assert(held.error<.08,`Ankle grip error ${held.error}`);
  await page.keyboard.press('e'); await page.waitForTimeout(90); const left=await sample('kick-left');assert(left.error<.05);
  await page.keyboard.press('e'); await page.waitForTimeout(90); const right=await sample('kick-right');assert(right.error<.05);
  for(let i=2;i<8;i++)await page.keyboard.press('e');
  await phase('escape-kick',.12);await sample('final-kick');
  await phase('recovery',.4);await sample('recovery');
  await phase('idle');await sample('restored');
  await page.evaluate(()=>{const h=window.grabValidation;h.action('menu');h.action('new');h.action('difficulty:hard');h.action('start-game');h.action('skip-intro');h.input.setTouchMode(true);
    h.progress().collected=['flashlight','note'];h.progress().kitchenSeen=true;h.world.syncProgress(h.progress());h.world.viewmodel.reset(true);h.player.flashlight=true;
    h.player.position={x:0,y:0,z:-8,level:0};h.player.halt(h.world);h.player.yaw=.8;h.player.pitch=.2;
    h.ghost.state='Chase';h.ghost.grace=0;h.ghost.yaw=Math.PI;h.ghost.position={x:0,y:0,z:-9.02,level:0};h.world.ghost.setEnabled(true);});
  await page.setViewportSize({width:844,height:390});
  for(let attempt=1;attempt<=4;attempt++) {
    await phase('struggling');const state=await sample(`touch-grab-${attempt}`,attempt===1);
    assert.equal(state.attempts,attempt);assert.equal(state.required,16+(attempt-1)*4);assert(state.remaining>Math.max(4,5-(attempt-1)*.5)-.5);
    for(let i=0;i<state.required;i++)await page.locator('.struggle-tap').tap();
    await phase('idle');
    if(attempt===1){await page.setViewportSize({width:390,height:844});await page.waitForTimeout(80);await page.setViewportSize({width:844,height:390});}
  }
  await page.evaluate(()=>{const h=window.grabValidation;h.action('retry');});
  assert.equal(await page.evaluate(()=>window.grabValidation.grab.attempts),0);
  assert.deepEqual(errors,[]);
  console.log('PASS imported rig, walking/running/jumping/landing, floor clearance, ankle grip, kicks/recovery and four progressive Hard touch grabs with retry reset');
} catch(e) {console.log(e.stack);process.exitCode=1;await sample('failure').catch(()=>{});}
finally {await writeFile('tests/leg-grab-browser-report.json',JSON.stringify({errors,report},null,2)+'\n');await browser.close();}
