// Independent synthetic protocol probe. No requests leave this process.
import assert from 'node:assert/strict';
import { LLMFactory } from '../../src/lib/llm/clients.js';
import brokerModule from '../../electron/model-broker.cjs';
const {createModelBroker, PROVIDERS}=brokerModule;
let captured;
let fixtureMode='text';
let split=false;
const encoder=new TextEncoder();
globalThis.fetch=async(url,init)=>{
  captured={url:String(url),hasSignal:init.signal instanceof AbortSignal};
  if(init.signal?.aborted) throw new DOMException('Aborted','AbortError');
  const body=JSON.parse(init.body);
  let payload, wire;
  const call={name:'fixture',arguments:'{"path":"synthetic"}'};
  if(String(url).includes('generativelanguage')) {
    payload={candidates:[{content:{parts:fixtureMode==='call'?[{functionCall:{name:'fixture',args:{path:'synthetic'}}}]:[{text:'synthetic-ok'}]}}]};
  } else if(String(url).includes('anthropic')||String(url).includes('47821')) {
    if(fixtureMode==='call') {
      wire='data: '+JSON.stringify({type:'content_block_start',index:0,content_block:{type:'tool_use',id:'fixture-call',name:'fixture',input:{}}})+'\n\n'
        +'data: '+JSON.stringify({type:'content_block_delta',index:0,delta:{type:'input_json_delta',partial_json:'{"path":"synthetic"}'}})+'\n\n';
    } else payload={type:'content_block_delta',index:0,delta:{type:'text_delta',text:'synthetic-ok'}};
  } else if(String(url).includes('11434')) {
    payload={message:fixtureMode==='call'?{content:'',tool_calls:[{function:call}]}:{content:'synthetic-ok'},done:true};
  } else {
    payload={choices:[{delta:fixtureMode==='call'?{tool_calls:[{index:0,id:'fixture-call',type:'function',function:call}]}:{content:'synthetic-ok'}}]};
  }
  if(!wire) wire=body.stream===false||String(url).includes(':generateContent')?JSON.stringify(payload)
    :String(url).includes('11434')?JSON.stringify(payload)+'\n':'data: '+JSON.stringify(payload)+'\n\n';
  const bytes=encoder.encode(wire);
  const stream=new ReadableStream({start(controller){
    if(split){const cut=Math.floor(bytes.length/2);controller.enqueue(bytes.slice(0,cut));controller.enqueue(bytes.slice(cut));}
    else controller.enqueue(bytes);
    controller.close();
  }});
  return new Response(stream,{status:200});
};
const broker=createModelBroker({credentialStore:{withCredential:async(_,callback)=>callback('synthetic-not-real-key')},loadFactory:async()=>LLMFactory});
const messages=[{role:'user',content:'synthetic'}];
const toolDefinitions=[{name:'fixture',description:'synthetic',parameters:{path:'path'}}];
const results=[];
for(const provider of PROVIDERS) for(const mode of ['text','tools-text','call','split-text','split-call']) {
  fixtureMode=mode.includes('call')?'call':'text';split=mode.startsWith('split');
  const tools=mode==='text'||mode==='split-text'?null:toolDefinitions;
  const chunks=[];
  try {
    const result=await broker.stream({provider,model:'synthetic-model',messages,tools},e=>chunks.push(e.chunk));
    assert.equal(captured.hasSignal,true);
    if(fixtureMode==='text') assert.equal(chunks.join(''),'synthetic-ok');
    else {
      assert.equal(result.result.toolCalls[0].name,'fixture');
      assert.deepEqual(result.result.toolCalls[0].args,{path:'synthetic'});
    }
    results.push({provider,mode,ok:true});
  } catch(error) { results.push({provider,mode,ok:false,error:error.message}); }
}
// Exercise the actual renderer adapter's already-aborted lifecycle separately.
let streams=0;
globalThis.window={electron:{models:{abort:async()=>false,stream:async()=>{streams++;return {result:'unexpected'};}}}};
const abortController=new AbortController();abortController.abort();
try {
  await assert.rejects(LLMFactory.getClient('openai','').streamChat(messages,()=>{},'synthetic-model',{signal:abortController.signal}),{name:'AbortError'});
  assert.equal(streams,0);
  results.push({provider:'renderer',mode:'pre-abort',ok:true});
} catch(error) {results.push({provider:'renderer',mode:'pre-abort',ok:false,error:error.message,streams});}
console.log(JSON.stringify({passed:results.filter(r=>r.ok).length,total:results.length,failures:results.filter(r=>!r.ok)},null,2));
if(results.some(r=>!r.ok)) process.exitCode=1;
