// Embed the existing logo in the stylesheet served by the unchanged backend.
import {readFile,writeFile} from 'node:fs/promises';
const cssURL=new URL('../public/studio.css',import.meta.url);
const start='/* BEGIN PLATFORM LOGO */',end='/* END PLATFORM LOGO */';
const bytes=await readFile(new URL('../public/brand/sibian-academy-logo.png',import.meta.url));
const block=`${start}
:root{--platform-logo-image:url("data:image/png;base64,${bytes.toString('base64')}")}
.brand-mark{background:#fbf7ee;padding:4px;overflow:hidden;flex-shrink:0}
.platform-logo{display:block;position:relative;width:100%;aspect-ratio:10/7;overflow:hidden;pointer-events:none}
.platform-logo::before{content:"";position:absolute;width:125.4%;aspect-ratio:1;left:-12.5%;top:-20%;background:var(--platform-logo-image) center/100% 100% no-repeat}
#profile-shortcut{padding:3px;overflow:hidden;flex-shrink:0}
${end}`;
let css=await readFile(cssURL,'utf8');
const from=css.indexOf(start),to=css.indexOf(end);
if(from>=0&&to>=from)css=css.slice(0,from)+block+css.slice(to+end.length);
else if(from<0&&to<0)css+='\n'+block+'\n';
else throw new Error('Incomplete logo block; stylesheet was not modified.');
await writeFile(cssURL,css);
console.log('Updated platform logo presentation only.');
