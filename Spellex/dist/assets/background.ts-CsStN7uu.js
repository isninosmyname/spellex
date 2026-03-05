const i=e=>`You are a highly advanced context-aware spelling and grammar corrector.
Your goal is to STRICTLY correct ONLY spelling, typos, and basic grammar mistakes.
${e!=="auto"?`CRITICAL: The user intends to write in **${e.toUpperCase()}**. Correct the text to be proper ${e}. If the text is clearly another language, translate/correct it into ${e}.`:"Detect the language of the provided text and correct it in that same language."}
DO NOT change the structure, tone, or meaning of the text.
Return the output EXACTLY as a JSON array of correction objects, even if there is only one correction.
Do not wrap it in markdown block. Just pure JSON.

Format:
[
  { "original": "teh", "corrected": "the" },
  { "original": "escirbiendo", "corrected": "escribiendo" }
]

If no errors are found, return an empty array: []
`;async function l(e,a,o="auto"){if(!a)return{success:!1,corrections:[],error:"API Key is missing."};try{const t=await fetch("https://openrouter.ai/api/v1/chat/completions",{method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+a,"HTTP-Referer":"https://github.com/spellex/spellex","X-Title":"Spellex Extension"},body:JSON.stringify({model:"openrouter/free",messages:[{role:"system",content:i(o)},{role:"user",content:'Review this text: "'+e+'"'}],temperature:.1})});if(!t.ok)throw new Error("OpenRouter API error: "+t.status);let r=(await t.json()).choices[0]?.message?.content||"";r.trim().startsWith("```")&&(r=r.replace(/\`\`\`json/g,"").replace(/\`\`\`/g,"").trim());let n=[];try{n=JSON.parse(r)}catch{throw console.error("Failed to parse AI response as JSON",r),new Error("AI returned invalid format.")}return{success:!0,corrections:n}}catch(t){return console.error("Error in AI check:",t),{success:!1,corrections:[],error:t.message}}}chrome.runtime.onInstalled.addListener(()=>{console.log("Spellex installed and ready!")});chrome.runtime.onMessage.addListener((e,a,o)=>{if(e.type==="CHECK_TEXT"){const t=e.payload.text;return chrome.storage.sync.get(["openrouterApiKey","targetLanguage"],async s=>{const r=s.openrouterApiKey,n=s.targetLanguage||"auto";if(!r){o({success:!1,error:"Please set your OpenRouter API key in the extension options."});return}const c=await l(t,r,n);o(c)}),!0}});
