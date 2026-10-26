import {knowledge} from './knowledge.mjs';

// Curated teaching notes, not verbatim quotations or a claim to index the full books.
// Page numbers are one-based. Textbook printed page p is PDF page p + 7.
export const documents={
 book:{title:'批判性思维',author:'王彦君 编',file:'批判性思维 王彦君编 北京高等教育出版社2020.03.pdf',kind:'教材',pages:231},
 elder:{title:'批判性思维，善思者的学习之道',author:'李香玉（访谈琳达·埃尔德）',file:'专访批判性思维研究领域权威...判性思维，善思者的学习之道_李香玉.pdf',kind:'访谈',pages:3},
 history:{title:'历史教育对提升大学生批判性思维能力的作用',author:'姚蔼芯',file:'历史教育对提升大学生批判性思维能力的作用_姚蔼芯.pdf',kind:'教学研究',pages:2},
 siop:{title:'基于SIOP模式的大学英语教学对本科生批判性思维影响研究',author:'孙岩',file:'基于SIOP模式的大学英语...对本科生批判性思维影响研究_孙岩.pdf',kind:'教学研究',pages:4},
 classics:{title:'基于经典阅读的大学语文批判性思维培养策略',author:'陈璐',file:'基于经典阅读的大学语文批判性思维培养策略_陈璐.pdf',kind:'教学研究',pages:4},
 review:{title:'文献综述的批判性思维表达及其发展性特征：一项基于社会／认知体裁模型的研究',author:'李晔、付吉',file:'文献综述的批判性思维表达及...于社会_认知体裁模型的研究_李晔.pdf',kind:'教学研究',pages:6},
 disposition:{title:'财经类大学本科生大学英语批判性思维倾向的定量评估',author:'黎畅',file:'财经类大学本科生大学英语批判性思维倾向的定量评估_黎畅.pdf',kind:'教学研究',pages:3},
 flow:{title:'批判性思维思考流程图',author:'',file:'批判性思维思考流程图.pdf',kind:'课程资料',pages:1},
 answers:{title:'《批判性思维》练习题答案',author:'',file:'《批判性思维》练习题答案.pdf',kind:'配套练习',pages:4}
};
function ref(document,chapter,pages,summary){
 const doc=documents[document];
 return {document,title:doc.title,author:doc.author,kind:doc.kind,file:doc.file,chapter,
  printedPages:document==='book'?pages:[],pdfPages:document==='book'?pages.map(p=>p+7):pages,
  summary,description:'依据资料整理，非逐字引文'};
}
const book=(chapter,pages,summary)=>ref('book',chapter,pages,summary);
const elder=summary=>ref('elder','关于思维要素、理智标准与理智美德的访谈',[2],summary);
const criticalRefs=[
 book('第一章 知识与批判 · 第二节 什么是批判',[19,22,23,25],'批判不是单纯否定；要理解、识别、分析和判断，以知识为依据反思观点，并强调合理性、反思性和建构性。'),
 elder('批判性思维既涉及推理的技能，也涉及理智的标准和美德；通过复述、倾听和观察实际推理成果训练与评估。')
];
const enrichments={
 K01:{definition:'以形成清晰、公正且有根据的判断为目标，主动澄清概念、分析论证、评价证据与推理，并反思和修正自身判断的思考方式。',references:criticalRefs,facets:'能力：理解与澄清概念、分析论证、评价证据与推理、形成有条件的判断及自我修正。素养：理智谦逊、同理心、勇气、自主、正直、愿意跟随证据。不要把素养和技能当成同一个维度。',misconceptions:['批判就是反对、挑刺或攻击别人','会说谬误名称就等于会独立思考','任何观点都一样正确'],task:'先用自己的话概括，再比较“见到AI答案就否定”和“核对证据后有条件接受”哪种体现批判性思维，并说明理由。'},
 K02:{references:[book('第四章 论证与推理',[68,69,70],'论证关注论题、论据及其推理关系；前提和结论属于推理结构。')],task:'在一段话中分别标出要证明什么、用什么支持、两者如何连接。'},
 K05:{references:[book('第四章 论证与推理 · 归纳推理',[80,81],'归纳结论通常超出已观察前提，具有或然性；评价样本与归纳支持的强弱。')],task:'检查熟人样本是否代表全体，改写过强的结论。'},
 K07:{references:[book('第四章 论证与推理 · 未表达前提',[104,105,106,107,108,109],'重建未表达前提时，需要识别其中关于事实规律与规范标准的假设。')],task:'把“这样做更好”中的评价标准说清楚，再检查事实理由。'}
};
const extra=[
 {id:'C01',term:'断言',aliases:['断言与判断'],definition:'在交流中表达信息、信念或意见，可以被判断为真或假的陈述。',example:'“图书馆周日开放”是断言；“请安静”是请求。',boundary:'疑问、命令和情绪表达不能直接按同一方式判真假；一个断言也不等于一段完整论证。',references:[book('第二章 断言与澄清概念 · 第一节 断言',[26,27,28],'断言是表达信息、信念或意见并有真假之分的语句。')]},
 {id:'C02',term:'概念与抽象',aliases:['概念是什么','什么是概念','抽象'],definition:'概念用于把握一类对象的特征；抽象是在比较中区分个别、次要特征与共同、主要特征的思维过程。',example:'从许多不同的三角形中抽取“三条边围成平面图形”的共同特征。',boundary:'不能用一个典型例子的偶然特征代替整个类别的定义。',references:[book('第二章 断言与澄清概念 · 第二节 概念与判断',[29,30],'概念与对象的属性有关；抽象帮助从个别中把握一般。')]},
 {id:'C03',term:'模糊、歧义与笼统',aliases:['模糊','歧义','笼统','含混'],definition:'模糊是适用边界不明确；歧义是同一表达存在多种意义；笼统是表达过于一般，缺少当前问题所需的具体信息。',example:'“成绩好”缺少标准；“敬业”可能指投入或加班；“改善教育”未说明改善什么。',boundary:'表达含混需要澄清；尚未发现推理中含义偷换时，不应直接贴“偷换概念”的标签。',task:'指出是哪种含混，并把原句改成含义清楚、可讨论的说法。',references:[book('第二章 断言与澄清概念 · 第三节 断言表达含混',[33,34],'教材区分概念的模糊、歧义、笼统，说明其如何影响断言判断。')]},
 {id:'C04',term:'词典定义与约定定义',aliases:['词典定义','约定定义','定义的作用'],definition:'词典定义说明既有用法；约定定义明确本次讨论中术语的特定意义和范围。',example:'讨论“过度依赖AI”前，约定指不核验地复制答案，而不是所有AI辅助。',boundary:'约定必须公开且前后一致，不能为逃避反例临时改动定义，也不能把约定伪装成普遍事实。',references:[book('第二章 断言与澄清概念 · 第四节 澄清概念',[36,37,38],'下定义可以告知概念意义，也可以约定特定语境中的意义。')]},
 {id:'C05',term:'下定义的方法',aliases:['属加种差','实指','同义词定义','给概念下定义'],definition:'可以指示对象或典型实例、使用更清楚的同义词，或说明所属类别及区别于同类的关键特征。',example:'定义正方形时，先明确它是平面四边形，再说明边与角的限制。',boundary:'例子帮助理解，但单举例子未必划清边界；避免循环定义、过宽、过窄。',references:[book('第二章 断言与澄清概念 · 第四节 澄清概念',[35,38,39,40],'介绍实指、同义词及分析式定义，说明“属加种差”的做法。')]},
 {id:'C06',term:'隐含前提',aliases:['未表达前提','隐藏假设','隐含假设'],definition:'为了使理由与结论相连，论证中依赖但没有直接说出的假设。',example:'“大家都在用，所以可靠”依赖“流行就足以证明可靠”的假设。',boundary:'补出的前提是分析者的重建，必须与作者原文区分，并请用户检查是否准确。',references:[book('第四章 论证与推理 · 未表达前提',[104,105,106,107,108,109],'补足未表达前提，使论据如何支持论题的关系显现。')]},
 {id:'C07',term:'论证评价',aliases:['有效性与真实性','前提真实性','推理有效性','可靠论证'],definition:'分别检查前提是否真实或可接受，以及前提能否以相应强度支持结论。演绎看有效性，归纳看支持强度。',example:'形式正确但前提未经核实，不能直接认定结论已经获得可靠证明。',boundary:'论证有缺陷不等于结论必然为假；观察符合一个预测，也不能单独证明假说为真。',references:[book('第五章 分析与评价论证 · 评价论证',[139,140,141,142],'评价要分别检查推理形式与前提状况。')]},
 {id:'C08',term:'批判性阅读',aliases:['分析阅读','批判阅读'],definition:'在理解原文的基础上，识别问题与主张、分析支持关系、评价依据，再形成自己的有理由的判断。',example:'先准确复述一篇文章的观点，再找出证据缺口，而不是先选立场再寻找句子支持。',boundary:'批判不等于先否定；不能歪曲作者原意或只选符合自己立场的证据。',references:[book('第三章 批判性阅读 · 批判性阅读',[49,50,51],'从问题与观点、论证结构及其可靠性出发阅读，并提出自己的看法及理由。')]},
 {id:'C09',term:'主题阅读',aliases:['专题阅读'],definition:'围绕一个问题组织多篇材料，比较各自概念、立场、理由与局限，综合后形成自己的论证。',example:'比较支持和质疑AI辅助写作的研究，按使用方式、对象和测量指标分类。',boundary:'保持对相反证据的开放；不能只摘取对自己有利的结论。',references:[book('第三章 批判性阅读 · 主题阅读',[56,57,58],'围绕论题进行定位、批判、梳理与写作。')]},
 {id:'C10',term:'文献综述',aliases:['综述写作','文献评述'],definition:'围绕问题综合、比较和评价既有研究，说明已知、分歧、证据局限及尚待研究的问题。',example:'按研究问题和证据分组，比较结论差异，再解释自己的研究将补什么空缺。',boundary:'不是逐篇摘要的堆积，也不能用“然而”等转折词数量代替思辨质量。',references:[book('第三章 批判性阅读 · 文献综述',[63,64,65,66,67],'综述应评述已有研究，为论题和后续研究提供理由。')]},
 {id:'C11',term:'理智美德',aliases:['理智谦逊','理智同理心','理智勇气','思维素养'],definition:'支持良好思考的态度与习惯，包括承认知识局限、公平理解异见、质疑自己的信念和对自己与别人使用一致标准。',example:'先准确复述不赞成的观点，再解释它的证据为何不足。',boundary:'开放不等于所有主张同样可靠，谦逊也不等于放弃判断。',references:[elder('访谈讨论理智的同理心、谦逊、勇气、自主、正直及跟随事实。')]},
 {id:'C12',term:'理智标准',aliases:['通用理智标准','清晰性','公正性','充分性'],definition:'检查思考质量时关注清晰、准确、精准、相关、深度、广度、逻辑、重要、公正与充分。',example:'“AI有影响”需要说清影响对象、使用方式、衡量指标和证据。',boundary:'标准是检查问题的工具，不是简单给用户打分的问卷；不要求每次机械列满十项。',references:[elder('访谈列出通用理智标准，并提出用自己的话复述他人观点的训练。')]},
 {id:'C13',term:'批判性思维倾向与能力',aliases:['思维倾向','思维能力','思辨能力','自评量表'],definition:'倾向指是否愿意寻求证据、开放思考等态度；能力要从实际分析、评价、推理等任务表现观察，两者有关但不能互相替代。',example:'自称愿意听取异见，不等于已能准确识别一段论证的隐含前提。',boundary:'自评、对话次数或单次答对都不能直接证明能力提升；不同量表版本不能直接套用同一阈值。',references:[ref('disposition','批判性思维倾向的调查与量表',[1,2],'文章用自评问卷研究思维倾向；本平台把倾向与实际任务表现分开。')]}
];
export const concepts=[...knowledge.map(k=>({...k,...enrichments[k.id],aliases:k.id==='F10'?[]:k.aliases,references:enrichments[k.id]?.references||[]})),...extra];

// Prefer the concept being asked about over incidental course names later in the message.
export function conceptQuery(text){
 const first=String(text).split(/[。！？!?\n]/)[0];
 return first.replace(/^(?:请|帮我|你能|能否|解释一下|解释|澄清|辨析|什么是|请问|介绍一下|介绍)+[：:\s]*/,'').trim();
}
export function retrieveConcepts(text){
 const query=conceptQuery(text);
 return concepts.map(k=>({k,score:[k.term,...k.aliases,...(k.id==='C02'&&/^概念(?:是什么|是什么意思)?$/.test(query)?['概念']:[])].reduce((score,word)=>Math.max(score,query.includes(word)?word.length:0),0)}))
  .filter(x=>x.score>0).sort((a,b)=>b.score-a.score).slice(0,3)
  .map(({k})=>({...k,source:k.references.length?'课程知识整理':'',provenance:'整理讲解，不作为逐字引文'}));
}
export function conceptSources(entries){return entries.filter(e=>e.references.length).map(e=>({id:e.id,term:e.term,definition:e.definition,references:e.references}));}

export const teachingNotes={
 socratic:{method:'先准确理解用户观点，每次只推进一个思考动作；依实际回答灵活检查定义、信息来源、隐含假设、替代解释、结论边界。让用户自己给理由、判断是否修订观点，不替用户得出标准结论。五轮是平台交互设计，不声称教材规定五轮。',references:[criticalRefs[1],ref('flow','心理假设—信息—论证—行动—反馈',[1],'从假设与信息到论证、行动和反馈，形成可回溯的思考过程。')]},
 concept:{method:'先解决用户真正困惑的术语，给准确简明的定义和通俗解释，再指出关键误解与适用边界。根据需要补充素养与能力的区分。一次邀请用户用自己的话复述或举例，等其回答后再用课堂情境或边界案例检查迁移；发现误解给针对性提示，不以背诵原句为标准。定义、应用和来源分清，但无需向用户解释知识库是否覆盖。',references:[book('第二章 断言与澄清概念',[33,34,35,36,37,38,39,40],'先检查概念含混，再用合适的定义方式澄清。'),criticalRefs[1],ref('answers','配套练习的使用原则',[1,2,3,4],'练习允许结合语境说明理由；只借鉴练习方式，不提前展示配套答案。')]},
 argument:{method:'先判断原文有没有主张与支持理由，纯描述或未提供理由的表态不能硬编成完整论证。忠实区分原文明示内容、分析者重建的隐含前提及改写建议。识别中间结论，检查理由是否相关、充分；演绎看形式有效，归纳看样本与支持强度，事实需单独核验。证据不足或推理不成立不等于结论必然为假。研究与综述类材料比较研究问题、设计、样本、局限和相反证据，不能靠转折词或立场数量评价思辨。',references:[book('第五章 分析与评价论证',[111,112,113,114,115,139,140,141,142],'忠实分析原文，区分识别、分析与评价。'),ref('review','语步结构、立场与命题关系',[1,2,3,4,5,6],'文献综述需要结合宏观结构与微观表达，不将立场词数量等同思辨能力。')]},
 fallacy:{method:'把训练落在“原话—具体推理缺口—为什么不足—怎样修正”，不是只背谬误名称。区分概念含混、事实待核验和推理漏洞，允许未发现明显谬误。用户即使用不同名称，只要抓住实际缺口且解释充分，也可通过。对战先让用户独立判断，不提前引入包含答案的教材题解或公开目标谬误。',references:[book('第五章 分析与评价论证',[139,140,141,142],'分别检查前提与推理，避免将未经证明等同于已证伪。')]},
 perspectives:{method:'先准确复述各方观点，避免把人物职业当成固定立场。说明各方的问题、目标、知识背景、证据及价值假设；相反观点都要公平呈现，但不能把证据质量视为相同。用户换位后检查是否理解对方，再梳理真实冲突、可协商条件、共识或保留分歧。历史类问题核对史料来源与语境，区分原始材料与后人解释，考虑多重成因。',references:[criticalRefs[1],ref('history','史料、语境与多角度教学',[1,2],'来源核查、历史语境、案例讨论、角色模拟与形成性评价。')]},
 planner:{method:'依据用户目标、基础、时间和真实表现安排准备—练习—反思—迁移。阅读学习可分读通、读懂、分析、跨文本比较；选用可靠材料，安排复述、比较、论证写作等可观察产出，给完成标准与调整条件。不能把每轮都答对、学习天数或自报倾向当成能力已提升的证明。研究中的教学效果不等于本平台有效性，不承诺提升比例。若主题不是批判性思维课程，就把这些方法应用到该学科，不硬塞思辨教材为专业知识资源。',references:[book('第三章 批判性阅读',[43,44,45,46,47,48,49,50,51],'从基础理解逐步进入分析阅读。'),ref('siop','教学准备、实施与反思',[1,2,3,4],'借鉴背景搭建、互动实践、复习评价，不把文章实验结果当作平台验证。'),ref('classics','阅读过程与实践策略',[1,2,3,4],'借鉴预读、略读、精读、品读、复读，配合讨论、笔记与迁移。'),ref('disposition','倾向与任务表现',[1,2,3],'自评倾向与技能表现分开，不挪用量表阈值。')]}
};
// Current resource scope: textbook only. Historical document inventory stays available for maintenance.
const criticalEntry=concepts.find(c=>c.id==='K01');
criticalEntry.verbatim='批判性思维就是审慎地运用推理判断一个断言是否为真的思维形式。';
criticalEntry.verbatimReference=book('第一章 知识与批判 · 第二节 什么是批判',[23],'教材对批判性思维的定义，已对照原页核验。');
for(const c of concepts)c.references=c.references.filter(r=>r.document==='book');
for(const note of Object.values(teachingNotes))note.references=note.references.filter(r=>r.document==='book');
export function teachingContext(id){
 const note=teachingNotes[id];
 return '\n课程教学方法（用于指导交互，不要求在回复中罗列来源）：'+(note?.method||'')+
  '\n出处规则：不强制每次回答附知识点、章节或页码。仅引用本轮明确提供且与所讲内容直接相关的来源；不得自行补造教材、作者、页码或逐字引文。未提供出处的内容自然回答，不添加“教材未覆盖”“平台补充解释”“没有教材依据”“未接入外部检索”等提示。不要把资料涉及的方法当成用户话题的事实证据；日常追问与反馈以对话为主。训练案例标明是练习情境，不冒充真实事件。';
}
