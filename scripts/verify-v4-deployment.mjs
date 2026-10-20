import { createPublicClient, http } from 'viem';
import { inspectV4Deployment } from '../server/_v4-preflight.js';

let report;
try {
  const rpc=process.env.ARC_RPC_URL;
  if(!rpc?.startsWith('https://')||!process.env.BOT_V4_CONFIG)throw Error('Missing configuration');
  const config=JSON.parse(process.env.BOT_V4_CONFIG);
  report=await inspectV4Deployment({client:createPublicClient({transport:http(rpc,{timeout:10_000,retryCount:0})}),config,chainId:Number(process.env.BOT_CHAIN_ID),usdc:process.env.BOT_USDC_ADDRESS});
}catch{
  report={schema:'cofferhouse.v4.preflight.v1',status:'BLOCKED',executionEnabled:false,checks:[{id:'configuration',pass:false,detail:'Provide reviewed BOT_V4_CONFIG, BOT_CHAIN_ID, BOT_USDC_ADDRESS and HTTPS ARC_RPC_URL.'}]};
}
// Never print the RPC URL, authentication headers or raw provider errors.
console.log(JSON.stringify(report,null,2));
process.exitCode=report.status==='COMPATIBLE'?0:2;
