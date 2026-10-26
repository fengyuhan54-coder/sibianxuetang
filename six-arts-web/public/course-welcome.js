const dialog=document.getElementById('course-welcome');
const open=()=>{if(dialog&&!dialog.open)dialog.showModal();};
const close=()=>dialog.close();
document.getElementById('course-welcome-close')?.addEventListener('click',close);
document.getElementById('course-welcome-enter')?.addEventListener('click',close);
document.getElementById('course-welcome-open')?.addEventListener('click',open);
// Show on each fresh page load; dismissing it never clears or changes learning records.
open();
