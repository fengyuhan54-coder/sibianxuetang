// Rebuild the presentation-only image bundle without adding backend routes.
import {readFile,writeFile} from 'node:fs/promises';
const cssURL=new URL('../public/studio.css',import.meta.url);
const start='/* BEGIN GENERATED MENTOR ART:';
const end='/* END GENERATED MENTOR ART */';
const roles=['socratic','coach','fallacy','perspectives','argument','planner','concept'];
const rules=['/* BEGIN GENERATED MENTOR ART: format-converted WebP assets, embedded for the existing static CSS route. */'];
for(const role of roles){
 const bytes=await readFile(new URL('../public/mentor-art/'+role+'.webp',import.meta.url));
 rules.push(`.scene-panel.scene-${role},.chat-layout[data-role-theme="${role}"],.mentor-portrait[data-mentor="${role}"]{--mentor-scene:url("data:image/webp;base64,${bytes.toString('base64')}")}`);
}
rules.push(end);
const css=await readFile(cssURL,'utf8'),from=css.indexOf(start),to=css.indexOf(end);
if(from<0||to<from)throw new Error('Mentor asset block is missing; no files were changed.');
await writeFile(cssURL,css.slice(0,from)+rules.join('\n')+css.slice(to+end.length));
console.log('Updated seven mentor artworks in the existing CSS bundle.');
