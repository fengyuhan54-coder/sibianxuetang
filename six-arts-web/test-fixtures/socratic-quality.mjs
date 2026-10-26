// A stub verdict exercises gate behavior; it does not replace live semantic acceptance.
export function qualityResult(issues=[]){
 return JSON.stringify({checks:['grounding','focus','openness','analogy','continuity','review'].map((id,i)=>({id,pass:!issues.length||i!==0,reason:issues.length&&i===0?issues[0]:'This fixture approves this criterion.'})),pass:!issues.length,issues});
}
