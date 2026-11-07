import {fetchJupiterEarnTokens} from "../../packages/arc-data/jupiter-lend.js";
export function createSolanaDiscoveryHandler({read=fetchJupiterEarnTokens,key=()=>process.env.JUPITER_API_KEY}={}) {
  return async (request,response)=>{
    response.setHeader("Cache-Control","no-store");
    if (request.method!=="GET") return response.status(405).json({ok:false,error:"Method not allowed"});
    const result=await read({apiKey:key()});
    return response.status(200).json({ok:true,...result});
  };
}
export default createSolanaDiscoveryHandler();
