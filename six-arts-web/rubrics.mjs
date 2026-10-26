// Platform formative rubrics, not a standardized psychological scale or teacher-approved measurement.
export const rubrics={
 socratic:[['clarity','概念清晰','能界定关键词并保持含义一致'],['reasons','理由与证据','给出与主张相关的理由，区分证据与猜测'],['logic','逻辑自洽','说明推理关系，识别跳跃或冲突'],['assumptions','前提检验','辨认隐含假设及其成立条件'],['alternatives','多元与边界','公平考虑其他解释及结论边界'],['reflection','反思修正','说明保留或修订判断的依据']],
 argument:[['sufficiency','充分性','理由的数量和强度足以支撑限定后的结论'],['relevance','相关性','论据直接回应待证明的主张'],['reliability','可靠性','证据来源可追溯并区分已核验与待核验'],['clarity','清晰性','概念、主张、前提与结论表达明确'],['logic','逻辑性','推理衔接合理，隐含前提明确']],
 profile:[['concept','概念掌握','能复述并应用概念'],['argument','论证质量','能组织并检查论证'],['fallacy','谬误识别','能指出推理缺口并说明理由'],['perspectives','多元视角','能准确理解异见与价值前提'],['reflection','元认知','能说明自己的判断依据并反思']]
};
export const ratingScale=['0：作答中明确出现核心误解','1：能触及要点，但仍有关键缺口','2：基本准确，理由或边界需补充','3：准确且有理由，能说明适用条件','4：准确、充分，并主动检验反例或修订依据'];
export function validRatings(raw,kind,records){
 const dims=rubrics[kind];if(!Array.isArray(raw)||raw.length!==dims.length)throw new Error('评分维度不完整，请重试。');
 return dims.map(([id,label,criterion])=>{const d=raw.find(x=>x.id===id);if(!d||typeof d.reason!=='string'||!d.reason.trim()||!(d.score===null||Number.isInteger(d.score)&&d.score>=0&&d.score<=4))throw new Error('评分维度不完整，请重试。');const grounded=Number.isInteger(d.record)&&d.record>=0&&d.record<records.length&&typeof d.quote==='string'&&d.quote.trim()&&records[d.record].includes(d.quote);if(d.score!==null&&!grounded)throw new Error('评分缺少可核对的原话依据，请重试。');return {id,label,criterion,score:d.score,record:grounded?d.record:null,quote:grounded?d.quote:'',reason:d.reason.slice(0,600)};});
}
