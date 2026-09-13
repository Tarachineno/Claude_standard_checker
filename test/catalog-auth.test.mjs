import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPair, SignJWT, createLocalJWKSet, exportJWK } from 'jose';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { verifyCatalogIdentity, accessConfiguration, CATALOG_ORIGIN } from '../src/lib/catalog-auth.js';
import app from '../src/index.js';
import { env } from './helpers.mjs';

const config={issuer:'https://catalog-test.cloudflareaccess.com',audience:'a'.repeat(64)};
const pair=await generateKeyPair('RS256');
const jwk={...await exportJWK(pair.publicKey),kid:'fixture-key',alg:'RS256'};
const keys=createLocalJWKSet({keys:[jwk]});
const claims={sub:'individual-identity',email:'operator@sgs.com',type:'app'};
const token=async(overrides={})=>new SignJWT({...claims,...overrides}).setProtectedHeader({alg:'RS256',kid:'fixture-key'}).setIssuer(config.issuer).setAudience(config.audience).setIssuedAt().setExpirationTime('10m').sign(pair.privateKey);
const bindings={...env,CATALOG_AUTH_MODE:'access',CATALOG_ACCESS_TEAM_DOMAIN:config.issuer,CATALOG_ACCESS_AUD:config.audience,CATALOG_ADMIN_TOKEN:'old-key'};

test('email identity verifies signed claims and exact domain, without accepting lookalikes or service identities',async()=>{
  const identity=await verifyCatalogIdentity(await token({email:'OPERATOR@SGS.COM'}),config,keys);
  assert.deepEqual(identity,{id:claims.sub,email:'operator@sgs.com',method:'access'});
  for(const email of ['operator@sgs.com.evil.test','operator@evilsgs.com','operator@sub.sgs.com','operator@example.com','@sgs.com'])
    await assert.rejects(verifyCatalogIdentity(await token({email}),config,keys));
  for(const overrides of [{type:'service'},{sub:''},{email:null}]) await assert.rejects(verifyCatalogIdentity(await token(overrides),config,keys));
  const good=await token();
  await assert.rejects(verifyCatalogIdentity(good,{...config,audience:'b'.repeat(64)},keys));
  await assert.rejects(verifyCatalogIdentity(good,{...config,issuer:'https://another.cloudflareaccess.com'},keys));
  const expired=await new SignJWT(claims).setProtectedHeader({alg:'RS256',kid:jwk.kid}).setIssuer(config.issuer).setAudience(config.audience).setIssuedAt().setExpirationTime(1).sign(pair.privateKey);
  await assert.rejects(verifyCatalogIdentity(expired,config,keys));
  const forged=good.split('.'); forged[1]=Buffer.from(JSON.stringify({...claims,email:'forged@sgs.com'})).toString('base64url');
  await assert.rejects(verifyCatalogIdentity(forged.join('.'),config,keys));
});

test('missing configuration is fail-closed and Access mode never falls back to the old administration key',async()=>{
  for(const overrides of [{CATALOG_ACCESS_AUD:''},{CATALOG_ACCESS_TEAM_DOMAIN:'https://evil.test'},{CATALOG_ACCESS_TEAM_DOMAIN:'https://team.cloudflareaccess.com.evil.test'},{CATALOG_ACCESS_TEAM_DOMAIN:'http://team.cloudflareaccess.com'}])
    assert.throws(()=>accessConfiguration({...bindings,...overrides}));
  const headers={'Content-Type':'application/json',Origin:CATALOG_ORIGIN,Authorization:'Bearer old-key','Cf-Access-Authenticated-User-Email':'fake@sgs.com'};
  const request=(url,extra={},settings=bindings)=>app.request(url,{method:'POST',headers:{...headers,...extra},body:'{}'},settings);
  for(const path of ['/api/catalog/manual','/api/catalog/clear-manual','/.netlify/functions/catalog/manual']) {
    assert.equal((await request(CATALOG_ORIGIN+path)).status,401);
    assert.equal((await request(CATALOG_ORIGIN+path,{Origin:'https://evil.test'})).status,403);
    assert.equal((await request('https://lab-scope-checker.seidaku.workers.dev'+path)).status,403);
    assert.equal((await request(CATALOG_ORIGIN+path,{}, {...bindings,CATALOG_ACCESS_AUD:''})).status,503);
  }
  assert.equal((await app.request(CATALOG_ORIGIN+'/api/catalog/login',{},env)).status,503);
});

test('Access session and authenticated writes verify the actual signed JWT; identity stays out of public history',async t=>{
  t.mock.method(globalThis,'fetch',async url=>{
    assert.equal(String(url),config.issuer+'/cdn-cgi/access/certs');
    return Response.json({keys:[jwk]});
  });
  const sqlite=new DatabaseSync(':memory:');
  for(const file of ['0001_init.sql','0002_publisher_catalog.sql','0003_publisher_reviews.sql','0004_publisher_lifecycle.sql','0005_publisher_admin_audit.sql']) sqlite.exec(readFileSync(new URL('../migrations/'+file,import.meta.url),'utf8'));
  const DB={prepare(sql){const statement=sqlite.prepare(sql);let args={};return {bind(...values){args=Object.fromEntries(values.map((v,i)=>[String(i+1),v]));return this;},async all(){return {results:statement.all(args)};},async first(){return statement.get(args)||null;},async run(){return {meta:{changes:Number(statement.run(args).changes)}};}};},async batch(list){sqlite.exec('BEGIN');try{const result=await Promise.all(list.map(s=>s.run()));sqlite.exec('COMMIT');return result;}catch(error){sqlite.exec('ROLLBACK');throw error;}}};
  try{
    const jwt=await token(),headers={Cookie:'CF_Authorization='+jwt,Origin:CATALOG_ORIGIN,'Content-Type':'application/json'};
    const settings={...bindings,DB};
    const session=await app.request(CATALOG_ORIGIN+'/api/catalog/auth',{headers},settings);
    assert.equal(session.headers.get('Cache-Control'),'no-store');
    assert.equal(session.headers.get('Access-Control-Allow-Origin'),null);
    assert.equal((await session.json()).data.user.email,claims.email);
    assert.equal((await app.request(CATALOG_ORIGIN+'/api/catalog/login',{headers},settings)).status,302);
    const payload={reference:'EN 55032',edition:'2015',source_url:'https://standards.cencenelec.eu/',note:'Test only'};
    assert.equal((await app.request(CATALOG_ORIGIN+'/api/catalog/manual',{method:'POST',headers,body:JSON.stringify(payload)},settings)).status,200);
    assert.equal((await app.request(CATALOG_ORIGIN+'/api/catalog/clear-manual',{method:'POST',headers,body:JSON.stringify({key:'EN:55032'})},settings)).status,200);
    const rows=sqlite.prepare('SELECT * FROM publisher_admin_audit ORDER BY id').all();
    assert.deepEqual(rows.map(r=>r.action),['manual','clear_manual']);
    assert.ok(rows.every(r=>r.actor_email===claims.email&&r.actor_id===claims.sub));
    const history=await app.request(CATALOG_ORIGIN+'/api/catalog/history?key=EN:55032',{},settings);
    assert.ok(!(await history.text()).includes(claims.email));
  } finally {sqlite.close();}
});
